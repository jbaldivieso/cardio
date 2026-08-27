import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { backupFilename, serialise, validateBackup } from '@/domain/backup'
import type { BackupRepairs, LibraryData } from '@/domain/backup'
import { useErrorSurface } from '@/stores/errors'
import { useLibraryStore } from '@/stores/library'
import { useMasteryStore } from '@/stores/mastery'
import { repositories } from '@/stores/repositories'

/** The two ways §10 allows a backup to be loaded. */
export type ImportMode = 'merge' | 'replace'

/** How many rows of each kind a file holds, for the confirmation before a write. */
export interface LibraryCounts {
  folders: number
  decks: number
  cards: number
}

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

function countsOf(data: LibraryData): LibraryCounts {
  return { folders: data.folders.length, decks: data.decks.length, cards: data.cards.length }
}

/**
 * Hands a file to the browser. A Blob URL and a synthetic click is the only way
 * a page with no server can offer a download (§10); the object URL is released
 * on the next tick, once the browser has taken the data.
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
  setTimeout(() => URL.revokeObjectURL(url), 0)
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
  const busy = ref(false)
  const { error, attempt } = useErrorSurface()

  /** Clears whatever the last file left on screen. */
  function discard(): void {
    pending.value = null
    errors.value = []
    report.value = null
    error.value = null
  }

  async function exportBackup(): Promise<BackupDownload | undefined> {
    busy.value = true
    const file = await attempt(async () => {
      const now = Date.now()
      const data = await repositories.library.snapshot()
      return { filename: backupFilename(now), json: serialise(data, now) }
    })
    busy.value = false
    if (file) offerDownload(file)
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
      await repositories.library.replaceAll(data, Date.now())
      const { folders, decks, cards } = countsOf(data)
      return { added: folders + decks + cards, skipped: 0 }
    })
  }

  /** The danger zone (§7.8): everything goes, and Unsorted comes back. */
  async function deleteEverything(): Promise<boolean> {
    discard()
    busy.value = true
    const done = await attempt(async () => {
      await repositories.library.replaceAll({ folders: [], decks: [], cards: [] }, Date.now())
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
    busy,
    error,
    exportBackup,
    inspect,
    discard,
    merge,
    replace,
    deleteEverything,
  }
})
