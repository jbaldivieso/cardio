import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Card } from '@/domain/models'
import { defaultQuizConfig } from '@/domain/quiz'
import type { QuizConfig } from '@/domain/quiz'
import { useQuizStore } from '@/stores/quiz'
import { repositories } from '@/stores/repositories'
import { useTestDatabase } from '@/test/repositories'

/** Any fixed instant; the store reads the clock, the tests pin it. */
const NOW = 7_000_000

describe('quiz store', () => {
  useTestDatabase()
  let folderId: string
  let deckId: string
  let pool: Card[]

  /** Three cards, each already answered once, so undo has something to restore. */
  async function seedPool(count: number): Promise<Card[]> {
    for (let i = 0; i < count; i++) {
      const card = await repositories.cards.create(deckId, { front: `q${i}`, back: `a${i}` }, 1000)
      await repositories.cards.recordAttempt(card.id, true, 2000)
    }
    return repositories.cards.listByDecks([deckId])
  }

  function configFor(overrides: Partial<QuizConfig> = {}): QuizConfig {
    return { deckIds: [deckId], direction: 'front', tier: 4, size: 20, ...overrides }
  }

  /** One full answer: reveal, then grade. Grading is refused before the flip. */
  async function answerCard(got: boolean): Promise<void> {
    const store = useQuizStore()
    store.flip()
    await store.answer(got)
  }

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
    localStorage.clear()
    folderId = (await repositories.folders.create('Spanish', 1000)).id
    deckId = (await repositories.decks.create(folderId, 'Verbs', 1000)).id
    pool = await seedPool(3)
  })

  describe('start', () => {
    it('runs from the first card, unflipped', () => {
      const store = useQuizStore()

      store.start(pool, configFor())

      expect(store.phase).toBe('running')
      expect(store.index).toBe(0)
      expect(store.flipped).toBe(false)
      expect(store.current?.id).toBe(store.cards[0].id)
    })

    it('asks every card of a pool smaller than the size', () => {
      const store = useQuizStore()

      store.start(pool, configFor())

      expect(store.cards).toHaveLength(3)
      expect(store.total).toBe(3)
    })

    it('keeps the direction the session was configured with', () => {
      const store = useQuizStore()

      store.start(pool, configFor({ direction: 'back' }))

      expect(store.direction).toBe('back')
    })

    it('stays out of the running state when the pool yields no cards', () => {
      const store = useQuizStore()

      store.start([], configFor())

      expect(store.phase).toBe('configuring')
      expect(store.cards).toEqual([])
    })
  })

  describe('flip', () => {
    it('reveals the other face', () => {
      const store = useQuizStore()
      store.start(pool, configFor())

      store.flip()

      expect(store.flipped).toBe(true)
    })

    it('refuses a grade before the card is revealed', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())
      const card = store.current as Card

      await store.answer(true)

      expect(store.answers).toEqual([])
      expect(store.index).toBe(0)
      expect((await repositories.cards.get(card.id))?.stats.gets).toBe(1)
    })
  })

  describe('answer', () => {
    it('writes the attempt through the repository straight away', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())
      const card = store.current as Card

      await answerCard(true)

      expect((await repositories.cards.get(card.id))?.stats).toEqual({
        gets: 2,
        misses: 0,
        history: [
          { at: 2000, got: true },
          { at: NOW, got: true },
        ],
        lastSeenAt: NOW,
      })
    })

    it('records what was answered', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())
      const card = store.current as Card

      await answerCard(false)

      expect(store.answers).toHaveLength(1)
      expect(store.answers[0].card.id).toBe(card.id)
      expect(store.answers[0].got).toBe(false)
    })

    it('advances to the next card, face down', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())

      await answerCard(true)

      expect(store.index).toBe(1)
      expect(store.flipped).toBe(false)
      expect(store.current?.id).toBe(store.cards[1].id)
    })

    it('leaves the card content alone, so a quiz never reorders a deck', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())
      const card = store.current as Card

      await answerCard(true)

      expect((await repositories.cards.get(card.id))?.updatedAt).toBe(1000)
    })

    it('records one answer when a card is graded twice before the write lands', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())
      const card = store.current as Card
      store.flip()

      // A fast double tap, or Space re-activating the button the pointer just
      // used: both grades arrive before the first write comes back.
      await Promise.all([store.answer(true), store.answer(true)])

      expect(store.answers).toHaveLength(1)
      expect(store.index).toBe(1)
      expect((await repositories.cards.get(card.id))?.stats.gets).toBe(2)
    })

    it('completes the session on the last card', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())

      await answerCard(true)
      await answerCard(true)
      await answerCard(false)

      expect(store.phase).toBe('complete')
    })
  })

  describe('summary', () => {
    it('totals the answers and their accuracy', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())

      await answerCard(true)
      await answerCard(false)
      await answerCard(true)

      expect(store.summary).toMatchObject({ answered: 3, got: 2, missed: 1, accuracy: 67 })
    })

    it('lists the cards that were missed', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())
      const missed = store.current as Card

      await answerCard(false)
      await answerCard(true)
      await answerCard(true)

      expect(store.summary.missedCards.map((card) => card.id)).toEqual([missed.id])
    })

    it('reads zero accuracy before anything is answered', () => {
      const store = useQuizStore()
      store.start(pool, configFor())

      expect(store.summary).toMatchObject({ answered: 0, got: 0, missed: 0, accuracy: 0 })
    })
  })

  describe('signoff', () => {
    it('has nothing to say until a session finishes', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())

      await answerCard(true)

      expect(store.signoff).toBeNull()
    })

    it('draws a headline and a verdict fitting the score when the session ends', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      const store = useQuizStore()
      store.start(pool, configFor())

      await answerCard(true)
      await answerCard(true)
      await answerCard(true)

      expect(store.signoff).toEqual({ headline: 'All done! 💪🏻', verdict: 'Nailed them all!' })
    })

    it('reads the score, not the accuracy on screen', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      const store = useQuizStore()
      store.start(pool, configFor())

      await answerCard(true)
      await answerCard(false)
      await answerCard(true)

      expect(store.signoff?.verdict).toBe('Not terrible!')
    })

    it('is cleared by abandoning the session', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())
      await answerCard(true)
      await answerCard(true)
      await answerCard(true)

      store.abandon()

      expect(store.signoff).toBeNull()
    })

    it('is cleared by starting a second pass over the missed cards', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())
      await answerCard(false)
      await answerCard(true)
      await answerCard(true)

      store.quizMissed()

      expect(store.signoff).toBeNull()
    })
  })

  describe('undo', () => {
    it('is unavailable on the first card', () => {
      const store = useQuizStore()
      store.start(pool, configFor())

      expect(store.canUndo).toBe(false)
    })

    it('restores the statistics the card had before the answer', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())
      const card = store.current as Card
      const before = (await repositories.cards.get(card.id))?.stats

      await answerCard(false)
      await store.undo()

      expect((await repositories.cards.get(card.id))?.stats).toEqual(before)
    })

    it('steps back to that card and shows it revealed', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())
      const card = store.current as Card

      await answerCard(false)
      await store.undo()

      expect(store.index).toBe(0)
      expect(store.current?.id).toBe(card.id)
      expect(store.flipped).toBe(true)
    })

    it('drops the answer it undid', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())

      await answerCard(false)
      await store.undo()

      expect(store.answers).toEqual([])
    })

    it('is spent once used', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())

      await answerCard(false)
      await store.undo()

      expect(store.canUndo).toBe(false)
    })

    it('applies to the immediately previous card only', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())
      const first = store.current as Card

      await answerCard(false)
      const second = store.current as Card
      await answerCard(false)
      await store.undo()

      expect(store.index).toBe(1)
      expect(store.current?.id).toBe(second.id)
      expect(store.answers.map((answer) => answer.card.id)).toEqual([first.id])
      expect((await repositories.cards.get(first.id))?.stats.misses).toBe(1)
    })

    it('undoes once when undo is pressed twice before the write lands', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())
      const first = store.current as Card

      await answerCard(false)
      const second = store.current as Card
      await answerCard(false)
      await Promise.all([store.undo(), store.undo()])

      expect(store.index).toBe(1)
      expect(store.current?.id).toBe(second.id)
      expect(store.answers.map((answer) => answer.card.id)).toEqual([first.id])
    })

    it('does nothing when there is nothing to undo', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())

      await store.undo()

      expect(store.index).toBe(0)
      expect(store.answers).toEqual([])
    })
  })

  describe('quizMissed', () => {
    it('asks exactly the cards that were missed', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())
      const first = store.current as Card
      await answerCard(false)
      const second = store.current as Card
      await answerCard(true)
      const third = store.current as Card
      await answerCard(false)

      store.quizMissed()

      expect(store.cards.map((card) => card.id).sort()).toEqual([first.id, third.id].sort())
      expect(store.cards.map((card) => card.id)).not.toContain(second.id)
    })

    it('runs the new session from the top, unflipped and unanswered', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())
      await answerCard(false)
      await answerCard(false)
      await answerCard(false)

      store.quizMissed()

      expect(store.phase).toBe('running')
      expect(store.index).toBe(0)
      expect(store.flipped).toBe(false)
      expect(store.answers).toEqual([])
    })

    it('keeps the direction of the session it came from', async () => {
      const store = useQuizStore()
      store.start(pool, configFor({ direction: 'back' }))
      await answerCard(false)
      await answerCard(true)
      await answerCard(true)

      store.quizMissed()

      expect(store.direction).toBe('back')
    })

    it('does nothing when nothing was missed', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())
      await answerCard(true)
      await answerCard(true)
      await answerCard(true)

      store.quizMissed()

      expect(store.phase).toBe('complete')
    })
  })

  describe('abandon', () => {
    it('clears the session', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())
      await answerCard(true)

      store.abandon()

      expect(store.phase).toBe('configuring')
      expect(store.cards).toEqual([])
      expect(store.answers).toEqual([])
      expect(store.current).toBeNull()
    })

    it('leaves the answers already given recorded', async () => {
      const store = useQuizStore()
      store.start(pool, configFor())
      const card = store.current as Card
      await answerCard(true)

      store.abandon()

      expect((await repositories.cards.get(card.id))?.stats).toMatchObject({
        gets: 2,
        lastSeenAt: NOW,
      })
    })
  })

  describe('launch', () => {
    it('reads the pool from the decks it was given and runs it', async () => {
      const store = useQuizStore()

      const started = await store.launch(configFor(), { name: 'home' })

      expect(started).toBe(true)
      expect(store.phase).toBe('running')
      expect(store.cards).toHaveLength(3)
    })

    it('remembers where it was launched from', async () => {
      const store = useQuizStore()

      await store.launch(configFor(), { name: 'deck', params: { deckId } })

      expect(store.origin).toEqual({ name: 'deck', params: { deckId } })
    })

    it('refuses to start a session with nothing in it', async () => {
      const store = useQuizStore()
      const empty = (await repositories.decks.create(folderId, 'Empty', 1000)).id

      const started = await store.launch(configFor({ deckIds: [empty] }), { name: 'home' })

      expect(started).toBe(false)
      expect(store.phase).toBe('configuring')
    })

    it('reports a failed read rather than starting', async () => {
      const store = useQuizStore()
      vi.spyOn(repositories.cards, 'listByDecks').mockRejectedValue(new Error('Database is gone.'))

      const started = await store.launch(configFor(), { name: 'home' })

      expect(started).toBe(false)
      expect(store.error).toBe('Database is gone.')
    })
  })

  describe('quickstart', () => {
    it('uses the defaults of spec §6.1, not what was last configured', async () => {
      localStorage.setItem(
        'cardio.quizConfig',
        JSON.stringify({ deckIds: ['other'], direction: 'back', tier: 7, size: 50 }),
      )
      const store = useQuizStore()

      await store.quickstart([deckId], { name: 'home' })

      expect(store.direction).toBe('front')
      expect(store.cards).toHaveLength(3)
    })

    it('does not start on a deck with no cards', async () => {
      const store = useQuizStore()
      const empty = (await repositories.decks.create(folderId, 'Empty', 1000)).id

      expect(await store.quickstart([empty], { name: 'home' })).toBe(false)
    })
  })

  describe('the remembered config', () => {
    it('starts from the defaults when nothing has been saved', () => {
      expect(useQuizStore().loadConfig()).toEqual(defaultQuizConfig())
    })

    it('round-trips through localStorage', () => {
      const store = useQuizStore()
      const config = configFor({ direction: 'back', tier: 6, size: 'all' })

      store.saveConfig(config)

      expect(store.loadConfig()).toEqual(config)
    })

    it('writes it under the key spec §6.1 names', () => {
      const store = useQuizStore()

      store.saveConfig(configFor())

      expect(JSON.parse(localStorage.getItem('cardio.quizConfig') ?? 'null')).toEqual(configFor())
    })

    it('falls back to the defaults when what is stored is corrupt', () => {
      localStorage.setItem('cardio.quizConfig', '{ not json')

      expect(useQuizStore().loadConfig()).toEqual(defaultQuizConfig())
    })

    it('survives a storage that refuses to be read', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage is disabled.')
      })

      expect(useQuizStore().loadConfig()).toEqual(defaultQuizConfig())
    })

    it('survives a storage that refuses to be written', () => {
      const store = useQuizStore()
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage is full.')
      })

      expect(() => store.saveConfig(configFor())).not.toThrow()
    })
  })
})
