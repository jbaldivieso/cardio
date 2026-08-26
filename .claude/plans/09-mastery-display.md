# 09 — Mastery display

Status: not started
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

- [ ] Bars appear on folder rows, deck rows, and badges on card rows.
- [ ] Numbers update immediately after a quiz ends without a reload.
- [ ] No mastery computation inside a `v-for` body (§13) — summaries come from the store.

## Out of scope

Charts, history graphs, per-direction breakdowns.
