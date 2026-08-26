# 02 — Mastery domain

Status: done
Depends on: 00
Spec: §5 (constants, formula, edge cases, test vectors, aggregates)

## Goal

`mastery()`, `band()` and the deck/folder summaries, as pure functions matching the
spec's vectors exactly.

## Deliverables

- `src/domain/mastery.ts` — constants, `mastery(stats, now)`, `band(stats, now)`,
  `isWeak(stats, now)`, `isMastered(stats, now)`.
- `src/domain/aggregates.ts` — `summarise(cards, now): MasterySummary`, plus a folder
  roll-up that sums deck summaries.
- Colocated specs.

## Tests first

Type the whole vector table from spec §5.4 as a table-driven test — nineteen rows,
exact integers. Then the edge cases:

- Zero attempts → mastery 0, band `new`.
- Counters without history → falls back to lifetime accuracy (`4G/1M`, 5 days → 78).
- `lastSeenAt: null` with counters → `staleness = 1`.
- `now < lastSeenAt` → clamped, never above 100.
- Result is always an integer in 0..100.
- History longer than the window: only the last 10 entries count.
- `MASTERED_MIN` / `WEAK_MAX` boundaries are inclusive: 80 is mastered, 40 is weak.

Aggregates:

- Empty deck → `{ total: 0, new: 0, learning: 0, mastered: 0, masteredPct: 0 }`.
- Counts always sum to `total`.
- `masteredPct` counts new cards in the denominator: 3 mastered of 10, 5 never tried
  → 30%.
- Folder roll-up equals the sum of its decks.
- One pass: `summarise` must not be O(n²) — assert by construction, not timing.

## Acceptance

- [x] Every spec §5.4 vector passes unmodified.
- [x] `src/domain/**` imports nothing (ESLint rule stays quiet).
- [x] No `Date.now()` anywhere in the module.
- [x] Branch coverage for both files at 100%.

## Out of scope

Rendering the numbers (item 09), quiz selection (item 06).

## Notes

- The folder roll-up is `combineSummaries(summaries)`, taking already-computed deck
  summaries rather than a flat card list, so the store can memoise per deck (§5.5) and
  reuse each deck's summary for both its own row and its folder's.
- `isWeak` and `isMastered` are the two hard filters of the quiz slider (§6.2); item 06
  consumes them rather than re-comparing against the constants.
- All nineteen §5.4 vectors passed unmodified. 100% statement, branch, function and line
  coverage on both files.
