import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { seedDefaults, UNSORTED_FOLDER_ID } from '@/db'
import { useCardsStore } from '@/stores/cards'
import { useLibraryStore } from '@/stores/library'
import { useMasteryStore } from '@/stores/mastery'
import { useQuizStore } from '@/stores/quiz'
import { repositories } from '@/stores/repositories'
import { useTestDatabase } from '@/test/repositories'

describe('mastery store', () => {
  const test = useTestDatabase()
  const DAY = 86_400_000

  beforeEach(async () => {
    setActivePinia(createPinia())
    await seedDefaults(test.db, 1000)
  })

  /** A deck of `cards` untouched cards. */
  async function seedDeck(name: string, cards: number, folderId = UNSORTED_FOLDER_ID) {
    const deck = await repositories.decks.create(folderId, name, 1000)
    for (let i = 0; i < cards; i += 1) {
      await repositories.cards.create(deck.id, { front: `front ${i}`, back: `back ${i}` }, 1000)
    }
    return deck.id
  }

  /** Five clean gets, which is spec §5.4's mastery 100 when they are recent. */
  async function answerFiveTimes(deckId: string, at: number): Promise<void> {
    const [card] = await repositories.cards.listByDeck(deckId)
    for (let i = 0; i < 5; i += 1) {
      await repositories.cards.recordAttempt(card.id, true, at)
    }
  }

  it('has no summary for a deck it has not read', async () => {
    const deckId = await seedDeck('Verbs', 2)
    const mastery = useMasteryStore()

    expect(mastery.deckSummary(deckId)).toBeUndefined()
  })

  it('summarises a deck once it has read it', async () => {
    const deckId = await seedDeck('Verbs', 2)
    const mastery = useMasteryStore()

    await mastery.ensure([deckId])

    expect(mastery.deckSummary(deckId)).toEqual({
      total: 2,
      new: 2,
      learning: 0,
      mastered: 0,
      masteredPct: 0,
    })
  })

  it('reads a deck once, however often its summary is asked for', async () => {
    const deckId = await seedDeck('Verbs', 2)
    const reads = vi.spyOn(repositories.cards, 'listByDecks')
    const mastery = useMasteryStore()

    await mastery.ensure([deckId])
    await mastery.ensure([deckId])
    mastery.deckSummary(deckId)
    mastery.deckSummary(deckId)

    expect(reads).toHaveBeenCalledTimes(1)
  })

  it('reads only the decks it has not summarised yet', async () => {
    const verbs = await seedDeck('Verbs', 2)
    const nouns = await seedDeck('Nouns', 1)
    const reads = vi.spyOn(repositories.cards, 'listByDecks')
    const mastery = useMasteryStore()

    await mastery.ensure([verbs])
    await mastery.ensure([verbs, nouns])

    expect(reads).toHaveBeenLastCalledWith([nouns])
  })

  it('reads nothing at all when there are no decks to summarise', async () => {
    const reads = vi.spyOn(repositories.cards, 'listByDecks')
    const mastery = useMasteryStore()

    await mastery.ensure([])

    expect(reads).not.toHaveBeenCalled()
  })

  it('bands the cards against the clock now, not against when they were answered', async () => {
    const fresh = await seedDeck('Fresh', 1)
    const stale = await seedDeck('Stale', 1)
    await answerFiveTimes(fresh, Date.now())
    // Spec §5.4: the same five gets, four months old, have decayed to 63.
    await answerFiveTimes(stale, Date.now() - 120 * DAY)
    const mastery = useMasteryStore()

    await mastery.ensure([fresh, stale])

    expect(mastery.deckSummary(fresh)?.mastered).toBe(1)
    expect(mastery.deckSummary(stale)?.learning).toBe(1)
  })

  it('rolls a folder up out of the decks it holds', async () => {
    const folder = await repositories.folders.create('Spanish', 1000)
    const verbs = await seedDeck('Verbs', 2, folder.id)
    const nouns = await seedDeck('Nouns', 2, folder.id)
    await answerFiveTimes(verbs, Date.now())
    const library = useLibraryStore()
    const mastery = useMasteryStore()

    await library.load()
    await mastery.ensure([verbs, nouns])

    expect(mastery.folderSummary(folder.id)).toEqual({
      total: 4,
      new: 3,
      learning: 0,
      mastered: 1,
      masteredPct: 25,
    })
  })

  it('has no folder summary until every deck in that folder has been read', async () => {
    const folder = await repositories.folders.create('Spanish', 1000)
    const verbs = await seedDeck('Verbs', 2, folder.id)
    await seedDeck('Nouns', 2, folder.id)
    const library = useLibraryStore()
    const mastery = useMasteryStore()

    await library.load()
    await mastery.ensure([verbs])

    expect(mastery.folderSummary(folder.id)).toBeUndefined()
  })

  it('summarises a folder with no decks as empty rather than as unknown', async () => {
    const library = useLibraryStore()
    const mastery = useMasteryStore()

    await library.load()

    expect(mastery.folderSummary(UNSORTED_FOLDER_ID)).toEqual({
      total: 0,
      new: 0,
      learning: 0,
      mastered: 0,
      masteredPct: 0,
    })
  })

  it('recomputes a deck whose card was answered, once it is invalidated', async () => {
    const deckId = await seedDeck('Verbs', 1)
    const mastery = useMasteryStore()
    await mastery.ensure([deckId])
    expect(mastery.deckSummary(deckId)?.new).toBe(1)

    await answerFiveTimes(deckId, Date.now())
    mastery.invalidate(deckId)
    await mastery.ensure([deckId])

    expect(mastery.deckSummary(deckId)?.mastered).toBe(1)
  })

  it('invalidates one deck without disturbing what it knows about the others', async () => {
    const verbs = await seedDeck('Verbs', 1)
    const nouns = await seedDeck('Nouns', 1)
    const mastery = useMasteryStore()
    await mastery.ensure([verbs, nouns])
    const nounsSummary = mastery.deckSummary(nouns)
    const reads = vi.spyOn(repositories.cards, 'listByDecks')

    mastery.invalidate(verbs)
    await mastery.ensure([verbs, nouns])

    expect(reads).toHaveBeenCalledExactlyOnceWith([verbs])
    expect(mastery.deckSummary(nouns)).toBe(nounsSummary)
  })

  it('recounts a deck after a card is added to it', async () => {
    const deckId = await seedDeck('Verbs', 1)
    const mastery = useMasteryStore()
    const cards = useCardsStore()
    await cards.load(deckId)
    await mastery.ensure([deckId])

    await cards.create(deckId, { front: 'ir', back: 'to go' })
    await mastery.ensure([deckId])

    expect(mastery.deckSummary(deckId)?.total).toBe(2)
  })

  it('recounts a deck after a card is deleted from it', async () => {
    const deckId = await seedDeck('Verbs', 2)
    const mastery = useMasteryStore()
    const cards = useCardsStore()
    await cards.load(deckId)
    await mastery.ensure([deckId])

    await cards.remove(cards.cards[0].id)
    await mastery.ensure([deckId])

    expect(mastery.deckSummary(deckId)?.total).toBe(1)
  })

  it('recomputes a deck after a quiz answer against one of its cards', async () => {
    const deckId = await seedDeck('Verbs', 1)
    const mastery = useMasteryStore()
    const quiz = useQuizStore()
    await mastery.ensure([deckId])
    expect(mastery.deckSummary(deckId)?.new).toBe(1)

    await quiz.quickstart([deckId], { name: 'home' })
    quiz.flip()
    await quiz.answer(true)
    await mastery.ensure([deckId])

    // Spec §5.4: one get today scores 20, which is learning rather than new.
    expect(mastery.deckSummary(deckId)).toMatchObject({ new: 0, learning: 1 })
  })

  it('recomputes a deck after an undo takes a quiz answer back', async () => {
    const deckId = await seedDeck('Verbs', 2)
    const mastery = useMasteryStore()
    const quiz = useQuizStore()
    await quiz.quickstart([deckId], { name: 'home' })
    quiz.flip()
    await quiz.answer(true)
    await mastery.ensure([deckId])
    expect(mastery.deckSummary(deckId)?.learning).toBe(1)

    await quiz.undo()
    await mastery.ensure([deckId])

    expect(mastery.deckSummary(deckId)?.new).toBe(2)
  })

  it('leaves the other decks cached when one of them is written to', async () => {
    const verbs = await seedDeck('Verbs', 1)
    const nouns = await seedDeck('Nouns', 1)
    const mastery = useMasteryStore()
    const cards = useCardsStore()
    await cards.load(verbs)
    await mastery.ensure([verbs, nouns])
    const reads = vi.spyOn(repositories.cards, 'listByDecks')

    await cards.create(verbs, { front: 'ir', back: 'to go' })
    await mastery.ensure([verbs, nouns])

    expect(reads).toHaveBeenCalledExactlyOnceWith([verbs])
  })

  it('surfaces a failed read as an error and keeps the summary unknown', async () => {
    const deckId = await seedDeck('Verbs', 1)
    vi.spyOn(repositories.cards, 'listByDecks').mockRejectedValue(new Error('IndexedDB is gone.'))
    const mastery = useMasteryStore()

    await mastery.ensure([deckId])

    expect(mastery.error).toBe('IndexedDB is gone.')
    expect(mastery.deckSummary(deckId)).toBeUndefined()
  })

  it('tries a deck again after a failed read', async () => {
    const deckId = await seedDeck('Verbs', 1)
    const reads = vi
      .spyOn(repositories.cards, 'listByDecks')
      .mockRejectedValueOnce(new Error('IndexedDB is gone.'))
    const mastery = useMasteryStore()

    await mastery.ensure([deckId])
    await mastery.ensure([deckId])

    expect(reads).toHaveBeenCalledTimes(2)
    expect(mastery.deckSummary(deckId)?.total).toBe(1)
  })

  it('moves the clock to now when it re-reads', async () => {
    const deckId = await seedDeck('Verbs', 1)
    const mastery = useMasteryStore()
    const before = Date.now()

    await mastery.ensure([deckId])

    expect(mastery.now).toBeGreaterThanOrEqual(before)
    expect(mastery.now).toBeLessThanOrEqual(Date.now())
  })
})
