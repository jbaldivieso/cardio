/**
 * The backup document of spec §10: what an export writes and what an import is
 * handed. Pure, like the rest of `src/domain` — the clock arrives as `now`, and
 * reading and writing rows is `src/db`'s job.
 */

import { MASTERY_HISTORY_LIMIT, UNSORTED_FOLDER_ID } from '@/domain/models'
import type { Attempt, Card, CardStats, Deck, Folder } from '@/domain/models'
import { validateFace, validateName, ValidationError } from '@/domain/validation'

/** Stamped on every export and demanded of every import (§10). */
export const BACKUP_APP = 'cardio'
export const BACKUP_SCHEMA_VERSION = 1

/** The whole library, which is what a backup carries and an import loads. */
export interface LibraryData {
  folders: Folder[]
  decks: Deck[]
  cards: Card[]
}

/** A library plus the envelope that says which app and format wrote it. */
export interface BackupFile extends LibraryData {
  app: string
  schemaVersion: number
  /** ISO 8601, so a human reading the file can see when it was taken. */
  exportedAt: string
}

/** What validation had to put right to make the file loadable (§10). */
export interface BackupRepairs {
  /** Decks whose folder was missing, re-homed to Unsorted. */
  rehomedDecks: number
  /** Cards whose deck was missing, dropped. */
  rejectedCards: number
}

export type BackupValidation =
  { ok: true; data: LibraryData; repairs: BackupRepairs } | { ok: false; errors: string[] }

/** The backup document for a library, as the text that gets downloaded. */
export function serialise(data: LibraryData, now: number): string {
  const file: BackupFile = {
    app: BACKUP_APP,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date(now).toISOString(),
    folders: data.folders,
    decks: data.decks,
    cards: data.cards,
  }
  // Indented: a backup is a file the user keeps, and may well open.
  return JSON.stringify(file, null, 2)
}

/**
 * `cardio-backup-YYYY-MM-DD.json` (§10), dated in the user's own time zone —
 * they sort their backups by the day they took them, not by UTC's.
 */
export function backupFilename(now: number): string {
  const at = new Date(now)
  const pad = (value: number): string => String(value).padStart(2, '0')
  const day = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
  return `cardio-backup-${day}.json`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Collects the reasons one row cannot be loaded. A row reader either returns
 * the row or reports why not, so one bad card names itself instead of failing
 * the file anonymously.
 */
class RowErrors {
  readonly messages: string[] = []

  constructor(
    private readonly label: string,
    private readonly index: number,
  ) {}

  add(message: string): void {
    this.messages.push(`${this.label} ${this.index + 1}: ${message}`)
  }

  /** Runs a §4.2 validator, turning its refusal into a readable line. */
  validated(read: () => string): string {
    try {
      return read()
    } catch (cause) {
      this.add(cause instanceof ValidationError ? cause.message : 'is not valid.')
      return ''
    }
  }

  string(row: Record<string, unknown>, field: string): string {
    const value = row[field]
    if (typeof value !== 'string' || value.trim().length === 0) {
      this.add(`${field} is missing.`)
      return ''
    }
    return value
  }

  number(row: Record<string, unknown>, field: string): number {
    const value = row[field]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      this.add(`${field} is not a number.`)
      return 0
    }
    return value
  }
}

function readAttempt(value: unknown): Attempt | null {
  if (!isRecord(value)) return null
  const { at, got } = value
  if (typeof at !== 'number' || !Number.isFinite(at) || typeof got !== 'boolean') return null
  return { at, got }
}

/** Statistics, or `null` if the shape is not statistics at all (§4.1). */
function readStats(value: unknown): CardStats | null {
  if (!isRecord(value)) return null
  const { gets, misses, history, lastSeenAt } = value
  const counter = (count: unknown): boolean =>
    typeof count === 'number' && Number.isInteger(count) && count >= 0
  if (!counter(gets) || !counter(misses)) return null
  if (!Array.isArray(history)) return null
  if (lastSeenAt !== null && (typeof lastSeenAt !== 'number' || !Number.isFinite(lastSeenAt))) {
    return null
  }
  const attempts: Attempt[] = []
  for (const entry of history) {
    const attempt = readAttempt(entry)
    if (attempt === null) return null
    attempts.push(attempt)
  }
  return {
    gets: gets as number,
    misses: misses as number,
    // §4.2 caps the history and drops the oldest first; a longer one is a file
    // to trim, not a file to refuse.
    history: attempts.slice(-MASTERY_HISTORY_LIMIT),
    lastSeenAt: lastSeenAt as number | null,
  }
}

/**
 * Reads one table, reporting each unreadable row. Ids are checked for collisions
 * here because they are primary keys: two rows sharing one would fail the write
 * halfway through with a message from Dexie rather than from us.
 */
function readTable<T extends { id: string }>(
  rows: unknown[],
  label: string,
  errors: string[],
  read: (row: Record<string, unknown>, row_errors: RowErrors) => T,
): T[] {
  const parsed: T[] = []
  const seen = new Set<string>()
  rows.forEach((row, index) => {
    const rowErrors = new RowErrors(label, index)
    if (!isRecord(row)) {
      rowErrors.add('this row is not a record.')
      errors.push(...rowErrors.messages)
      return
    }
    const entry = read(row, rowErrors)
    if (rowErrors.messages.length === 0 && seen.has(entry.id)) {
      rowErrors.add(`another ${label.toLowerCase()} already uses the id "${entry.id}".`)
    }
    if (rowErrors.messages.length > 0) {
      errors.push(...rowErrors.messages)
      return
    }
    seen.add(entry.id)
    parsed.push(entry)
  })
  return parsed
}

function readFolder(row: Record<string, unknown>, errors: RowErrors): Folder {
  return {
    id: errors.string(row, 'id'),
    name: errors.validated(() => validateName(String(row.name ?? ''))),
    createdAt: errors.number(row, 'createdAt'),
    updatedAt: errors.number(row, 'updatedAt'),
  }
}

function readDeck(row: Record<string, unknown>, errors: RowErrors): Deck {
  return {
    id: errors.string(row, 'id'),
    folderId: errors.string(row, 'folderId'),
    name: errors.validated(() => validateName(String(row.name ?? ''))),
    createdAt: errors.number(row, 'createdAt'),
    updatedAt: errors.number(row, 'updatedAt'),
  }
}

function readCard(row: Record<string, unknown>, errors: RowErrors): Card {
  const stats = readStats(row.stats)
  if (stats === null) errors.add('statistics are missing or unreadable.')
  return {
    id: errors.string(row, 'id'),
    deckId: errors.string(row, 'deckId'),
    front: errors.validated(() => validateFace(String(row.front ?? ''), 'front')),
    back: errors.validated(() => validateFace(String(row.back ?? ''), 'back')),
    createdAt: errors.number(row, 'createdAt'),
    updatedAt: errors.number(row, 'updatedAt'),
    stats: stats ?? { gets: 0, misses: 0, history: [], lastSeenAt: null },
  }
}

/** The `folders` / `decks` / `cards` array, or `null` with the reason recorded. */
function readArray(file: Record<string, unknown>, key: string, errors: string[]): unknown[] | null {
  const value = file[key]
  if (!Array.isArray(value)) {
    errors.push(`"${key}" is missing or is not a list.`)
    return null
  }
  return value
}

/**
 * Everything §10 asks of an import, before a single row is written: the right
 * app, a version this build understands, all three tables, and every row passing
 * §4.2. References are repaired rather than refused — a deck with no folder
 * lands in Unsorted, a card with no deck is dropped and counted — because a
 * library that is nearly right is still worth having back.
 */
export function validateBackup(json: string): BackupValidation {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, errors: ['That file is not valid JSON.'] }
  }

  if (!isRecord(parsed) || parsed.app !== BACKUP_APP) {
    return { ok: false, errors: ['That file is not a Cardio backup.'] }
  }
  if (parsed.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    const version = JSON.stringify(parsed.schemaVersion)
    return {
      ok: false,
      errors: [
        `That backup is version ${version}; this app reads version ${BACKUP_SCHEMA_VERSION}.`,
      ],
    }
  }

  const structure: string[] = []
  const folderRows = readArray(parsed, 'folders', structure)
  const deckRows = readArray(parsed, 'decks', structure)
  const cardRows = readArray(parsed, 'cards', structure)
  if (folderRows === null || deckRows === null || cardRows === null) {
    return { ok: false, errors: structure }
  }

  const errors: string[] = []
  const folders = readTable(folderRows, 'Folder', errors, readFolder)
  const decks = readTable(deckRows, 'Deck', errors, readDeck)
  const cards = readTable(cardRows, 'Card', errors, readCard)
  if (errors.length > 0) return { ok: false, errors }

  const folderIds = new Set(folders.map((folder) => folder.id))
  let rehomedDecks = 0
  // Unsorted counts as present whether or not the file carries it: the load
  // re-seeds it (§10) and a merge lands in a library that already has it. A deck
  // already pointing there has not been moved, so it is not a repair.
  const homed = decks.map((deck) => {
    if (folderIds.has(deck.folderId) || deck.folderId === UNSORTED_FOLDER_ID) return deck
    rehomedDecks += 1
    return { ...deck, folderId: UNSORTED_FOLDER_ID }
  })

  const deckIds = new Set(homed.map((deck) => deck.id))
  const kept = cards.filter((card) => deckIds.has(card.deckId))

  return {
    ok: true,
    data: { folders, decks: homed, cards: kept },
    repairs: { rehomedDecks, rejectedCards: cards.length - kept.length },
  }
}
