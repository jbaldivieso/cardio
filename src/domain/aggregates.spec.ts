import { describe, expect, it } from 'vitest'
import { combineSummaries, segmentWidths, summarise } from '@/domain/aggregates'
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

describe('summarise', () => {
  it('summarises an empty deck as zeros with 0% mastered', () => {
    expect(summarise([], NOW)).toEqual({
      total: 0,
      new: 0,
      learning: 0,
      mastered: 0,
      masteredPct: 0,
    })
  })

  it('counts each card into its band', () => {
    const cards = [newCard(), learningCard(), masteredCard(), masteredCard()]

    expect(summarise(cards, NOW)).toEqual({
      total: 4,
      new: 1,
      learning: 1,
      mastered: 2,
      masteredPct: 50,
    })
  })

  it('reads an untouched deck as 0% mastered, not 100%', () => {
    const summary = summarise([newCard(), newCard(), newCard()], NOW)

    expect(summary.new).toBe(3)
    expect(summary.masteredPct).toBe(0)
  })

  it('counts never-tried cards in the mastered percentage denominator', () => {
    const summary = summarise([masteredCard(), newCard(), newCard(), newCard()], NOW)

    expect(summary.masteredPct).toBe(25)
  })

  it('rounds the mastered percentage to a whole number', () => {
    const summary = summarise([masteredCard(), learningCard(), learningCard()], NOW)

    expect(summary.masteredPct).toBe(33)
  })

  it('keeps the three band counts summing to the total', () => {
    const cards = [newCard(), learningCard(), learningCard(), masteredCard()]

    const summary = summarise(cards, NOW)

    expect(summary.new + summary.learning + summary.mastered).toBe(summary.total)
  })

  it('bands every card exactly once, whatever the size of the deck', () => {
    // Asserted by construction, not by timing: each card's stats may be read
    // once and once only, so the roll-up can never become quadratic (§5.5).
    const reads = new Map<string, number>()
    const cards = [...Array(50)].map(() => {
      const card = newCard()
      return {
        ...card,
        get stats() {
          reads.set(card.id, (reads.get(card.id) ?? 0) + 1)
          return card.stats
        },
      }
    })

    summarise(cards, NOW)

    expect(reads.size).toBe(50)
    expect([...reads.values()]).toEqual([...Array(50)].map(() => 1))
  })

  it('re-bands a stale card at the given now', () => {
    const cards = [masteredCard()]

    expect(summarise(cards, NOW).mastered).toBe(1)
    // Two months untouched: mastery 75, so the same card is only learning.
    expect(summarise(cards, NOW + 60 * DAY).learning).toBe(1)
  })
})

describe('combineSummaries', () => {
  it('sums deck summaries into a folder summary', () => {
    const spanish = summarise([masteredCard(), learningCard()], NOW)
    const french = summarise([newCard(), masteredCard(), masteredCard()], NOW)

    expect(combineSummaries([spanish, french])).toEqual({
      total: 5,
      new: 1,
      learning: 1,
      mastered: 3,
      masteredPct: 60,
    })
  })

  it('derives the combined percentage from the totals, not from the deck percentages', () => {
    const tiny = summarise([masteredCard()], NOW) // 100%
    const big = summarise(
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

describe('segmentWidths', () => {
  /** A summary straight from counts, so the widths can be read off the shares. */
  function summaryOf(mastered: number, learning: number, fresh: number) {
    return summarise(
      [
        ...[...Array(mastered)].map(masteredCard),
        ...[...Array(learning)].map(learningCard),
        ...[...Array(fresh)].map(newCard),
      ],
      NOW,
    )
  }

  it('sizes each band in proportion to its share of the deck', () => {
    expect(segmentWidths(summaryOf(5, 3, 2))).toEqual({ mastered: 50, learning: 30, new: 20 })
  })

  it('fills the whole bar when the shares do not divide evenly', () => {
    const widths = segmentWidths(summaryOf(1, 1, 1))

    expect(widths.mastered + widths.learning + widths.new).toBe(100)
  })

  it('gives the leftover percent to the band with the largest remainder', () => {
    // Two thirds is 66.66… and one third 33.33…: flooring both leaves 1% over.
    expect(segmentWidths(summaryOf(2, 1, 0))).toEqual({ mastered: 67, learning: 33, new: 0 })
  })

  it('gives the whole bar to the one band that has every card', () => {
    expect(segmentWidths(summaryOf(0, 0, 4))).toEqual({ mastered: 0, learning: 0, new: 100 })
  })

  it('draws the mastered segment at the percentage printed beside it', () => {
    // A third each: masteredPct rounds 33.33 down to 33, and a bar that drew
    // the segment at 34 would contradict its own headline and aria-label.
    const summary = summaryOf(1, 1, 1)

    expect(segmentWidths(summary).mastered).toBe(summary.masteredPct)
  })

  it('agrees with its headline and still fills the track, for every small mix', () => {
    for (let mastered = 0; mastered <= 6; mastered += 1) {
      for (let learning = 0; learning <= 6; learning += 1) {
        for (let fresh = 0; fresh <= 6; fresh += 1) {
          if (mastered + learning + fresh === 0) continue
          const summary = summaryOf(mastered, learning, fresh)
          const widths = segmentWidths(summary)

          expect(widths.mastered).toBe(summary.masteredPct)
          expect(widths.mastered + widths.learning + widths.new).toBe(100)
        }
      }
    }
  })

  it('leaves the bar empty for a deck with no cards', () => {
    expect(segmentWidths(summarise([], NOW))).toEqual({ mastered: 0, learning: 0, new: 0 })
  })
})
