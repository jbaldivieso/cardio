import { db } from '@/db'
import type { CardioDb } from '@/db'
import { durableWrite } from '@/db/persistence'
import { byCreatedAt } from '@/db/sorting'
import { MASTERY_HISTORY_LIMIT, emptyStats } from '@/domain/models'
import type { Card, CardStats } from '@/domain/models'
import { validateFace, ValidationError } from '@/domain/validation'

/** The editable content of a card: what the editor and bulk add both produce. */
export interface CardFaces {
  front: string
  back: string
}

export interface CardRepo {
  listByDeck(deckId: string): Promise<Card[]>
  /** The quiz pool for a set of decks (§6.3). */
  listByDecks(deckIds: string[]): Promise<Card[]>
  get(id: string): Promise<Card | undefined>
  create(deckId: string, faces: CardFaces, now?: number): Promise<Card>
  /** Bulk add (§9): all of the cards or none of them. */
  createMany(deckId: string, faces: CardFaces[], now?: number): Promise<Card[]>
  /** A content edit, so this one does bump `updatedAt`. */
  update(id: string, faces: CardFaces, now?: number): Promise<Card>
  /** Silent when the card is already gone. */
  remove(id: string): Promise<void>
  /** Records a quiz answer's statistics. Never touches `updatedAt` (§4.2, §6.4). */
  saveStats(id: string, stats: CardStats): Promise<Card>
}

export function createCardRepo(database: CardioDb = db): CardRepo {
  function validate(faces: CardFaces): CardFaces {
    return {
      front: validateFace(faces.front, 'front'),
      back: validateFace(faces.back, 'back'),
    }
  }

  /** §4.2: every card.deckId references a deck that exists. */
  async function requireDeck(deckId: string): Promise<void> {
    const deck = await database.decks.get(deckId)
    if (!deck) throw new ValidationError('deckId', 'That deck no longer exists.')
  }

  async function requireCard(id: string): Promise<Card> {
    const card = await database.cards.get(id)
    if (!card) throw new ValidationError('id', 'That card no longer exists.')
    return card
  }

  function build(deckId: string, faces: CardFaces, now: number): Card {
    return {
      id: crypto.randomUUID(),
      deckId,
      ...faces,
      createdAt: now,
      updatedAt: now,
      stats: emptyStats(),
    }
  }

  return {
    async listByDeck(deckId: string): Promise<Card[]> {
      return (await database.cards.where('deckId').equals(deckId).toArray()).sort(byCreatedAt)
    },

    async listByDecks(deckIds: string[]): Promise<Card[]> {
      if (deckIds.length === 0) return []
      return (await database.cards.where('deckId').anyOf(deckIds).toArray()).sort(byCreatedAt)
    },

    get(id: string): Promise<Card | undefined> {
      return database.cards.get(id)
    },

    async create(deckId: string, faces: CardFaces, now: number = Date.now()): Promise<Card> {
      const validated = validate(faces)
      return durableWrite(database, () =>
        database.transaction('rw', database.decks, database.cards, async () => {
          await requireDeck(deckId)
          const card = build(deckId, validated, now)
          await database.cards.add(card)
          return card
        }),
      )
    },

    async createMany(
      deckId: string,
      faces: CardFaces[],
      now: number = Date.now(),
    ): Promise<Card[]> {
      // Validating up front means an invalid line rejects the batch before any
      // of it is written, which is what "imports only on explicit confirm, in
      // one transaction" (§9) is for.
      const validated = faces.map(validate)
      return durableWrite(database, () =>
        database.transaction('rw', database.decks, database.cards, async () => {
          await requireDeck(deckId)
          const created = validated.map((card) => build(deckId, card, now))
          await database.cards.bulkAdd(created)
          return created
        }),
      )
    },

    async update(id: string, faces: CardFaces, now: number = Date.now()): Promise<Card> {
      const validated = validate(faces)
      return durableWrite(database, () =>
        database.transaction('rw', database.cards, async () => {
          const updated: Card = { ...(await requireCard(id)), ...validated, updatedAt: now }
          await database.cards.put(updated)
          return updated
        }),
      )
    },

    async remove(id: string): Promise<void> {
      await durableWrite(database, () => database.cards.delete(id))
    },

    async saveStats(id: string, stats: CardStats): Promise<Card> {
      return durableWrite(database, () =>
        database.transaction('rw', database.cards, async () => {
          const card = await requireCard(id)
          // §4.2: history is capped, the lifetime counters are not. `updatedAt`
          // stays where it was — a quiz answer is not a content edit.
          const saved: Card = {
            ...card,
            stats: { ...stats, history: stats.history.slice(-MASTERY_HISTORY_LIMIT) },
          }
          await database.cards.put(saved)
          return saved
        }),
      )
    },
  }
}

/** The repository the app uses; tests build their own against a throwaway database. */
export const cardRepo = createCardRepo()
