import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { UNSORTED_FOLDER_ID, seedDefaults } from '@/db'
import { useCardsStore } from '@/stores/cards'
import { repositories } from '@/stores/repositories'
import { useTestDatabase } from '@/test/repositories'

describe('cards store', () => {
  const test = useTestDatabase()
  let deckId: string

  beforeEach(async () => {
    setActivePinia(createPinia())
    await seedDefaults(test.db, 1000)
    deckId = (await repositories.decks.create(UNSORTED_FOLDER_ID, 'Verbs', 1000)).id
  })

  describe('load', () => {
    it("lists the deck's cards, newest first", async () => {
      await repositories.cards.create(deckId, { front: 'ser', back: 'to be' }, 1000)
      await repositories.cards.create(deckId, { front: 'ir', back: 'to go' }, 2000)
      const store = useCardsStore()

      await store.load(deckId)

      expect(store.cards.map((card) => card.front)).toEqual(['ir', 'ser'])
    })

    it('leaves an empty deck empty', async () => {
      const store = useCardsStore()

      await store.load(deckId)

      expect(store.cards).toEqual([])
      expect(store.loading).toBe(false)
    })

    it('replaces the list when a different deck is loaded', async () => {
      const other = await repositories.decks.create(UNSORTED_FOLDER_ID, 'Nouns', 1000)
      await repositories.cards.create(deckId, { front: 'ser', back: 'to be' }, 1000)
      await repositories.cards.create(other.id, { front: 'gato', back: 'cat' }, 1000)
      const store = useCardsStore()

      await store.load(deckId)
      await store.load(other.id)

      expect(store.cards.map((card) => card.front)).toEqual(['gato'])
    })

    it('surfaces a rejected read as an error', async () => {
      vi.spyOn(repositories.cards, 'listByDeck').mockRejectedValue(new Error('IndexedDB is gone.'))
      const store = useCardsStore()

      await store.load(deckId)

      expect(store.error).toBe('IndexedDB is gone.')
      expect(store.cards).toEqual([])
    })
  })

  describe('create', () => {
    it('puts the new card at the top of the list', async () => {
      const store = useCardsStore()
      await store.load(deckId)
      await store.create(deckId, { front: 'ser', back: 'to be' })

      await store.create(deckId, { front: 'ir', back: 'to go' })

      expect(store.cards.map((card) => card.front)).toEqual(['ir', 'ser'])
    })

    it('persists the card', async () => {
      const store = useCardsStore()
      await store.load(deckId)

      await store.create(deckId, { front: 'ser', back: 'to be' })
      await store.load(deckId)

      expect(store.cards.map((card) => card.front)).toEqual(['ser'])
    })

    it('sets error and writes nothing when a face is empty', async () => {
      const store = useCardsStore()
      await store.load(deckId)

      await store.create(deckId, { front: 'ser', back: '  ' })

      expect(store.error).toBe('Back cannot be empty.')
      expect(store.cards).toEqual([])
    })
  })

  describe('createMany', () => {
    it('adds every card of the batch', async () => {
      const store = useCardsStore()
      await store.load(deckId)

      await store.createMany(deckId, [
        { front: 'ser', back: 'to be' },
        { front: 'ir', back: 'to go' },
      ])

      expect(store.cards).toHaveLength(2)
    })

    it('persists the batch', async () => {
      const store = useCardsStore()
      await store.load(deckId)

      await store.createMany(deckId, [{ front: 'ser', back: 'to be' }])
      await store.load(deckId)

      expect(store.cards.map((card) => card.front)).toEqual(['ser'])
    })

    it('writes none of the batch when one card is invalid', async () => {
      const store = useCardsStore()
      await store.load(deckId)

      await store.createMany(deckId, [
        { front: 'ser', back: 'to be' },
        { front: '', back: 'to go' },
      ])

      expect(store.error).toBe('Front cannot be empty.')
      await store.load(deckId)
      expect(store.cards).toEqual([])
    })
  })

  describe('update', () => {
    it('changes the card in place and persists it', async () => {
      const card = await repositories.cards.create(deckId, { front: 'ser', back: 'to be' }, 1000)
      const store = useCardsStore()
      await store.load(deckId)

      await store.update(card.id, { front: 'ser', back: 'to be, permanently' })
      await store.load(deckId)

      expect(store.cards[0].back).toBe('to be, permanently')
    })

    it('sets error and changes nothing when the card is gone', async () => {
      const store = useCardsStore()
      await store.load(deckId)

      await store.update('missing', { front: 'a', back: 'b' })

      expect(store.error).toBe('That card no longer exists.')
    })
  })

  describe('remove', () => {
    it('drops the card from the list and the database', async () => {
      const card = await repositories.cards.create(deckId, { front: 'ser', back: 'to be' }, 1000)
      const store = useCardsStore()
      await store.load(deckId)

      await store.remove(card.id)

      expect(store.cards).toEqual([])
      await store.load(deckId)
      expect(store.cards).toEqual([])
    })
  })

  describe('find', () => {
    it('reads a single card for the editor', async () => {
      const card = await repositories.cards.create(deckId, { front: 'ser', back: 'to be' }, 1000)
      const store = useCardsStore()

      expect(await store.find(card.id)).toMatchObject({ front: 'ser', back: 'to be' })
    })

    it('has nothing for an id that is not there', async () => {
      const store = useCardsStore()

      expect(await store.find('missing')).toBeUndefined()
    })
  })
})
