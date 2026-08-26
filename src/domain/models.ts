/**
 * Entity types shared by every layer. Pure types only — see CLAUDE.md >
 * Architecture for why the domain layer imports nothing.
 *
 * All timestamps are epoch milliseconds (indexable by Dexie, trivial to fake in
 * tests).
 */

export interface Folder {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface Deck {
  id: string
  folderId: string
  name: string
  createdAt: number
  updatedAt: number
}

/** One answer to one card. `got` is true for "Got it", false for "Missed it". */
export interface Attempt {
  at: number
  got: boolean
}

/**
 * Quiz statistics for a card. Direction-agnostic by design: front-to-back and
 * back-to-front answers feed the same counters (docs/decisions.md > ADR-002).
 */
export interface CardStats {
  gets: number
  misses: number
  /** Chronological, oldest first, capped at MASTERY_HISTORY_LIMIT entries. */
  history: Attempt[]
  lastSeenAt: number | null
}

export interface Card {
  id: string
  deckId: string
  front: string
  back: string
  createdAt: number
  updatedAt: number
  stats: CardStats
}

/** Which side of the card a quiz shows before the flip. */
export type QuizDirection = 'front' | 'back'

/** Mastery band a card falls into. See src/domain/mastery.ts. */
export type MasteryBand = 'new' | 'learning' | 'mastered'

export const MASTERY_HISTORY_LIMIT = 20

export function emptyStats(): CardStats {
  return { gets: 0, misses: 0, history: [], lastSeenAt: null }
}
