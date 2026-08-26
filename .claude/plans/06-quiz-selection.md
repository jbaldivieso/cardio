# 06 — Quiz selection domain

Status: not started
Depends on: 02
Spec: §6.1–§6.4 (config, tiers, buildSession, recordAnswer)

## Goal

The pure core of the quiz: given a pool of cards and a config, produce the exact list of
cards to ask, deterministically under an injected RNG.

## Deliverables

- `src/domain/quiz.ts` — `QuizConfig`, `TIER_MASTERED_SHARE` (the seven values),
  `tierLabel(tier)`, `buildSession(cards, config, rng, now)`, `recordAnswer(stats, got,
now)`, `sampleWithoutReplacement`, `shuffle` (Fisher-Yates).
- `src/domain/quiz.spec.ts`.

## Tests first

Use a seeded RNG helper (e.g. mulberry32) so every assertion is exact.

- Length: result is exactly `min(size, pool.length)`; `size: 'all'` returns the whole
  pool; a pool of 3 with size 20 returns 3.
- Uniqueness: no card appears twice, ever.
- Composition at tier 4: pool of 50 mastered + 50 unmastered, size 20 → 12 unmastered,
  8 mastered. Size 10 → 6 / 4.
- Every tier's composition from the §6.2 table, with both buckets large enough.
- Tier 1 returns only cards with mastery ≤ 40; tier 7 only mastery ≥ 80.
- Tier 1 with no weak cards falls back to the full pool (non-empty result); same for
  tier 7 with none mastered.
- Shortfall backfill: 3 mastered, 40 unmastered, tier 6 (wants 15/20 mastered), size 20 →
  20 cards, 3 mastered + 17 unmastered.
- Empty pool → empty array, no throw.
- Determinism: same seed, same order; different seed, different order.
- `recordAnswer` is pure — the input `CardStats` object is not mutated — and caps history
  at 20.

## Acceptance

- [ ] `src/domain/quiz.ts` imports nothing outside `src/domain/`.
- [ ] No `Math.random()` or `Date.now()` in the module.
- [ ] 100% branch coverage, including every fallback path.

## Out of scope

Stores, persistence, UI (item 07).
