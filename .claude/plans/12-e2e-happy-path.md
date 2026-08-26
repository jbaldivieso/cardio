# 12 — E2E happy path

Status: not started
Depends on: 08, 09
Spec: §14

## Goal

One Playwright spec that walks the whole app the way a person does, on desktop and
mobile viewports. Happy path only — no edge cases, no error states.

## Deliverables

- `e2e/happy-path.spec.ts`, replacing `e2e/smoke.spec.ts`.
- Any missing `data-testid`s added to components (not to tests' assumptions).

## The path

1. Start on an empty app. Create a folder "Spanish".
2. Open it, create a deck "Verbs".
3. Bulk-add three cards (`hablar|to speak`, `comer|to eat`, `vivir|to live`).
4. Confirm the deck shows 3 cards and 0% mastered.
5. Quickstart a quiz from the deck row.
6. Flip, grade got; flip, grade got; flip, grade missed.
7. Summary shows 3 answered, 2 got, 1 missed, 67%.
8. Return to the deck; the mastery bar and card badges have changed from step 4.

## Acceptance

- [ ] Passes on both the `desktop` and `mobile` projects.
- [ ] Uses testids or accessible roles — never CSS classes or `nth-child`.
- [ ] No arbitrary `waitForTimeout`; wait on state.
- [ ] Runs in CI (the `e2e` job) in under two minutes.
- [ ] `e2e/smoke.spec.ts` is deleted.

## Out of scope

Import/export, theme switching, folder moves, error paths — all covered by unit and
component tests (§14).
