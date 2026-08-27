# 09 — Mastery display

Status: done
Depends on: 02, 04
Spec: §5.5, §7.9, §7.3

## Goal

Show what the user knows: a three-segment bar per deck and folder, and a badge per card.

## Deliverables

- `src/components/MasteryBar.vue` — stacked mastered / learning / new segments plus the
  headline `masteredPct`, with the §7.9 `aria-label`.
- `src/components/MasteryBadge.vue` — `new` or `NN%` for a single card.
- Summary memoisation in the store, invalidated on any card write or quiz answer.
- Wire into `FolderRow`, `DeckRow`, `CardRow`.
- Specs.

## Tests first

- Segment widths are proportional and sum to 100% for a mixed deck (5 mastered,
  3 learning, 2 new → 50 / 30 / 20).
- A zero-card deck renders an empty track and "No cards yet", not `NaN%`.
- All-new deck reads 0% mastered.
- `aria-label` matches the spec wording.
- The badge shows `new` for an unattempted card and the integer percentage otherwise.
- Answering a card invalidates the cached summary for its deck and nothing else.
- Colours come from Bulma modifiers (`is-success` / `is-warning` / neutral), asserted by
  class, and hold in both themes.

## Acceptance

- [x] Bars appear on folder rows, deck rows, and badges on card rows.
- [x] Numbers update immediately after a quiz ends without a reload.
- [x] No mastery computation inside a `v-for` body (§13) — summaries come from the store.

## Out of scope

Charts, history graphs, per-direction breakdowns.

## Notes

- The memo lives in a store of its own, `src/stores/mastery.ts`, which the writer
  invalidates: see docs/decisions.md > ADR-032 for why that is not the sideways write
  ADR-024 rules out.
- The quiz store closes the second acceptance box: after each answer it records — and
  each one an undo takes back — it calls `mastery.invalidate(deckId)`, which is what the
  cards store already does after a card write. Both paths are covered by store specs, and
  the screens re-read what a write dropped without being remounted.
- `segmentWidths` (domain) hands the bar whole percentages that add up to 100 —
  ADR-033.
- Rebased onto items 06–08 after they landed. The quiz rows and the bars share those
  rows; the bar takes a line of its own beneath the name and the actions.
