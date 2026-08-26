/**
 * Mastery: one integer 0–100 per card, derived from its stored stats.
 *
 * Pure functions only — `now` is always a parameter, never `Date.now()`, which
 * is what makes the decay testable against the exact vectors in spec §5.4.
 * See docs/decisions.md > ADR-001 for why the score has three factors.
 */

import type { CardStats, MasteryBand } from '@/domain/models'

/** How many of the most recent attempts count toward recent accuracy. */
export const MASTERY_WINDOW = 10
/** Per-attempt weight decay within the window; the newest attempt weighs 1.0. */
export const MASTERY_DECAY = 0.85
/** Lifetime attempts needed before the score is trusted at full strength. */
export const MASTERY_EXPOSURE_TARGET = 5
/** Days after which staleness has shed half of its remaining half. */
export const MASTERY_HALF_LIFE_DAYS = 60
/** Band boundary, inclusive: at or above this a card is mastered (ADR-007). */
export const MASTERED_MIN = 80
/** Band boundary, inclusive: at or below this a card is weak (ADR-007). */
export const WEAK_MAX = 40

const MS_PER_DAY = 86_400_000

/**
 * How well the card has been answered lately: an exponentially weighted mean
 * over the last MASTERY_WINDOW attempts, newest first.
 *
 * A card imported with counters but no history has nothing to weight, so it
 * falls back to lifetime accuracy (spec §5.2).
 */
function recentAccuracy(stats: CardStats, attempts: number): number {
  const window = stats.history.slice(-MASTERY_WINDOW)
  if (window.length === 0) return stats.gets / attempts

  let weighted = 0
  let totalWeight = 0
  for (let i = 0; i < window.length; i++) {
    // i = 0 is the newest attempt, which sits at the end of the history.
    const weight = MASTERY_DECAY ** i
    const attempt = window[window.length - 1 - i]
    if (attempt.got) weighted += weight
    totalWeight += weight
  }
  return weighted / totalWeight
}

/** Confidence in the score: a card seen twice has not earned a high one. */
function exposure(attempts: number): number {
  return Math.min(1, attempts / MASTERY_EXPOSURE_TARGET)
}

/**
 * Recency credit, decaying from 1 toward 0.5 — never to zero, because knowing
 * something last year still beats never having seen it.
 */
function staleness(stats: CardStats, now: number): number {
  if (stats.lastSeenAt === null) return 1
  // Clock skew (or an imported future timestamp) must not pay a bonus.
  const daysSinceSeen = Math.max(0, (now - stats.lastSeenAt) / MS_PER_DAY)
  return 0.5 + 0.5 * 0.5 ** (daysSinceSeen / MASTERY_HALF_LIFE_DAYS)
}

/** Mastery of a card, 0–100 inclusive. An untried card scores 0 (spec §5.2). */
export function mastery(stats: CardStats, now: number): number {
  const attempts = stats.gets + stats.misses
  if (attempts === 0) return 0

  const score = 100 * recentAccuracy(stats, attempts) * exposure(attempts) * staleness(stats, now)
  // Half-up rounding, which the 120-days-ago vector (62.5 -> 63) depends on.
  return Math.min(100, Math.max(0, Math.round(score)))
}

/**
 * Which band a card falls into (spec §5.3). `new` is about having never been
 * tried, not about scoring badly: a card that has only ever been missed scores
 * 0 but is `learning`.
 */
export function band(stats: CardStats, now: number): MasteryBand {
  if (stats.gets + stats.misses === 0) return 'new'
  return mastery(stats, now) >= MASTERED_MIN ? 'mastered' : 'learning'
}

/**
 * At or above `MASTERED_MIN`. Tier 7 of the quiz slider selects exactly these,
 * and tiers 2–6 treat everything else as unmastered (spec §6.2).
 */
export function isMastered(stats: CardStats, now: number): boolean {
  return mastery(stats, now) >= MASTERED_MIN
}

/**
 * At or below `WEAK_MAX` — what tier 1 practises. An untried card scores 0, so
 * it is weak and therefore eligible, which is the point (spec §5.2).
 */
export function isWeak(stats: CardStats, now: number): boolean {
  return mastery(stats, now) <= WEAK_MAX
}
