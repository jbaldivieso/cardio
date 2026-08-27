import { db, seedDefaults } from '@/db'
import type { CardioDb } from '@/db'
import { durableWrite } from '@/db/persistence'
import type { LibraryData } from '@/domain/backup'

/**
 * The whole library in one object: what an import loads and an export writes.
 * The shape is the domain's (`LibraryData`), since §10's `BackupFile` is this
 * plus its envelope fields and both sides must agree on it exactly.
 */
export type LibrarySnapshot = LibraryData

/** What a merge did, in the terms §10 asks it to be reported in. */
export interface MergeReport {
  /** Rows written, because the library had no row with that id. */
  added: number
  /** Rows left alone, because it did. */
  skipped: number
}

export interface LibraryRepo {
  /** Everything, for an export (§10). Statistics included. */
  snapshot(): Promise<LibrarySnapshot>
  /**
   * "Merge" (§10): add the rows whose ids are absent, leave the rest exactly as
   * they are, and report both counts. All or nothing.
   */
  mergeAll(data: LibrarySnapshot): Promise<MergeReport>
  /**
   * "Replace everything" (§10): clear all three tables, load the snapshot and
   * re-seed Unsorted, all or nothing. Validation happens before the call.
   */
  replaceAll(data: LibrarySnapshot, now: number): Promise<void>
}

/**
 * The rows of a table that this library has never seen. Ids come from a backup,
 * so on a merge "already there" is the common case, and an existing row is never
 * overwritten — the library on disk wins (§10).
 */
async function unknownRows<T extends { id: string }>(
  rows: T[],
  lookup: (ids: string[]) => Promise<(T | undefined)[]>,
): Promise<T[]> {
  if (rows.length === 0) return []
  const existing = await lookup(rows.map((row) => row.id))
  return rows.filter((_, index) => existing[index] === undefined)
}

export function createLibraryRepo(database: CardioDb = db): LibraryRepo {
  return {
    async snapshot(): Promise<LibrarySnapshot> {
      // One read transaction, not three: a backup assembled from three separate
      // reads can catch another tab's write half done and carry a card whose
      // deck is already gone. Importing that file would drop the card silently.
      return database.transaction(
        'r',
        database.folders,
        database.decks,
        database.cards,
        async () => {
          const [folders, decks, cards] = await Promise.all([
            database.folders.toArray(),
            database.decks.toArray(),
            database.cards.toArray(),
          ])
          return { folders, decks, cards }
        },
      )
    },

    async mergeAll(data: LibrarySnapshot): Promise<MergeReport> {
      return durableWrite(database, () =>
        database.transaction('rw', database.folders, database.decks, database.cards, async () => {
          // Sequential on purpose: a Dexie transaction is bound to the zone its
          // callback runs in, and awaiting in parallel would leave it.
          const folders = await unknownRows(data.folders, (ids) => database.folders.bulkGet(ids))
          const decks = await unknownRows(data.decks, (ids) => database.decks.bulkGet(ids))
          const cards = await unknownRows(data.cards, (ids) => database.cards.bulkGet(ids))
          await database.folders.bulkAdd(folders)
          await database.decks.bulkAdd(decks)
          await database.cards.bulkAdd(cards)
          const added = folders.length + decks.length + cards.length
          const total = data.folders.length + data.decks.length + data.cards.length
          return { added, skipped: total - added }
        }),
      )
    },

    async replaceAll(data: LibrarySnapshot, now: number): Promise<void> {
      await durableWrite(database, () =>
        database.transaction('rw', database.folders, database.decks, database.cards, async () => {
          await Promise.all([
            database.cards.clear(),
            database.decks.clear(),
            database.folders.clear(),
          ])
          await database.folders.bulkAdd(data.folders)
          await database.decks.bulkAdd(data.decks)
          await database.cards.bulkAdd(data.cards)
          // A backup taken from this app carries its own Unsorted, possibly
          // renamed; one that does not gets a fresh one (§4.2, §10).
          await seedDefaults(database, now)
        }),
      )
    },
  }
}

/** The repository the app uses; tests build their own against a throwaway database. */
export const libraryRepo = createLibraryRepo()
