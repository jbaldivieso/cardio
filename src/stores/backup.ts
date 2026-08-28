import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { backupFilename, countsOf, serialise, validateBackup } from '@/domain/backup'
import type { BackupRepairs, LibraryCounts, LibraryData } from '@/domain/backup'
import { useErrorSurface } from '@/stores/errors'
import { useLibraryStore } from '@/stores/library'
import { useMasteryStore } from '@/stores/mastery'
import { repositories } from '@/stores/repositories'

/** The two ways §10 allows a backup to be loaded. */
export type ImportMode = 'merge' | 'replace'

/** A validated file, waiting for the user to say how to load it. */
export interface PendingImport {
  data: LibraryData
  counts: LibraryCounts
  repairs: BackupRepairs
}

/** What an import did, in the counts §10 asks to be reported. */
export interface ImportReport {
  mode: ImportMode
  added: number
  skipped: number
  repairs: BackupRepairs
}

/** An export, ready to be written to disk. */
export interface BackupDownload {
  filename: string
  json: string
}

/**
 * How long the object URL is left alive after the click. Firefox and older
 * WebKit begin fetching a `blob:` href only after the synthetic click returns,
 * and revoking it first cancels the download with no error anywhere — the worst
 * failure this feature has, since the export may be the only copy of a library.
 */
const REVOKE_AFTER_MS = 60_000

/**
 * Hands a file to the browser. A Blob URL and a synthetic click is the only way
 * a page with no server can offer a download (§10).
 */
function offerDownload(file: BackupDownload): void {
  const url = URL.createObjectURL(new Blob([file.json], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.filename
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS)
}

/**
 * Export, import and the danger zone (spec §10, §7.8).
 *
 * Importing is deliberately two steps: a file is validated into `pending` and
 * only written once the user picks merge or replace, so "validation before any
 * write" is the shape of the store rather than a rule to remember. The store
 * owns the clock, as every store does; `src/domain/backup.ts` takes it as an
 * argument.
 */
export const useBackupStore = defineStore('backup', () => {
  /**
   * A validated file waiting to be loaded, if one has been chosen. Shallow on
   * purpose: these rows go to IndexedDB verbatim, and a deep ref would hand
   * Dexie reactive proxies, which are not structured-cloneable.
   */
  const pending = shallowRef<PendingImport | null>(null)
  /** Why the last file was refused. Empty when there is nothing to report. */
  const errors = ref<string[]>([])
  /** What the last import did, for the screen to report. */
  const report = ref<ImportReport | null>(null)
  /**
   * The chosen file's name. Kept here rather than on the screen: the file input
   * is re-armed after every read so it cannot report its own, and only the store
   * knows when the file has been loaded and the name should go.
   */
  const filename = ref<string | null>(null)
  const busy = ref(false)
  const { error, attempt } = useErrorSurface()

  /** Clears whatever the last file left on screen. */
  function discard(): void {
    pending.value = null
    errors.value = []
    report.value = null
    filename.value = null
    error.value = null
  }

  async function exportBackup(): Promise<BackupDownload | undefined> {
    busy.value = true
    // The download happens inside `attempt`, not after it: a browser that
    // refuses to make a Blob URL would otherwise reject into the click handler
    // with nothing on screen, and the user would think the export had worked.
    const file = await attempt(async () => {
      const now = Date.now()
      const data = await repositories.library.snapshot()
      const download = { filename: backupFilename(now), json: serialise(data, now) }
      offerDownload(download)
      return download
    })
    busy.value = false
    return file
  }

  /**
   * Validates a chosen file (§10) without touching the database. Answers whether
   * it can be loaded; either way it replaces whatever the last file left behind.
   */
  function inspect(text: string): boolean {
    discard()
    const result = validateBackup(text)
    if (!result.ok) {
      errors.value = result.errors
      return false
    }
    pending.value = { data: result.data, counts: countsOf(result.data), repairs: result.repairs }
    return true
  }

  /**
   * Reads a chosen file and validates it (§10). A file the browser cannot hand
   * over — moved or deleted since the picker closed, or on a cloud provider
   * that has gone away — is refused with a reason, exactly as a malformed one
   * is, rather than leaving the screen looking as though nothing was clicked.
   */
  async function read(file: File): Promise<boolean> {
    let text: string
    try {
      text = await file.text()
    } catch {
      discard()
      errors.value = [`“${file.name}” could not be read. Try choosing it again.`]
      filename.value = file.name
      return false
    }
    const ok = inspect(text)
    filename.value = file.name
    return ok
  }

  /** Runs one of the two loads over the pending file and reports what it did. */
  async function load(
    mode: ImportMode,
    write: (data: LibraryData) => Promise<Omit<ImportReport, 'mode' | 'repairs'>>,
  ): Promise<ImportReport | undefined> {
    const file = pending.value
    if (busy.value || file === null) return undefined

    busy.value = true
    const counts = await attempt(() => write(file.data))
    busy.value = false
    if (!counts) return undefined

    // Every screen that lists folders or decks is now out of date, and so is
    // every mastery summary: this wrote whole decks, not one card (ADR-032).
    useMasteryStore().invalidateAll()
    await useLibraryStore().load()
    pending.value = null
    filename.value = null
    report.value = { mode, repairs: file.repairs, ...counts }
    return report.value
  }

  /** Adds the rows the library does not have, and leaves the rest (§10). */
  async function merge(): Promise<ImportReport | undefined> {
    return load('merge', (data) => repositories.library.mergeAll(data))
  }

  /** Clears the library and loads the file in its place (§10). Typed confirmation. */
  async function replace(): Promise<ImportReport | undefined> {
    return load('replace', async (data) => {
      await repositories.library.replaceAll(data)
      const { folders, decks, cards } = countsOf(data)
      return { added: folders + decks + cards, skipped: 0 }
    })
  }

  /** The danger zone (§7.8): everything goes, and nothing takes its place. */
  async function deleteEverything(): Promise<boolean> {
    discard()
    busy.value = true
    const done = await attempt(async () => {
      await repositories.library.replaceAll({ folders: [], decks: [], cards: [] })
      return true
    })
    busy.value = false
    if (!done) return false
    useMasteryStore().invalidateAll()
    await useLibraryStore().load()
    return true
  }

  return {
    pending,
    errors,
    report,
    filename,
    busy,
    error,
    exportBackup,
    inspect,
    read,
    discard,
    merge,
    replace,
    deleteEverything,
  }
})
