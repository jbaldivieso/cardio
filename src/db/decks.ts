import { db } from '@/db'
import type { CardioDb } from '@/db'
import { durableWrite } from '@/db/persistence'
import { byName } from '@/db/sorting'
import type { Deck } from '@/domain/models'
import { validateName, ValidationError } from '@/domain/validation'

export interface DeckRepo {
  /** Every deck, for the custom quiz builder (§7.5). */
  list(): Promise<Deck[]>
  listByFolder(folderId: string): Promise<Deck[]>
  get(id: string): Promise<Deck | undefined>
  create(folderId: string, name: string, now?: number): Promise<Deck>
  rename(id: string, name: string, now?: number): Promise<Deck>
  move(id: string, folderId: string, now?: number): Promise<Deck>
  /** Hard, cascading delete (§4.4). Silent when the deck is already gone. */
  remove(id: string): Promise<void>
  cardCount(id: string): Promise<number>
}

export function createDeckRepo(database: CardioDb = db): DeckRepo {
  /** §4.2: every deck.folderId references a folder that exists. */
  async function requireFolder(folderId: string): Promise<void> {
    const folder = await database.folders.get(folderId)
    if (!folder) throw new ValidationError('folderId', 'That folder no longer exists.')
  }

  async function requireDeck(id: string): Promise<Deck> {
    const deck = await database.decks.get(id)
    if (!deck) throw new ValidationError('id', 'That deck no longer exists.')
    return deck
  }

  return {
    async list(): Promise<Deck[]> {
      return (await database.decks.toArray()).sort(byName)
    },

    async listByFolder(folderId: string): Promise<Deck[]> {
      return (await database.decks.where('folderId').equals(folderId).toArray()).sort(byName)
    },

    get(id: string): Promise<Deck | undefined> {
      return database.decks.get(id)
    },

    async create(folderId: string, name: string, now: number = Date.now()): Promise<Deck> {
      const validated = validateName(name)
      return durableWrite(database, () =>
        database.transaction('rw', database.folders, database.decks, async () => {
          await requireFolder(folderId)
          const deck: Deck = {
            id: crypto.randomUUID(),
            folderId,
            name: validated,
            createdAt: now,
            updatedAt: now,
          }
          await database.decks.add(deck)
          return deck
        }),
      )
    },

    async rename(id: string, name: string, now: number = Date.now()): Promise<Deck> {
      const validated = validateName(name)
      return durableWrite(database, () =>
        database.transaction('rw', database.decks, async () => {
          const renamed: Deck = { ...(await requireDeck(id)), name: validated, updatedAt: now }
          await database.decks.put(renamed)
          return renamed
        }),
      )
    },

    async move(id: string, folderId: string, now: number = Date.now()): Promise<Deck> {
      return durableWrite(database, () =>
        database.transaction('rw', database.folders, database.decks, async () => {
          const deck = await requireDeck(id)
          await requireFolder(folderId)
          const moved: Deck = { ...deck, folderId, updatedAt: now }
          await database.decks.put(moved)
          return moved
        }),
      )
    },

    async remove(id: string): Promise<void> {
      await durableWrite(database, () =>
        database.transaction('rw', database.decks, database.cards, async () => {
          await database.cards.where('deckId').equals(id).delete()
          await database.decks.delete(id)
        }),
      )
    },

    cardCount(id: string): Promise<number> {
      return database.cards.where('deckId').equals(id).count()
    },
  }
}

/** The repository the app uses; tests build their own against a throwaway database. */
export const deckRepo = createDeckRepo()
