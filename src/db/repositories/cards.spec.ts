import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CardioDb } from '@/db'
import { createCardRepo } from '@/db/repositories/cards'
import { MASTERY_HISTORY_LIMIT, emptyStats, type CardStats } from '@/domain/models'
import { ValidationError } from '@/domain/validation'

describe('card repository', () => {
  let db: CardioDb
  let cards: ReturnType<typeof createCardRepo>

  beforeEach(async () => {
    db = new CardioDb(`cardio-test-${crypto.randomUUID()}`)
    cards = createCardRepo(db)
    await db.folders.add({ id: 'folder-1', name: 'Spanish', createdAt: 1, updatedAt: 1 })
    await db.decks.bulkAdd([
      { id: 'deck-1', folderId: 'folder-1', name: 'Verbs', createdAt: 1, updatedAt: 1 },
      { id: 'deck-2', folderId: 'folder-1', name: 'Nouns', createdAt: 1, updatedAt: 1 },
    ])
  })

  afterEach(async () => {
    await db.delete()
  })

  describe('create', () => {
    it('stores a card with trimmed faces, matching timestamps and no history yet', async () => {
      const card = await cards.create('deck-1', { front: '  hablar  ', back: '  to speak  ' }, 5000)

      expect(await db.cards.get(card.id)).toEqual({
        id: card.id,
        deckId: 'deck-1',
        front: 'hablar',
        back: 'to speak',
        createdAt: 5000,
        updatedAt: 5000,
        stats: emptyStats(),
      })
    })

    it('rejects an empty front without writing anything', async () => {
      await expect(cards.create('deck-1', { front: ' ', back: 'to speak' }, 5000)).rejects.toThrow(
        expect.objectContaining({ field: 'front' }),
      )
      expect(await db.cards.count()).toBe(0)
    })

    it('rejects an empty back without writing anything', async () => {
      await expect(cards.create('deck-1', { front: 'hablar', back: '' }, 5000)).rejects.toThrow(
        expect.objectContaining({ field: 'back' }),
      )
      expect(await db.cards.count()).toBe(0)
    })

    it('rejects a face over the length limit', async () => {
      const front = 'a'.repeat(4001)

      await expect(cards.create('deck-1', { front, back: 'to speak' }, 5000)).rejects.toThrow(
        ValidationError,
      )
    })

    it('refuses to put a card in a deck that does not exist', async () => {
      await expect(
        cards.create('gone', { front: 'hablar', back: 'to speak' }, 5000),
      ).rejects.toThrow(expect.objectContaining({ field: 'deckId' }))
      expect(await db.cards.count()).toBe(0)
    })
  })

  describe('createMany', () => {
    it('stores every card of a bulk add', async () => {
      const created = await cards.createMany(
        'deck-1',
        [
          { front: 'hablar', back: 'to speak' },
          { front: '  comer  ', back: '  to eat  ' },
        ],
        5000,
      )

      expect(created.map((card) => [card.front, card.back])).toEqual([
        ['hablar', 'to speak'],
        ['comer', 'to eat'],
      ])
      expect(await db.cards.count()).toBe(2)
    })

    it('writes nothing at all when one of the cards is invalid', async () => {
      await expect(
        cards.createMany(
          'deck-1',
          [
            { front: 'hablar', back: 'to speak' },
            { front: 'comer', back: '   ' },
          ],
          5000,
        ),
      ).rejects.toThrow(ValidationError)
      expect(await db.cards.count()).toBe(0)
    })

    it('refuses a deck that does not exist', async () => {
      await expect(
        cards.createMany('gone', [{ front: 'hablar', back: 'to speak' }], 5000),
      ).rejects.toThrow(expect.objectContaining({ field: 'deckId' }))
    })

    it('accepts an empty list and writes nothing', async () => {
      await expect(cards.createMany('deck-1', [], 5000)).resolves.toEqual([])
      expect(await db.cards.count()).toBe(0)
    })
  })

  describe('listByDeck', () => {
    it('returns the deck’s cards newest first', async () => {
      await cards.create('deck-1', { front: 'older', back: 'b' }, 1000)
      await cards.create('deck-1', { front: 'newer', back: 'b' }, 2000)
      await cards.create('deck-2', { front: 'elsewhere', back: 'b' }, 1500)

      expect((await cards.listByDeck('deck-1')).map((card) => card.front)).toEqual([
        'newer',
        'older',
      ])
    })

    it('returns an empty list for a deck with no cards', async () => {
      expect(await cards.listByDeck('deck-2')).toEqual([])
    })
  })

  describe('listByDecks', () => {
    it('gathers the quiz pool across several decks', async () => {
      await cards.create('deck-1', { front: 'one', back: 'b' }, 1000)
      await cards.create('deck-2', { front: 'two', back: 'b' }, 2000)

      expect((await cards.listByDecks(['deck-1', 'deck-2'])).map((card) => card.front)).toEqual([
        'two',
        'one',
      ])
    })

    it('leaves out decks that were not selected', async () => {
      await cards.create('deck-1', { front: 'one', back: 'b' }, 1000)
      await cards.create('deck-2', { front: 'two', back: 'b' }, 2000)

      expect((await cards.listByDecks(['deck-2'])).map((card) => card.front)).toEqual(['two'])
    })

    it('returns an empty pool when no decks are selected', async () => {
      await cards.create('deck-1', { front: 'one', back: 'b' }, 1000)

      expect(await cards.listByDecks([])).toEqual([])
    })
  })

  describe('get', () => {
    it('returns undefined for an id that is not there', async () => {
      expect(await cards.get('nope')).toBeUndefined()
    })
  })

  describe('update', () => {
    it('rewrites both faces and bumps updatedAt, keeping createdAt and stats', async () => {
      const card = await cards.create('deck-1', { front: 'hablar', back: 'to speak' }, 5000)
      const stats: CardStats = {
        gets: 2,
        misses: 1,
        history: [{ at: 5, got: true }],
        lastSeenAt: 5,
      }
      await cards.saveStats(card.id, stats)

      const updated = await cards.update(card.id, { front: 'hablar ', back: ' to talk' }, 9000)

      expect(updated).toEqual({
        id: card.id,
        deckId: 'deck-1',
        front: 'hablar',
        back: 'to talk',
        createdAt: 5000,
        updatedAt: 9000,
        stats,
      })
    })

    it('rejects an empty face and leaves the stored card intact', async () => {
      const card = await cards.create('deck-1', { front: 'hablar', back: 'to speak' }, 5000)

      await expect(cards.update(card.id, { front: 'hablar', back: ' ' }, 9000)).rejects.toThrow(
        ValidationError,
      )
      expect(await db.cards.get(card.id)).toMatchObject({ back: 'to speak', updatedAt: 5000 })
    })

    it('reports a card that is no longer there', async () => {
      await expect(
        cards.update('gone', { front: 'hablar', back: 'to speak' }, 9000),
      ).rejects.toThrow(ValidationError)
    })
  })

  describe('remove', () => {
    it('deletes just that card', async () => {
      const doomed = await cards.create('deck-1', { front: 'hablar', back: 'b' }, 1000)
      const keeper = await cards.create('deck-1', { front: 'comer', back: 'b' }, 2000)

      await cards.remove(doomed.id)

      expect((await db.cards.toArray()).map((card) => card.id)).toEqual([keeper.id])
    })

    it('is a no-op for a card that is already gone', async () => {
      await expect(cards.remove('gone')).resolves.toBeUndefined()
    })
  })

  describe('recordAttempt', () => {
    it('counts a get, stamps the attempt and remembers when it was seen', async () => {
      const card = await cards.create('deck-1', { front: 'hablar', back: 'b' }, 5000)

      const answered = await cards.recordAttempt(card.id, true, 7000)

      expect(answered.stats).toEqual({
        gets: 1,
        misses: 0,
        history: [{ at: 7000, got: true }],
        lastSeenAt: 7000,
      })
      expect((await db.cards.get(card.id))?.stats).toEqual(answered.stats)
    })

    it('counts a miss against the other counter', async () => {
      const card = await cards.create('deck-1', { front: 'hablar', back: 'b' }, 5000)

      const answered = await cards.recordAttempt(card.id, false, 7000)

      expect(answered.stats.gets).toBe(0)
      expect(answered.stats.misses).toBe(1)
      expect(answered.stats.history).toEqual([{ at: 7000, got: false }])
    })

    it('appends to the history it already had, oldest first', async () => {
      const card = await cards.create('deck-1', { front: 'hablar', back: 'b' }, 5000)

      await cards.recordAttempt(card.id, true, 7000)
      await cards.recordAttempt(card.id, false, 8000)
      const answered = await cards.recordAttempt(card.id, true, 9000)

      expect(answered.stats.history).toEqual([
        { at: 7000, got: true },
        { at: 8000, got: false },
        { at: 9000, got: true },
      ])
      expect(answered.stats).toMatchObject({ gets: 2, misses: 1, lastSeenAt: 9000 })
    })

    it('drops the oldest attempt once the history is at the cap', async () => {
      const card = await cards.create('deck-1', { front: 'hablar', back: 'b' }, 5000)

      for (let attempt = 1; attempt <= MASTERY_HISTORY_LIMIT + 1; attempt++) {
        await cards.recordAttempt(card.id, true, attempt)
      }

      const stats = (await db.cards.get(card.id))?.stats
      expect(stats?.history).toHaveLength(MASTERY_HISTORY_LIMIT)
      // The first attempt fell off the front; the lifetime counter kept all 21.
      expect(stats?.history[0]).toEqual({ at: 2, got: true })
      expect(stats?.gets).toBe(MASTERY_HISTORY_LIMIT + 1)
    })

    it('does not bump updatedAt, so answering a quiz never reorders a listing', async () => {
      const card = await cards.create('deck-1', { front: 'hablar', back: 'b' }, 5000)

      await cards.recordAttempt(card.id, true, 7000)

      expect((await db.cards.get(card.id))?.updatedAt).toBe(5000)
    })

    it('reports a card that is no longer there', async () => {
      await expect(cards.recordAttempt('gone', true, 7000)).rejects.toThrow(ValidationError)
    })
  })

  describe('saveStats', () => {
    it('stores the new statistics', async () => {
      const card = await cards.create('deck-1', { front: 'hablar', back: 'b' }, 5000)
      const stats: CardStats = {
        gets: 1,
        misses: 0,
        history: [{ at: 7000, got: true }],
        lastSeenAt: 7000,
      }

      await cards.saveStats(card.id, stats)

      expect((await db.cards.get(card.id))?.stats).toEqual(stats)
    })

    it('does not bump updatedAt, so answering a quiz never reorders a listing', async () => {
      const card = await cards.create('deck-1', { front: 'hablar', back: 'b' }, 5000)

      await cards.saveStats(card.id, {
        gets: 1,
        misses: 0,
        history: [{ at: 7000, got: true }],
        lastSeenAt: 7000,
      })

      expect((await db.cards.get(card.id))?.updatedAt).toBe(5000)
    })

    it('keeps only the newest attempts once history is over the cap', async () => {
      const card = await cards.create('deck-1', { front: 'hablar', back: 'b' }, 5000)
      const history = Array.from({ length: MASTERY_HISTORY_LIMIT + 5 }, (_, index) => ({
        at: index + 1,
        got: true,
      }))

      await cards.saveStats(card.id, { gets: 25, misses: 0, history, lastSeenAt: 25 })

      const stored = (await db.cards.get(card.id))?.stats
      expect(stored?.history).toHaveLength(MASTERY_HISTORY_LIMIT)
      expect(stored?.history[0]).toEqual({ at: 6, got: true })
      expect(stored?.gets).toBe(25)
    })

    it('reports a card that is no longer there', async () => {
      await expect(cards.saveStats('gone', emptyStats())).rejects.toThrow(ValidationError)
    })
  })
})
