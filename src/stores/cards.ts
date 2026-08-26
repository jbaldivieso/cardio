import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CardFaces } from '@/db/repositories/cards'
import type { Card } from '@/domain/models'
import { useErrorSurface } from '@/stores/errors'
import { repositories } from '@/stores/repositories'

/**
 * The cards of the deck currently on screen (§7.3). Separate from the library
 * store because a deck's cards are the one list that is loaded per screen
 * rather than held for the whole app.
 */
export const useCardsStore = defineStore('cards', () => {
  /** Which deck `cards` belongs to; a write for any other deck leaves it alone. */
  const deckId = ref<string | null>(null)
  const cards = ref<Card[]>([])
  const loading = ref(false)
  const { error, attempt } = useErrorSurface()

  function isCurrent(id: string): boolean {
    return id === deckId.value
  }

  async function load(id: string): Promise<void> {
    deckId.value = id
    loading.value = true
    await attempt(async () => {
      cards.value = await repositories.cards.listByDeck(id)
    })
    loading.value = false
  }

  /** One card for the editor, without disturbing the loaded list. */
  async function find(cardId: string): Promise<Card | undefined> {
    return attempt(() => repositories.cards.get(cardId))
  }

  async function create(id: string, faces: CardFaces): Promise<Card | undefined> {
    return attempt(async () => {
      const created = await repositories.cards.create(id, faces, Date.now())
      // Newest first (ADR-018), so a card just typed is at the top of its deck.
      if (isCurrent(id)) cards.value = [created, ...cards.value]
      return created
    })
  }

  /** Bulk add (§9): the repository writes all of them or none of them. */
  async function createMany(id: string, faces: CardFaces[]): Promise<Card[] | undefined> {
    return attempt(async () => {
      const created = await repositories.cards.createMany(id, faces, Date.now())
      if (isCurrent(id)) cards.value = [...created, ...cards.value]
      return created
    })
  }

  async function update(cardId: string, faces: CardFaces): Promise<Card | undefined> {
    return attempt(async () => {
      const updated = await repositories.cards.update(cardId, faces, Date.now())
      cards.value = cards.value.map((card) => (card.id === cardId ? updated : card))
      return updated
    })
  }

  async function remove(cardId: string): Promise<void> {
    await attempt(async () => {
      await repositories.cards.remove(cardId)
      cards.value = cards.value.filter((card) => card.id !== cardId)
    })
  }

  return { deckId, cards, loading, error, load, find, create, createMany, update, remove }
})
