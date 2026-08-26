import { describe, expect, it } from 'vitest'
import { band, isMastered, isWeak, mastery, MASTERED_MIN, WEAK_MAX } from '@/domain/mastery'
import { emptyStats } from '@/domain/models'
import type { CardStats, MasteryBand } from '@/domain/models'

const MINUTE = 60_000
const DAY = 86_400_000
/** Any fixed instant; mastery only ever sees `now` as a parameter. */
const NOW = Date.parse('2026-06-01T12:00:00.000Z')

interface Vector {
  /** Chronological, oldest first. `G` = get, `M` = miss. */
  history: string
  /** Days between the last attempt and `now`; null means never seen. */
  daysAgo: number | null
  gets: number
  misses: number
  mastery: number
  band: MasteryBand
}

/** The table in spec §5.4, verbatim. These values are exact. */
const VECTORS: Vector[] = [
  { history: '', daysAgo: null, gets: 0, misses: 0, mastery: 0, band: 'new' },
  { history: 'G', daysAgo: 0, gets: 1, misses: 0, mastery: 20, band: 'learning' },
  { history: 'GG', daysAgo: 1, gets: 2, misses: 0, mastery: 40, band: 'learning' },
  { history: 'GGG', daysAgo: 0, gets: 3, misses: 0, mastery: 60, band: 'learning' },
  { history: 'GGGG', daysAgo: 0, gets: 4, misses: 0, mastery: 80, band: 'mastered' },
  { history: 'GGGGG', daysAgo: 0, gets: 5, misses: 0, mastery: 100, band: 'mastered' },
  { history: 'GGGGGGGG', daysAgo: 0, gets: 8, misses: 0, mastery: 100, band: 'mastered' },
  { history: 'GMGGM', daysAgo: 0, gets: 3, misses: 2, mastery: 56, band: 'learning' },
  { history: 'GMGMG', daysAgo: 0, gets: 3, misses: 2, mastery: 61, band: 'learning' },
  { history: 'MMM', daysAgo: 0, gets: 0, misses: 3, mastery: 0, band: 'learning' },
  { history: 'GGGGM', daysAgo: 0, gets: 4, misses: 1, mastery: 73, band: 'learning' },
  { history: 'MGGGG', daysAgo: 0, gets: 4, misses: 1, mastery: 86, band: 'mastered' },
  { history: 'GGGGGGGGGM', daysAgo: 0, gets: 9, misses: 1, mastery: 81, band: 'mastered' },
  { history: 'MMMMMGGGGGGGGGG', daysAgo: 0, gets: 10, misses: 5, mastery: 100, band: 'mastered' },
  { history: 'GGGGG', daysAgo: 30, gets: 5, misses: 0, mastery: 85, band: 'mastered' },
  { history: 'GGGGG', daysAgo: 60, gets: 5, misses: 0, mastery: 75, band: 'learning' },
  { history: 'GGGGG', daysAgo: 120, gets: 5, misses: 0, mastery: 63, band: 'learning' },
  { history: 'GGGGG', daysAgo: 365, gets: 5, misses: 0, mastery: 51, band: 'learning' },
  { history: '', daysAgo: 5, gets: 4, misses: 1, mastery: 78, band: 'learning' },
]

function statsFor(vector: Vector): CardStats {
  const lastSeenAt = vector.daysAgo === null ? null : NOW - vector.daysAgo * DAY
  const attempts = [...vector.history].map((mark, i) => ({
    at: (lastSeenAt ?? NOW) - (vector.history.length - 1 - i) * MINUTE,
    got: mark === 'G',
  }))
  return { gets: vector.gets, misses: vector.misses, history: attempts, lastSeenAt }
}

/** The §5.4 row for a history pattern seen `daysAgo` ago; the vectors are the fixtures. */
function vectorFor(history: string, daysAgo: number): Vector {
  const vector = VECTORS.find((row) => row.history === history && row.daysAgo === daysAgo)
  if (!vector) throw new Error(`No spec §5.4 vector for ${history} at ${daysAgo} days`)
  return vector
}

const cases = VECTORS.map((vector) => ({
  ...vector,
  pattern: vector.history === '' ? '(no history)' : vector.history,
  when:
    vector.daysAgo === null
      ? 'never seen'
      : vector.daysAgo === 0
        ? 'seen today'
        : `seen ${vector.daysAgo} days ago`,
}))

describe('mastery', () => {
  it.each(cases)('scores $pattern $when as $mastery', (vector) => {
    expect(mastery(statsFor(vector), NOW)).toBe(vector.mastery)
  })

  it('scores a card with no attempts as 0', () => {
    const stats: CardStats = { gets: 0, misses: 0, history: [], lastSeenAt: null }

    expect(mastery(stats, NOW)).toBe(0)
  })

  it('falls back to lifetime accuracy when history is empty but counters are not', () => {
    // Possible via import: counters survive, the attempt log does not.
    const stats: CardStats = { gets: 6, misses: 2, history: [], lastSeenAt: NOW }

    // 100 × (6/8) × 1 × 1
    expect(mastery(stats, NOW)).toBe(75)
  })

  it('treats a missing lastSeenAt as seen just now', () => {
    const seenNow: CardStats = {
      gets: 5,
      misses: 0,
      history: [...Array(5)].map(() => ({ at: NOW, got: true })),
      lastSeenAt: NOW,
    }
    const neverStamped: CardStats = { ...seenNow, lastSeenAt: null }

    expect(mastery(neverStamped, NOW)).toBe(mastery(seenNow, NOW))
  })

  it('clamps clock skew rather than crediting a future attempt', () => {
    const stats: CardStats = {
      gets: 5,
      misses: 0,
      history: [...Array(5)].map(() => ({ at: NOW, got: true })),
      lastSeenAt: NOW + 30 * DAY,
    }

    expect(mastery(stats, NOW)).toBe(100)
  })

  it('ignores attempts older than the 10-attempt window', () => {
    const history = [
      ...[...Array(9)].map(() => ({ at: NOW - 2 * DAY, got: false })),
      ...[...Array(10)].map(() => ({ at: NOW, got: true })),
    ]
    const stats: CardStats = { gets: 10, misses: 9, history, lastSeenAt: NOW }

    expect(mastery(stats, NOW)).toBe(100)
  })

  it('weights the newest attempt most heavily', () => {
    const freshMiss: CardStats = {
      gets: 4,
      misses: 1,
      history: [
        { at: NOW - 4 * MINUTE, got: true },
        { at: NOW - 3 * MINUTE, got: true },
        { at: NOW - 2 * MINUTE, got: true },
        { at: NOW - MINUTE, got: true },
        { at: NOW, got: false },
      ],
      lastSeenAt: NOW,
    }
    const staleMiss: CardStats = {
      ...freshMiss,
      history: [...freshMiss.history].reverse().map((attempt, i) => ({ ...attempt, at: NOW - i })),
    }

    expect(mastery(freshMiss, NOW)).toBeLessThan(mastery(staleMiss, NOW))
  })

  it('decays a long-untouched perfect card to half credit, never to zero', () => {
    const stats: CardStats = {
      gets: 5,
      misses: 0,
      history: [...Array(5)].map(() => ({ at: NOW - 10_000 * DAY, got: true })),
      lastSeenAt: NOW - 10_000 * DAY,
    }

    expect(mastery(stats, NOW)).toBe(50)
  })

  it('returns an integer', () => {
    const stats: CardStats = {
      gets: 2,
      misses: 1,
      history: [
        { at: NOW - 2 * MINUTE, got: true },
        { at: NOW - MINUTE, got: false },
        { at: NOW, got: true },
      ],
      lastSeenAt: NOW - 3 * DAY,
    }

    expect(Number.isInteger(mastery(stats, NOW))).toBe(true)
  })

  it('stays within 0..100 for absurd counters', () => {
    const stats: CardStats = { gets: 10_000, misses: 0, history: [], lastSeenAt: NOW }

    expect(mastery(stats, NOW)).toBe(100)
  })
})

describe('band', () => {
  it.each(cases)('places $pattern $when in the $band band', (vector) => {
    expect(band(statsFor(vector), NOW)).toBe(vector.band)
  })

  it('calls a card with no attempts new', () => {
    expect(band({ gets: 0, misses: 0, history: [], lastSeenAt: null }, NOW)).toBe('new')
  })

  it('calls a card scoring exactly the mastered minimum mastered', () => {
    const stats: CardStats = {
      gets: 4,
      misses: 0,
      history: [...Array(4)].map(() => ({ at: NOW, got: true })),
      lastSeenAt: NOW,
    }

    expect(mastery(stats, NOW)).toBe(MASTERED_MIN)
    expect(band(stats, NOW)).toBe('mastered')
  })

  it('calls a card scoring one below the mastered minimum learning', () => {
    const stats: CardStats = {
      gets: 4,
      misses: 1,
      history: [
        ...[...Array(4)].map(() => ({ at: NOW - MINUTE, got: true })),
        { at: NOW, got: false },
      ],
      lastSeenAt: NOW,
    }

    expect(mastery(stats, NOW)).toBeLessThan(MASTERED_MIN)
    expect(band(stats, NOW)).toBe('learning')
  })

  it('calls a card that has only ever been missed learning, not new', () => {
    const stats: CardStats = {
      gets: 0,
      misses: 3,
      history: [...Array(3)].map(() => ({ at: NOW, got: false })),
      lastSeenAt: NOW,
    }

    expect(mastery(stats, NOW)).toBe(0)
    expect(band(stats, NOW)).toBe('learning')
  })
})

describe('band boundaries', () => {
  it('puts the mastered floor at 80 and the weak ceiling at 40', () => {
    expect(MASTERED_MIN).toBe(80)
    expect(WEAK_MAX).toBe(40)
  })
})

/** The two hard filters of the quiz slider: tier 1 takes weak, tier 7 mastered (§6.2). */
describe('isMastered', () => {
  it('includes a card scoring exactly the mastered minimum', () => {
    const stats = statsFor(vectorFor('GGGG', 0))

    expect(mastery(stats, NOW)).toBe(MASTERED_MIN)
    expect(isMastered(stats, NOW)).toBe(true)
  })

  it('excludes a card one fresh miss below it', () => {
    const stats = statsFor(vectorFor('GGGGM', 0))

    expect(mastery(stats, NOW)).toBeLessThan(MASTERED_MIN)
    expect(isMastered(stats, NOW)).toBe(false)
  })

  it('excludes a card that has never been tried', () => {
    expect(isMastered(emptyStats(), NOW)).toBe(false)
  })
})

describe('isWeak', () => {
  it('includes a card scoring exactly the weak ceiling', () => {
    const stats = statsFor(vectorFor('GG', 1))

    expect(mastery(stats, NOW)).toBe(WEAK_MAX)
    expect(isWeak(stats, NOW)).toBe(true)
  })

  it('excludes a card one clean get above it', () => {
    const stats = statsFor(vectorFor('GGG', 0))

    expect(mastery(stats, NOW)).toBeGreaterThan(WEAK_MAX)
    expect(isWeak(stats, NOW)).toBe(false)
  })

  it('includes a card that has never been tried, so a new card is eligible for practice', () => {
    expect(isWeak(emptyStats(), NOW)).toBe(true)
  })
})
