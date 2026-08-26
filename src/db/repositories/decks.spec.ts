import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CardioDb } from '@/db'
import { createDeckRepo } from '@/db/repositories/decks'
import { emptyStats } from '@/domain/models'
import { ValidationError } from '@/domain/validation'

describe('deck repository', () => {
  let db: CardioDb
  let decks: ReturnType<typeof createDeckRepo>

  beforeEach(async () => {
    db = new CardioDb(`cardio-test-${crypto.randomUUID()}`)
    decks = createDeckRepo(db)
    await db.folders.bulkAdd([
      { id: 'folder-1', name: 'Spanish', createdAt: 1, updatedAt: 1 },
      { id: 'folder-2', name: 'German', createdAt: 1, updatedAt: 1 },
    ])
  })

  afterEach(async () => {
    await db.delete()
  })

  async function seedCards(deckId: string, cardIds: string[]): Promise<void> {
    await db.cards.bulkAdd(
      cardIds.map((id) => ({
        id,
        deckId,
        front: 'f',
        back: 'b',
        createdAt: 1,
        updatedAt: 1,
        stats: emptyStats(),
      })),
    )
  }

  describe('create', () => {
    it('stores a deck in its folder with both timestamps at the given moment', async () => {
      const deck = await decks.create('folder-1', '  Verbs  ', 5000)

      expect(await db.decks.get(deck.id)).toEqual({
        id: deck.id,
        folderId: 'folder-1',
        name: 'Verbs',
        createdAt: 5000,
        updatedAt: 5000,
      })
    })

    it('rejects a blank name without writing anything', async () => {
      await expect(decks.create('folder-1', ' ', 5000)).rejects.toThrow(ValidationError)
      expect(await db.decks.count()).toBe(0)
    })

    it('refuses to put a deck in a folder that does not exist', async () => {
      await expect(decks.create('gone', 'Verbs', 5000)).rejects.toThrow(
        expect.objectContaining({ field: 'folderId' }),
      )
      expect(await db.decks.count()).toBe(0)
    })
  })

  describe('listByFolder', () => {
    it('returns only that folder’s decks, ordered by name ignoring case', async () => {
      await decks.create('folder-1', 'verbs', 1000)
      await decks.create('folder-1', 'Adjectives', 2000)
      await decks.create('folder-2', 'Nouns', 3000)

      expect((await decks.listByFolder('folder-1')).map((deck) => deck.name)).toEqual([
        'Adjectives',
        'verbs',
      ])
    })

    it('returns an empty list for a folder with no decks', async () => {
      expect(await decks.listByFolder('folder-2')).toEqual([])
    })
  })

  describe('list', () => {
    it('returns every deck, ordered by name, for the custom quiz builder', async () => {
      await decks.create('folder-1', 'verbs', 1000)
      await decks.create('folder-2', 'Nouns', 2000)

      expect((await decks.list()).map((deck) => deck.name)).toEqual(['Nouns', 'verbs'])
    })
  })

  describe('get', () => {
    it('returns undefined for an id that is not there', async () => {
      expect(await decks.get('nope')).toBeUndefined()
    })
  })

  describe('rename', () => {
    it('bumps updatedAt and keeps createdAt and the folder', async () => {
      const deck = await decks.create('folder-1', 'Verbs', 5000)

      expect(await decks.rename(deck.id, 'Verbos', 9000)).toEqual({
        id: deck.id,
        folderId: 'folder-1',
        name: 'Verbos',
        createdAt: 5000,
        updatedAt: 9000,
      })
    })

    it('reports a deck that is no longer there', async () => {
      await expect(decks.rename('gone', 'Verbos', 9000)).rejects.toThrow(ValidationError)
    })
  })

  describe('move', () => {
    it('reassigns the folder and bumps updatedAt', async () => {
      const deck = await decks.create('folder-1', 'Verbs', 5000)

      expect(await decks.move(deck.id, 'folder-2', 9000)).toEqual({
        id: deck.id,
        folderId: 'folder-2',
        name: 'Verbs',
        createdAt: 5000,
        updatedAt: 9000,
      })
    })

    it('refuses a destination folder that does not exist, leaving the deck where it was', async () => {
      const deck = await decks.create('folder-1', 'Verbs', 5000)

      await expect(decks.move(deck.id, 'gone', 9000)).rejects.toThrow(
        expect.objectContaining({ field: 'folderId' }),
      )
      expect((await db.decks.get(deck.id))?.folderId).toBe('folder-1')
    })

    it('reports a deck that is no longer there', async () => {
      await expect(decks.move('gone', 'folder-2', 9000)).rejects.toThrow(ValidationError)
    })
  })

  describe('remove', () => {
    it('deletes the deck together with its cards', async () => {
      const doomed = await decks.create('folder-1', 'Verbs', 1000)
      const keeper = await decks.create('folder-1', 'Nouns', 1000)
      await seedCards(doomed.id, ['card-1', 'card-2'])
      await seedCards(keeper.id, ['card-3'])

      await decks.remove(doomed.id)

      expect((await db.decks.toArray()).map((row) => row.id)).toEqual([keeper.id])
      expect((await db.cards.toArray()).map((row) => row.id)).toEqual(['card-3'])
    })

    it('leaves the folder itself in place', async () => {
      const deck = await decks.create('folder-1', 'Verbs', 1000)

      await decks.remove(deck.id)

      expect(await db.folders.get('folder-1')).toBeDefined()
    })

    it('is a no-op for a deck that is already gone', async () => {
      await expect(decks.remove('gone')).resolves.toBeUndefined()
    })
  })

  describe('cardCount', () => {
    it('counts the cards a delete would take with it', async () => {
      const deck = await decks.create('folder-1', 'Verbs', 1000)
      await seedCards(deck.id, ['card-1', 'card-2'])

      expect(await decks.cardCount(deck.id)).toBe(2)
    })

    it('counts nothing for an empty deck', async () => {
      const deck = await decks.create('folder-1', 'Verbs', 1000)

      expect(await decks.cardCount(deck.id)).toBe(0)
    })
  })
})
