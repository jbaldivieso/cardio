/**
 * Wording that has to be exact: the destructive confirmations (spec §4.4, §7.8),
 * the mastery bar's own two sentences (§7.9) and what an import says about a
 * file before it loads it (§10) — and, at the other end, the one thing here
 * that is deliberately not fixed: the sign-off over a finished quiz (§6.6).
 * Pure, so what a screen says is assertable without mounting anything.
 */

import type { MasterySummary } from '@/domain/aggregates'
import type { BackupRepairs, LibraryCounts } from '@/domain/backup'
import type { MasteryBand } from '@/domain/models'

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

/** "3 folders, 4 decks and 212 cards": a whole library in one phrase (§7.8, §10). */
export function libraryLabel(counts: LibraryCounts): string {
  return `${countLabel(counts.folders, 'folder')}, ${countLabel(counts.decks, 'deck')} and ${countLabel(counts.cards, 'card')}`
}

/**
 * The danger zone's own line (§7.8). `null` counts mean the library could not be
 * read: quoting the zeros that come of a failed read would tell the user there
 * is nothing to lose immediately before offering to delete it all.
 */
export function storedPrompt(counts: LibraryCounts | null): string {
  const stored = counts === null ? 'Everything you have is' : `${libraryLabel(counts)}`
  return `${stored} stored in this browser. There is no undo and no trash.`
}

/** The typed confirmation before the library goes (§7.8). */
export function deleteEverythingPrompt(counts: LibraryCounts | null): string {
  const names = counts === null ? '' : ` — ${libraryLabel(counts)}`
  return `This deletes every folder, deck and card you have${names}. Nothing comes back.`
}

/** The typed confirmation before a backup takes the library's place (§10). */
export function replaceEverythingPrompt(counts: LibraryCounts | null): string {
  const clears =
    counts === null
      ? 'everything in this browser and loads the backup in its place'
      : `${libraryLabel(counts)} and loads the backup in their place`
  return `This clears ${clears}. There is no undo.`
}

/** What a validated file holds, said before a single row of it is written (§10). */
export function importPreview(counts: LibraryCounts): string {
  return `That backup holds ${libraryLabel(counts)}.`
}

/** What validation had to put right to make the file loadable, a line each (§10). */
export function repairNotes(repairs: BackupRepairs): string[] {
  const notes: string[] = []
  if (repairs.rejectedDecks > 0) {
    notes.push(`${countLabel(repairs.rejectedDecks, 'deck')} with no folder will be left out.`)
  }
  if (repairs.rejectedCards > 0) {
    notes.push(`${countLabel(repairs.rejectedCards, 'card')} with no deck will be left out.`)
  }
  return notes
}

/**
 * What a screen reader hears in place of one card's badge (§7.3). The badge
 * itself is two or three characters — `new`, `68%` — which read as a number
 * with nothing saying what it counts, so the label supplies the noun the bar
 * beside it already gets.
 */
export function cardMasteryLabel(band: MasteryBand, score: number): string {
  return band === 'new' ? 'Not attempted yet' : `${score}% mastered`
}

/** The five ways a finished session announces itself (§6.6). */
const SIGNOFF_HEADLINES = [
  'All done! 💪🏻',
  'You did it. 🤘🏻',
  "That's a wrap. 👏🏻",
  "That's the quiz. 👍🏻",
  "And we're done. 🙌🏻",
]

/** Nothing missed. */
const PERFECT = [
  'Nailed them all!',
  '100% Way to go, Urkel! 🤓',
  "100%! Either you're getting too smart or these are getting too easy.",
  '100%! Smooth move, Ex-Lax!',
  '100%! That deserves some baby animals. 🐣🐶🐱',
]

/** Better than 60%. */
const GOOD = [
  'Not terrible!',
  'Progress, I guess!',
  "Let's call that a passing grade.",
  "You're getting there.",
  'Not bad, not bad at all.',
]

/** Better than 20%. */
const FAIR = [
  "At least they weren't ALL wrong! 😏",
  "You're getting there. Slowly but surely. 🐛",
  'And next time will be even better, surely. ☺️',
  'Practice makes perfect?',
]

/** Everything else, including a session that answered nothing. */
const POOR = [
  'The journey of 1000 miles begins with a single step. 🏃🏻‍♂️',
  "I mean, if you already knew all of these, you wouldn't be using a fine app like Cardio®, am I right? 😎",
  'Well, at least now we know which ones to work on! 😁',
  'The areas for improvement are coming into focus. 🧐',
  '🥴 but also 😣',
  "This won't count toward your final grade.",
]

/** What the sign-off needs to know about the session it is closing (§6.6). */
export interface QuizScore {
  answered: number
  got: number
}

/** The two lines over a finished quiz's numbers (§6.6). */
export interface QuizSignoff {
  headline: string
  verdict: string
}

/** One of `lines`, uniformly. `rng` is in [0, 1), as `Math.random` is. */
function pick(lines: string[], rng: () => number): string {
  return lines[Math.floor(rng() * lines.length)]
}

function verdicts(pct: number): string[] {
  if (pct === 100) return PERFECT
  if (pct > 60) return GOOD
  if (pct > 20) return FAIR
  return POOR
}

/**
 * A headline and a verdict for a finished session, each drawn at random from
 * the lines its score qualifies for (§6.6, ADR-057).
 *
 * The bands read the unrounded percentage rather than the accuracy the summary
 * shows: 199 of 200 rounds to 100% on screen, and telling that session it
 * nailed them all would be a lie about the one it missed.
 */
export function quizSignoff(score: QuizScore, rng: () => number): QuizSignoff {
  const pct = score.answered === 0 ? 0 : (100 * score.got) / score.answered
  return { headline: pick(SIGNOFF_HEADLINES, rng), verdict: pick(verdicts(pct), rng) }
}
