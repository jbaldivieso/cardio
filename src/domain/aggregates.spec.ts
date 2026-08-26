import { describe, expect, it } from 'vitest'
import { combineSummaries, summariseCards } from '@/domain/aggregates'
import { emptyStats } from '@/domain/models'
import type { Attempt, Card, CardStats } from '@/domain/models'

const DAY = 86_400_000
const NOW = Date.parse('2026-06-01T12:00:00.000Z')

let sequence = 0

function cardWith(stats: CardStats): Card {
  sequence += 1
  return {
    id: `card-${sequence}`,
    deckId: 'deck-1',
    front: 'front',
    back: 'back',
    createdAt: NOW,
    updatedAt: NOW,
    stats,
  }
}

function attempts(count: number, got: boolean): Attempt[] {
  return [...Array(count)].map(() => ({ at: NOW, got }))
}

/** Never answered: mastery 0, band `new`. */
const newCard = () => cardWith(emptyStats())
/** Five clean gets today: mastery 100, band `mastered`. */
const masteredCard = () =>
  cardWith({ gets: 5, misses: 0, history: attempts(5, true), lastSeenAt: NOW })
/** One get today: mastery 20, band `learning`. */
const learningCard = () =>
  cardWith({ gets: 1, misses: 0, history: attempts(1, true), lastSeenAt: NOW })

describe('summariseCards', () => {
  it('summarises an empty deck as zeros with 0% mastered', () => {
    expect(summariseCards([], NOW)).toEqual({
      total: 0,
      new: 0,
      learning: 0,
      mastered: 0,
      masteredPct: 0,
    })
  })

  it('counts each card into its band', () => {
    const cards = [newCard(), learningCard(), masteredCard(), masteredCard()]

    expect(summariseCards(cards, NOW)).toEqual({
      total: 4,
      new: 1,
      learning: 1,
      mastered: 2,
      masteredPct: 50,
    })
  })

  it('reads an untouched deck as 0% mastered, not 100%', () => {
    const summary = summariseCards([newCard(), newCard(), newCard()], NOW)

    expect(summary.new).toBe(3)
    expect(summary.masteredPct).toBe(0)
  })

  it('counts never-tried cards in the mastered percentage denominator', () => {
    const summary = summariseCards([masteredCard(), newCard(), newCard(), newCard()], NOW)

    expect(summary.masteredPct).toBe(25)
  })

  it('rounds the mastered percentage to a whole number', () => {
    const summary = summariseCards([masteredCard(), learningCard(), learningCard()], NOW)

    expect(summary.masteredPct).toBe(33)
  })

  it('keeps the three band counts summing to the total', () => {
    const cards = [newCard(), learningCard(), learningCard(), masteredCard()]

    const summary = summariseCards(cards, NOW)

    expect(summary.new + summary.learning + summary.mastered).toBe(summary.total)
  })

  it('re-bands a stale card at the given now', () => {
    const cards = [masteredCard()]

    expect(summariseCards(cards, NOW).mastered).toBe(1)
    // Two months untouched: mastery 75, so the same card is only learning.
    expect(summariseCards(cards, NOW + 60 * DAY).learning).toBe(1)
  })
})

describe('combineSummaries', () => {
  it('sums deck summaries into a folder summary', () => {
    const spanish = summariseCards([masteredCard(), learningCard()], NOW)
    const french = summariseCards([newCard(), masteredCard(), masteredCard()], NOW)

    expect(combineSummaries([spanish, french])).toEqual({
      total: 5,
      new: 1,
      learning: 1,
      mastered: 3,
      masteredPct: 60,
    })
  })

  it('derives the combined percentage from the totals, not from the deck percentages', () => {
    const tiny = summariseCards([masteredCard()], NOW) // 100%
    const big = summariseCards(
      [...Array(9)].map(() => newCard()),
      NOW,
    ) // 0%

    // Averaging the two percentages would read 50%.
    expect(combineSummaries([tiny, big]).masteredPct).toBe(10)
  })

  it('combines no summaries at all into zeros', () => {
    expect(combineSummaries([])).toEqual({
      total: 0,
      new: 0,
      learning: 0,
      mastered: 0,
      masteredPct: 0,
    })
  })
})
