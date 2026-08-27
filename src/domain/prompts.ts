/**
 * Wording that has to be exact: the destructive confirmations (spec §4.4) and
 * the mastery bar's own two sentences (§7.9). Pure, so what a screen says is
 * assertable without mounting anything.
 */

import type { MasterySummary } from '@/domain/aggregates'

/** `4 decks`, `1 deck`. English pluralisation only — i18n is out of scope (§2). */
export function countLabel(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`
}

/**
 * "Delete “Spanish”? This removes 4 decks and 212 cards. This cannot be undone."
 * An empty folder has no counts worth naming, so it only gets the warning.
 */
export function deleteFolderPrompt(name: string, counts: { decks: number; cards: number }): string {
  const removes =
    counts.decks === 0 && counts.cards === 0
      ? ''
      : ` This removes ${countLabel(counts.decks, 'deck')} and ${countLabel(counts.cards, 'card')}.`
  return `Delete “${name}”?${removes} This cannot be undone.`
}

/** "Delete “Verbs”? This removes 12 cards. This cannot be undone." */
export function deleteDeckPrompt(name: string, cards: number): string {
  const removes = cards === 0 ? '' : ` This removes ${countLabel(cards, 'card')}.`
  return `Delete “${name}”?${removes} This cannot be undone.`
}

/** A card has nothing to count, so the confirmation is only the warning. */
export function deleteCardPrompt(): string {
  return 'Delete this card? This cannot be undone.'
}

/** A deck with nothing in it has no percentage worth showing (§7.9). */
const NO_CARDS = 'No cards yet'

/** The headline beside the bar: "68% mastered" (§5.5). */
export function masteryHeadline(summary: MasterySummary): string {
  return summary.total === 0 ? NO_CARDS : `${summary.masteredPct}% mastered`
}

/**
 * What a screen reader hears in place of the bar: "68% mastered, 12 learning,
 * 4 new" (§7.9). The headline is a share of the deck, the other two are counts,
 * because that is the pair of questions the bar is there to answer.
 */
export function masteryLabel(summary: MasterySummary): string {
  if (summary.total === 0) return NO_CARDS
  return `${masteryHeadline(summary)}, ${summary.learning} learning, ${summary.new} new`
}
