import { cardRepo } from '@/db/repositories/cards'
import { deckRepo } from '@/db/repositories/decks'
import { folderRepo } from '@/db/repositories/folders'
import { libraryRepo } from '@/db/repositories/library'
import type { CardRepo } from '@/db/repositories/cards'
import type { DeckRepo } from '@/db/repositories/decks'
import type { FolderRepo } from '@/db/repositories/folders'
import type { LibraryRepo } from '@/db/repositories/library'

export interface Repositories {
  folders: FolderRepo
  decks: DeckRepo
  cards: CardRepo
  library: LibraryRepo
}

/**
 * The repositories every store reads and writes through, in one record so that a
 * spec can point them at a throwaway database (see `src/test/repositories.ts`).
 * Application code only ever reads it.
 */
export const repositories: Repositories = {
  folders: folderRepo,
  decks: deckRepo,
  cards: cardRepo,
  library: libraryRepo,
}
