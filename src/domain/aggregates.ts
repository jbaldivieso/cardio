/**
 * Deck- and folder-level mastery, rolled up from per-card bands.
 *
 * Pure and single-pass: the store memoises the result per deck and invalidates
 * it on any card write (spec §5.5).
 */

import { band } from '@/domain/mastery'
import type { Card, MasteryBand } from '@/domain/models'

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

/** The two bands that share whatever the mastered segment leaves (§7.9). */
const REST_BANDS: MasteryBand[] = ['learning', 'new']

/**
 * The three segment widths of the §7.9 bar, in whole percent, adding up to
 * exactly 100 for any deck that has cards.
 *
 * The mastered segment is `masteredPct` itself, because that is the number
 * printed beside the bar and read out in its label: a segment drawn a point
 * away from its own headline is the one discrepancy a reader can actually see.
 *
 * The other two share what is left by largest remainder rather than by plain
 * rounding, which can add up to a point short of the track or a point past it.
 */
export function segmentWidths(summary: MasterySummary): Record<MasteryBand, number> {
  const widths: Record<MasteryBand, number> = { mastered: 0, learning: 0, new: 0 }
  if (summary.total === 0) return widths

  widths.mastered = summary.masteredPct
  const rest = 100 - widths.mastered
  const counted = summary.learning + summary.new
  // Every card is mastered, so there is nothing to share and nothing left over.
  if (counted === 0) return widths

  const shares = REST_BANDS.map((name) => {
    const exact = (rest * summary[name]) / counted
    const whole = Math.floor(exact)
    return { band: name, whole, remainder: exact - whole }
  })
  for (const share of shares) widths[share.band] = share.whole

  let leftover = rest - shares.reduce((sum, share) => sum + share.whole, 0)
  // A stable sort, so a tie goes to the band nearer the left of the bar.
  for (const share of [...shares].sort((a, b) => b.remainder - a.remainder)) {
    if (leftover === 0) break
    widths[share.band] += 1
    leftover -= 1
  }
  return widths
}
