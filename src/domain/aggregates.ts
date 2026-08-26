/**
 * Deck- and folder-level mastery, rolled up from per-card bands.
 *
 * Pure and single-pass: the store memoises the result per deck and invalidates
 * it on any card write (spec §5.5).
 */

import { band } from '@/domain/mastery'
import type { Card } from '@/domain/models'

export interface MasterySummary {
  /** Cards counted; always `new + learning + mastered`. */
  total: number
  new: number
  learning: number
  mastered: number
  /** The headline "68% mastered". 0 when there are no cards. */
  masteredPct: number
}

function summaryOf(total: number, counts: { new: number; learning: number; mastered: number }) {
  return {
    total,
    new: counts.new,
    learning: counts.learning,
    mastered: counts.mastered,
    // Every card is in the denominator, never-tried ones included, so an
    // untouched deck reads 0% rather than 100% (docs/decisions.md > ADR-009).
    masteredPct: total === 0 ? 0 : Math.round((100 * counts.mastered) / total),
  }
}

/** Band every card in a deck and count the results. */
export function summarise(cards: Card[], now: number): MasterySummary {
  const counts = { new: 0, learning: 0, mastered: 0 }
  for (const card of cards) {
    counts[band(card.stats, now)] += 1
  }
  return summaryOf(cards.length, counts)
}

/**
 * Roll deck summaries up into a folder summary. The percentage is recomputed
 * from the combined counts — averaging the decks' percentages would let a
 * one-card deck outweigh a hundred-card one.
 */
export function combineSummaries(summaries: MasterySummary[]): MasterySummary {
  const counts = { new: 0, learning: 0, mastered: 0 }
  let total = 0
  for (const summary of summaries) {
    total += summary.total
    counts.new += summary.new
    counts.learning += summary.learning
    counts.mastered += summary.mastered
  }
  return summaryOf(total, counts)
}
