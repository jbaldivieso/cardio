/**
 * Quiz selection: which cards a session asks, and what one answer does to a
 * card's statistics (spec §6.1–§6.4).
 *
 * Pure functions only. `rng` and `now` are parameters, never `Math.random()` or
 * `Date.now()` — that injection is what makes a shuffled session an exact
 * expectation in a test (docs/decisions.md > ADR-015). Orchestration and
 * persistence live in `src/stores/quiz.ts`.
 */

import { isMastered, isWeak } from '@/domain/mastery'
import { MASTERY_HISTORY_LIMIT } from '@/domain/models'
import type { Card, CardStats, QuizDirection } from '@/domain/models'

/** The 1–7 position of the mastery slider (spec §6.2). */
export type QuizTier = 1 | 2 | 3 | 4 | 5 | 6 | 7
/** How many cards a session asks; `'all'` means the whole pool. */
export type QuizSize = 10 | 20 | 50 | 'all'

export interface QuizConfig {
  /** Which decks make up the pool. Non-empty (§6.1). */
  deckIds: string[]
  direction: QuizDirection
  tier: QuizTier
  size: QuizSize
}

/**
 * The share of a session each tier gives to mastered cards (spec §6.2). Tiers 1
 * and 7 are hard filters rather than mixes; their 0 and 1 are here so the table
 * reads as the seven positions of one slider.
 */
export const TIER_MASTERED_SHARE: Record<QuizTier, number> = {
  1: 0,
  2: 0.1,
  3: 0.25,
  4: 0.4,
  5: 0.55,
  6: 0.75,
  7: 1,
}

/**
 * The slider's rung labels. §6.2 names only tiers 1, 2, 6 and 7 — see
 * docs/decisions.md > ADR-028 for where the middle three came from.
 */
const TIER_LABELS: Record<QuizTier, string> = {
  1: "Only what I don't know",
  2: 'Mostly unmastered',
  3: 'Leaning unmastered',
  4: 'A mix of both',
  5: 'Leaning mastered',
  6: 'Mostly mastered',
  7: 'Only what I know',
}

export function tierLabel(tier: QuizTier): string {
  return TIER_LABELS[tier]
}

/** A new array holding the same items in a random order (Fisher-Yates). */
export function shuffle<T>(items: T[], rng: () => number): T[] {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const held = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = held
  }
  return shuffled
}

/**
 * `count` items chosen uniformly at random, each at most once (ADR-008). Asking
 * for more than the collection holds yields the whole collection.
 *
 * A partial Fisher-Yates: only the first `count` positions are settled, so
 * sampling 20 cards out of a thousand costs 20 swaps rather than a thousand.
 */
export function sampleWithoutReplacement<T>(items: T[], count: number, rng: () => number): T[] {
  const pool = [...items]
  const take = Math.max(0, Math.min(count, pool.length))
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(rng() * (pool.length - i))
    const held = pool[i]
    pool[i] = pool[j]
    pool[j] = held
  }
  return pool.slice(0, take)
}

/**
 * The cards one quiz will ask, in the order it will ask them (spec §6.3).
 *
 * `now` is not in §6.3's signature, but every mastery comparison below needs
 * it, and §5 is unambiguous that mastery never reads the clock itself.
 */
export function buildSession(
  cards: Card[],
  config: QuizConfig,
  rng: () => number,
  now: number,
): Card[] {
  const selected = new Set(config.deckIds)
  const pool = cards.filter((card) => selected.has(card.deckId))
  if (pool.length === 0) return []

  const size = config.size === 'all' ? pool.length : Math.min(config.size, pool.length)

  // Tiers 1 and 7 are filters, not mixes: they narrow the pool and take from
  // what is left. An empty bucket means the user has no weak (or no mastered)
  // cards at all, and an empty session helps nobody, so the pool stands in.
  if (config.tier === 1 || config.tier === 7) {
    const test = config.tier === 1 ? isWeak : isMastered
    const bucket = pool.filter((card) => test(card.stats, now))
    return shuffle(sampleWithoutReplacement(bucket.length === 0 ? pool : bucket, size, rng), rng)
  }

  const mastered = pool.filter((card) => isMastered(card.stats, now))
  const unmastered = pool.filter((card) => !isMastered(card.stats, now))

  const wantMastered = Math.round(size * TIER_MASTERED_SHARE[config.tier])
  let takeMastered = Math.min(wantMastered, mastered.length)
  let takeUnmastered = Math.min(size - wantMastered, unmastered.length)

  // A one-sided pool still owes a full-length session: whichever bucket has
  // cards to spare covers the difference, unmastered first (§6.3 step 4).
  const shortfall = size - takeMastered - takeUnmastered
  if (shortfall > 0) {
    const fromUnmastered = Math.min(shortfall, unmastered.length - takeUnmastered)
    takeUnmastered += fromUnmastered
    takeMastered += Math.min(shortfall - fromUnmastered, mastered.length - takeMastered)
  }

  return shuffle(
    [
      ...sampleWithoutReplacement(mastered, takeMastered, rng),
      ...sampleWithoutReplacement(unmastered, takeUnmastered, rng),
    ],
    rng,
  )
}

/**
 * One answer folded into a card's statistics (spec §6.4). Returns a new object;
 * the caller hands it to the repository, which is the only thing that writes.
 */
export function recordAnswer(stats: CardStats, got: boolean, now: number): CardStats {
  return {
    gets: stats.gets + (got ? 1 : 0),
    misses: stats.misses + (got ? 0 : 1),
    // The lifetime counters above are never trimmed; only the window is (§4.2).
    history: [...stats.history, { at: now, got }].slice(-MASTERY_HISTORY_LIMIT),
    lastSeenAt: now,
  }
}
