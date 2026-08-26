/**
 * The wording of the destructive confirmations (spec §4.4). Pure so the exact
 * sentence is assertable without mounting a dialog.
 */

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
