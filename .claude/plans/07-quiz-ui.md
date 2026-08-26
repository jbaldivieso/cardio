# 07 — Quiz runner UI

Status: done
Depends on: 05, 06
Spec: §6.5, §6.6, §7.6, §7.7

## Goal

The heart of the app: a card fills the screen, tapping flips it, grading advances, and a
summary closes the loop.

## Deliverables

- `src/stores/quiz.ts` — session state machine (`configuring` → `running` → `complete`),
  the card list, index, flipped flag, answers, and the one-entry undo snapshot. Owns the
  clock and RNG; writes each answer through the repository immediately.
- `src/views/QuizRunView.vue`, `src/views/QuizSummaryView.vue` — replace placeholders.
- `src/components/QuizCard.vue` — the flip surface; `QuizProgress.vue`.
- Flip styling using `--cardio-flip-duration` (already defined, collapses to 0 under
  `prefers-reduced-motion`).
- Specs for the store and `QuizCard`.

## Tests first

Store:

- `start(cards, config)` sets `running`, index 0, not flipped.
- `flip()` reveals; grading before a flip is refused.
- `answer(true)` persists via the repository, appends to answers, advances the index and
  resets `flipped`.
- Answering the last card sets `complete`; summary totals are right (3 answered,
  2 got, 1 missed, 67% accuracy).
- `undo()` restores the previous card's `CardStats` verbatim, steps back, shows it
  flipped, and is unavailable at index 0 and after a second answer.
- `quizMissed()` builds a session of exactly the missed cards, same direction.
- `abandon()` clears the session and leaves recorded answers intact.

`QuizCard`:

- Shows only the configured face before the flip; the grading buttons are absent, not
  merely hidden.
- Click, `Space` and `Enter` all flip.
- After the flip both faces render, labelled, through `MarkdownText`.
- `1` / `←` grade missed; `2` / `→` grade got; each emits once.
- `aria-live` region announces the reveal.

## Acceptance

- [x] A full quiz can be run start to finish and the summary matches the answers.
- [x] Answers are already saved if you abandon mid-quiz (assert at the repository level).
- [x] Leaving mid-quiz confirms first.
- [x] Long faces scroll inside the card; the page never scrolls horizontally at 360 px.
- [x] Keyboard-only operation works end to end.

## Out of scope

How a quiz gets started (item 08) — during this item, drive it from a temporary dev
entry point or a direct store call in tests. Resume after reload is out of scope
entirely (ADR-010).
