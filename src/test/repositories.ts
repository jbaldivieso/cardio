/**
 * Points the stores at a throwaway database for the length of one spec file.
 *
 * Every spec needs its own database name (CLAUDE.md > Gotchas), which means the
 * repository singletons the stores import cannot be the ones bound to the real
 * `db`. `src/stores/repositories.ts` is the seam that makes the swap possible;
 * this is the only place that uses it.
 */

import { afterEach, beforeEach } from 'vitest'
import { CardioDb } from '@/db'
import { createCardRepo } from '@/db/repositories/cards'
import { createDeckRepo } from '@/db/repositories/decks'
import { createFolderRepo } from '@/db/repositories/folders'
import { createLibraryRepo } from '@/db/repositories/library'
import { repositories } from '@/stores/repositories'

export interface TestDatabase {
  /** The current spec's database. A fresh one per test. */
  readonly db: CardioDb
}

/** Call once at the top of a `describe`; the database is replaced before each test. */
export function useTestDatabase(): TestDatabase {
  const defaults = { ...repositories }
  let db: CardioDb

  beforeEach(() => {
    db = new CardioDb(`cardio-test-${crypto.randomUUID()}`)
    repositories.folders = createFolderRepo(db)
    repositories.decks = createDeckRepo(db)
    repositories.cards = createCardRepo(db)
    repositories.library = createLibraryRepo(db)
  })

  afterEach(async () => {
    Object.assign(repositories, defaults)
    await db.delete()
  })

  return {
    get db() {
      return db
    },
  }
}
