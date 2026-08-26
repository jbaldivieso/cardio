import { db, seedDefaults } from '@/db'
import type { CardioDb } from '@/db'
import { durableWrite } from '@/db/persistence'
import type { Card, Deck, Folder } from '@/domain/models'

/**
 * The whole library in one object: what an import loads and an export writes.
 * Item 10's `BackupPayload` (§10) is this plus its envelope fields.
 */
export interface LibrarySnapshot {
  folders: Folder[]
  decks: Deck[]
  cards: Card[]
}

export interface LibraryRepo {
  /**
   * "Replace everything" (§10): clear all three tables, load the snapshot and
   * re-seed Unsorted, all or nothing. Validation happens before the call.
   */
  replaceAll(data: LibrarySnapshot, now: number): Promise<void>
}

export function createLibraryRepo(database: CardioDb = db): LibraryRepo {
  return {
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
