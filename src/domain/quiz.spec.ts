import { describe, expect, it } from 'vitest'
import { MASTERED_MIN, mastery, WEAK_MAX } from '@/domain/mastery'
import { MASTERY_HISTORY_LIMIT } from '@/domain/models'
import type { Card, CardStats } from '@/domain/models'
import {
  buildSession,
  defaultQuizConfig,
  parseQuizConfig,
  QUIZ_SIZES,
  QUIZ_TIERS,
  recordAnswer,
  sampleWithoutReplacement,
  shuffle,
  tierLabel,
  TIER_MASTERED_SHARE,
} from '@/domain/quiz'
import type { QuizConfig, QuizTier } from '@/domain/quiz'

const MINUTE = 60_000
/** Any fixed instant; selection only ever sees `now` as a parameter. */
const NOW = Date.parse('2026-06-01T12:00:00.000Z')

/**
 * A seeded generator, so "shuffled" is still an exact expectation. Injected as
 * `rng` exactly where the store will inject `Math.random` (ADR-015).
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A card whose mastery is fixed by its history, seen a minute ago so staleness
 * is a rounding error: '' -> 0 (new, weak), 'GG' -> 40 (weak), 'GGG' -> 60
 * (unmastered but not weak), 'GGGGG' -> 100 (mastered).
 */
function cardWith(id: string, history: string, deckId = 'deck-1'): Card {
  const attempts = [...history].map((mark, i) => ({
    at: NOW - (history.length - i) * MINUTE,
    got: mark === 'G',
  }))
  return {
    id,
    deckId,
    front: `front ${id}`,
    back: `back ${id}`,
    createdAt: NOW,
    updatedAt: NOW,
    stats: {
      gets: attempts.filter((attempt) => attempt.got).length,
      misses: attempts.filter((attempt) => !attempt.got).length,
      history: attempts,
      lastSeenAt: attempts.length === 0 ? null : NOW - MINUTE,
    },
  }
}

function manyCards(count: number, history: string, prefix: string, deckId = 'deck-1'): Card[] {
  return Array.from({ length: count }, (_, i) => cardWith(`${prefix}-${i}`, history, deckId))
}

/** The mastered end of every pool below: five clean gets, scoring 100. */
function masteredCards(count: number, deckId = 'deck-1'): Card[] {
  return manyCards(count, 'GGGGG', 'mastered', deckId)
}

/** Unmastered at 60, which is deliberately above WEAK_MAX so tier 1 excludes it. */
function unmasteredCards(count: number, deckId = 'deck-1'): Card[] {
  return manyCards(count, 'GGG', 'unmastered', deckId)
}

function configFor(overrides: Partial<QuizConfig> = {}): QuizConfig {
  return { deckIds: ['deck-1'], direction: 'front', tier: 4, size: 20, ...overrides }
}

function countMastered(cards: Card[]): number {
  return cards.filter((card) => mastery(card.stats, NOW) >= MASTERED_MIN).length
}

function ids(cards: Card[]): string[] {
  return cards.map((card) => card.id)
}

describe('TIER_MASTERED_SHARE', () => {
  it('holds the seven compositions of spec §6.2', () => {
    expect(TIER_MASTERED_SHARE).toEqual({ 1: 0, 2: 0.1, 3: 0.25, 4: 0.4, 5: 0.55, 6: 0.75, 7: 1 })
  })
})

describe('tierLabel', () => {
  it('names every tier from "only what I don\'t know" up to "only what I know"', () => {
    const labels = ([1, 2, 3, 4, 5, 6, 7] as QuizTier[]).map(tierLabel)
    expect(labels).toEqual([
      "Only what I don't know",
      'Mostly unmastered',
      'Leaning unmastered',
      'A mix of both',
      'Leaning mastered',
      'Mostly mastered',
      'Only what I know',
    ])
  })
})

describe('shuffle', () => {
  it('keeps every item exactly once', () => {
    const shuffled = shuffle([1, 2, 3, 4, 5, 6, 7, 8], mulberry32(7))
    expect([...shuffled].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('leaves the input array untouched', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    shuffle(items, mulberry32(7))
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('reorders the items', () => {
    expect(shuffle([1, 2, 3, 4, 5, 6, 7, 8], mulberry32(7))).not.toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('returns an empty array unchanged', () => {
    expect(shuffle([], mulberry32(1))).toEqual([])
  })
})

describe('sampleWithoutReplacement', () => {
  it('takes the requested number of distinct items', () => {
    const sample = sampleWithoutReplacement([1, 2, 3, 4, 5, 6, 7, 8], 3, mulberry32(3))
    expect(sample).toHaveLength(3)
    expect(new Set(sample).size).toBe(3)
  })

  it('takes the whole collection when asked for more than it holds', () => {
    const sample = sampleWithoutReplacement([1, 2, 3], 10, mulberry32(3))
    expect([...sample].sort((a, b) => a - b)).toEqual([1, 2, 3])
  })

  it('takes nothing when asked for nothing', () => {
    expect(sampleWithoutReplacement([1, 2, 3], 0, mulberry32(3))).toEqual([])
  })

  it('takes nothing when asked for a negative count', () => {
    expect(sampleWithoutReplacement([1, 2, 3], -5, mulberry32(3))).toEqual([])
  })

  it('leaves the input array untouched', () => {
    const items = [1, 2, 3, 4, 5]
    sampleWithoutReplacement(items, 2, mulberry32(3))
    expect(items).toEqual([1, 2, 3, 4, 5])
  })
})

describe('buildSession', () => {
  it('returns as many cards as the configured size', () => {
    const pool = [...masteredCards(50), ...unmasteredCards(50)]
    expect(buildSession(pool, configFor({ size: 20 }), mulberry32(1), NOW)).toHaveLength(20)
  })

  it('returns the whole pool when the size is "all"', () => {
    const pool = [...masteredCards(7), ...unmasteredCards(6)]
    const session = buildSession(pool, configFor({ size: 'all' }), mulberry32(1), NOW)
    expect(ids(session).sort()).toEqual(ids(pool).sort())
  })

  it('returns the whole pool when the pool is smaller than the size', () => {
    const pool = unmasteredCards(3)
    expect(buildSession(pool, configFor({ size: 20 }), mulberry32(1), NOW)).toHaveLength(3)
  })

  it('never repeats a card', () => {
    const pool = [...masteredCards(30), ...unmasteredCards(30)]
    const session = buildSession(pool, configFor({ size: 50 }), mulberry32(9), NOW)
    expect(new Set(ids(session)).size).toBe(session.length)
  })

  it('draws only from the configured decks', () => {
    const pool = [...unmasteredCards(5, 'deck-1'), ...unmasteredCards(5, 'deck-2')]
    const session = buildSession(
      pool,
      configFor({ deckIds: ['deck-2'], size: 20 }),
      mulberry32(1),
      NOW,
    )
    expect(session).toHaveLength(5)
    expect(session.every((card) => card.deckId === 'deck-2')).toBe(true)
  })

  it('splits a tier 4 session of 20 into 12 unmastered and 8 mastered', () => {
    const pool = [...masteredCards(50), ...unmasteredCards(50)]
    const session = buildSession(pool, configFor({ tier: 4, size: 20 }), mulberry32(2), NOW)
    expect(countMastered(session)).toBe(8)
    expect(session.length - countMastered(session)).toBe(12)
  })

  it('splits a tier 4 session of 10 into 6 unmastered and 4 mastered', () => {
    const pool = [...masteredCards(50), ...unmasteredCards(50)]
    const session = buildSession(pool, configFor({ tier: 4, size: 10 }), mulberry32(2), NOW)
    expect(countMastered(session)).toBe(4)
    expect(session.length - countMastered(session)).toBe(6)
  })

  it.each([
    { tier: 2 as QuizTier, expectedMastered: 2 },
    { tier: 3 as QuizTier, expectedMastered: 5 },
    { tier: 4 as QuizTier, expectedMastered: 8 },
    { tier: 5 as QuizTier, expectedMastered: 11 },
    { tier: 6 as QuizTier, expectedMastered: 15 },
  ])('mixes tier $tier to $expectedMastered mastered of 20', ({ tier, expectedMastered }) => {
    const pool = [...masteredCards(50), ...unmasteredCards(50)]
    const session = buildSession(pool, configFor({ tier, size: 20 }), mulberry32(4), NOW)
    expect(session).toHaveLength(20)
    expect(countMastered(session)).toBe(expectedMastered)
  })

  it('offers only weak cards at tier 1', () => {
    const pool = [...masteredCards(20), ...unmasteredCards(20), ...manyCards(20, 'GG', 'weak')]
    const session = buildSession(pool, configFor({ tier: 1, size: 20 }), mulberry32(5), NOW)
    expect(session).toHaveLength(20)
    expect(session.every((card) => mastery(card.stats, NOW) <= WEAK_MAX)).toBe(true)
  })

  it('offers only mastered cards at tier 7', () => {
    const pool = [...masteredCards(20), ...unmasteredCards(20), ...manyCards(20, 'GG', 'weak')]
    const session = buildSession(pool, configFor({ tier: 7, size: 20 }), mulberry32(5), NOW)
    expect(session).toHaveLength(20)
    expect(session.every((card) => mastery(card.stats, NOW) >= MASTERED_MIN)).toBe(true)
  })

  it('falls back to the whole pool at tier 1 when nothing is weak', () => {
    const pool = [...masteredCards(10), ...unmasteredCards(10)]
    const session = buildSession(pool, configFor({ tier: 1, size: 20 }), mulberry32(6), NOW)
    expect(session).toHaveLength(20)
  })

  it('falls back to the whole pool at tier 7 when nothing is mastered', () => {
    const pool = [...unmasteredCards(10), ...manyCards(10, 'GG', 'weak')]
    const session = buildSession(pool, configFor({ tier: 7, size: 20 }), mulberry32(6), NOW)
    expect(session).toHaveLength(20)
  })

  it('backfills from the unmastered side when too few cards are mastered', () => {
    const pool = [...masteredCards(3), ...unmasteredCards(40)]
    const session = buildSession(pool, configFor({ tier: 6, size: 20 }), mulberry32(8), NOW)
    expect(session).toHaveLength(20)
    expect(countMastered(session)).toBe(3)
    expect(session.length - countMastered(session)).toBe(17)
  })

  it('backfills from the mastered side when too few cards are unmastered', () => {
    const pool = [...masteredCards(40), ...unmasteredCards(3)]
    const session = buildSession(pool, configFor({ tier: 2, size: 20 }), mulberry32(8), NOW)
    expect(session).toHaveLength(20)
    expect(countMastered(session)).toBe(17)
    expect(session.length - countMastered(session)).toBe(3)
  })

  it('returns nothing for an empty pool', () => {
    expect(buildSession([], configFor(), mulberry32(1), NOW)).toEqual([])
  })

  it('returns nothing when no card belongs to the configured decks', () => {
    const pool = unmasteredCards(5, 'deck-1')
    expect(buildSession(pool, configFor({ deckIds: ['deck-9'] }), mulberry32(1), NOW)).toEqual([])
  })

  it('produces the same order twice from the same seed', () => {
    const pool = [...masteredCards(25), ...unmasteredCards(25)]
    const first = buildSession(pool, configFor(), mulberry32(42), NOW)
    const second = buildSession(pool, configFor(), mulberry32(42), NOW)
    expect(ids(first)).toEqual(ids(second))
  })

  it('produces a different order from a different seed', () => {
    const pool = [...masteredCards(25), ...unmasteredCards(25)]
    const first = buildSession(pool, configFor(), mulberry32(42), NOW)
    const second = buildSession(pool, configFor(), mulberry32(1337), NOW)
    expect(ids(first)).not.toEqual(ids(second))
  })

  it('interleaves the two buckets rather than listing one after the other', () => {
    const pool = [...masteredCards(50), ...unmasteredCards(50)]
    const session = buildSession(pool, configFor({ tier: 4, size: 20 }), mulberry32(11), NOW)
    const firstTwelve = session.slice(0, 12)
    expect(countMastered(firstTwelve)).toBeGreaterThan(0)
  })
})

describe('recordAnswer', () => {
  const seen: CardStats = {
    gets: 2,
    misses: 1,
    history: [
      { at: NOW - 3 * MINUTE, got: true },
      { at: NOW - 2 * MINUTE, got: false },
      { at: NOW - MINUTE, got: true },
    ],
    lastSeenAt: NOW - MINUTE,
  }

  it('counts a get', () => {
    expect(recordAnswer(seen, true, NOW)).toMatchObject({ gets: 3, misses: 1, lastSeenAt: NOW })
  })

  it('counts a miss', () => {
    expect(recordAnswer(seen, false, NOW)).toMatchObject({ gets: 2, misses: 2, lastSeenAt: NOW })
  })

  it('appends the attempt to the end of the history', () => {
    expect(recordAnswer(seen, false, NOW).history.at(-1)).toEqual({ at: NOW, got: false })
  })

  it('leaves the stats it was given untouched', () => {
    const before = structuredClone(seen)
    recordAnswer(seen, true, NOW)
    expect(seen).toEqual(before)
  })

  it('caps the history at the twenty most recent attempts', () => {
    const full: CardStats = {
      gets: 25,
      misses: 0,
      history: Array.from({ length: 25 }, (_, i) => ({ at: NOW - (25 - i) * MINUTE, got: true })),
      lastSeenAt: NOW - MINUTE,
    }
    const after = recordAnswer(full, false, NOW)
    expect(after.history).toHaveLength(MASTERY_HISTORY_LIMIT)
    expect(after.history.at(-1)).toEqual({ at: NOW, got: false })
  })

  it('keeps lifetime counters that the history no longer covers', () => {
    const full: CardStats = {
      gets: 25,
      misses: 0,
      history: Array.from({ length: 25 }, (_, i) => ({ at: NOW - (25 - i) * MINUTE, got: true })),
      lastSeenAt: NOW - MINUTE,
    }
    expect(recordAnswer(full, true, NOW).gets).toBe(26)
  })

  it('records the first attempt on a never-seen card', () => {
    const fresh: CardStats = { gets: 0, misses: 0, history: [], lastSeenAt: null }
    expect(recordAnswer(fresh, true, NOW)).toEqual({
      gets: 1,
      misses: 0,
      history: [{ at: NOW, got: true }],
      lastSeenAt: NOW,
    })
  })
})

describe('QUIZ_TIERS', () => {
  it('lists the seven slider positions in order', () => {
    expect(QUIZ_TIERS).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
})

describe('QUIZ_SIZES', () => {
  it('offers the four session sizes of spec §6.1', () => {
    expect(QUIZ_SIZES).toEqual([10, 20, 50, 'all'])
  })
})

describe('defaultQuizConfig', () => {
  it('is front, tier 4, twenty cards', () => {
    expect(defaultQuizConfig(['deck-1'])).toEqual({
      deckIds: ['deck-1'],
      direction: 'front',
      tier: 4,
      size: 20,
    })
  })

  it('starts from no decks when it is given none', () => {
    expect(defaultQuizConfig().deckIds).toEqual([])
  })
})

describe('parseQuizConfig', () => {
  const stored: QuizConfig = {
    deckIds: ['deck-1', 'deck-2'],
    direction: 'back',
    tier: 6,
    size: 'all',
  }

  it('round-trips a config it wrote', () => {
    expect(parseQuizConfig(JSON.stringify(stored))).toEqual(stored)
  })

  it('falls back to the defaults when nothing is stored', () => {
    expect(parseQuizConfig(null)).toEqual(defaultQuizConfig())
  })

  it('falls back to the defaults rather than throwing on corrupt JSON', () => {
    expect(parseQuizConfig('{ not json')).toEqual(defaultQuizConfig())
  })

  it('falls back to the defaults when the stored value is not an object', () => {
    expect(parseQuizConfig('"front"')).toEqual(defaultQuizConfig())
    expect(parseQuizConfig('null')).toEqual(defaultQuizConfig())
    expect(parseQuizConfig('[1, 2]')).toEqual(defaultQuizConfig())
  })

  it.each([
    { field: 'direction', value: '{"direction":"sideways"}', expected: 'front' },
    { field: 'direction', value: '{"direction":7}', expected: 'front' },
  ])('replaces an unusable $field', ({ value, expected }) => {
    expect(parseQuizConfig(value).direction).toBe(expected)
  })

  it.each(['{"tier":0}', '{"tier":8}', '{"tier":"4"}', '{"tier":3.5}'])(
    'replaces an unusable tier in %s',
    (value) => {
      expect(parseQuizConfig(value).tier).toBe(4)
    },
  )

  it.each(['{"size":15}', '{"size":"20"}', '{"size":"every"}'])(
    'replaces an unusable size in %s',
    (value) => {
      expect(parseQuizConfig(value).size).toBe(20)
    },
  )

  it('keeps only the deck ids that are strings', () => {
    expect(parseQuizConfig('{"deckIds":["a",3,null,"b"]}').deckIds).toEqual(['a', 'b'])
  })

  it('takes no decks from a stored value that is not a list', () => {
    expect(parseQuizConfig('{"deckIds":"deck-1"}').deckIds).toEqual([])
  })

  it('keeps the fields it can read when others are unusable', () => {
    expect(parseQuizConfig('{"deckIds":["a"],"direction":"back","tier":99,"size":50}')).toEqual({
      deckIds: ['a'],
      direction: 'back',
      tier: 4,
      size: 50,
    })
  })
})
