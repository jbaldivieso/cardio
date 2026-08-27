# 12 — E2E happy path

Status: done
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

- [x] Passes on both the `desktop` and `mobile` projects.
- [x] Uses testids or accessible roles — never CSS classes or `nth-child`.
- [x] No arbitrary `waitForTimeout`; wait on state.
- [x] Runs in CI (the `e2e` job) in under two minutes.
- [x] `e2e/smoke.spec.ts` is deleted.

## Out of scope

Import/export, theme switching, folder moves, error paths — all covered by unit and
component tests (§14).

## Notes

### The bar's headline does not move, so the assertion is its label

Three cards answered once each score 20, 20 and 0 (§5.2: one attempt is 1/5 exposure),
which is `learning` three times over and `0% mastered` before and after. The change step
8 is there to catch is in the bands, not the percentage, so the spec asserts the track's
`aria-label` — `0% mastered, 0 learning, 3 new` becoming `0% mastered, 3 learning, 0 new`
— alongside the badges going from `new` to `20%`/`0%`.

### Two lists have no order to assert

Bulk add writes its batch on one timestamp, so `byNewestFirst` leaves the three card rows
in whatever order IndexedDB returns them; the quiz queue is shuffled. Both are compared
as sorted sets through `expect.poll`, and the missed card is read back off the prompt
rather than assumed.

### No new testids were needed

Every element the path touches already had one. `getByRole('link', { name: 'Spanish' })`
covers the two navigations where a name is the more honest locator.

### Cost

1.3–1.6 s per project, ~10 s for the run including the build the `webServer` does first.
Ten repeats across both projects passed with no flake, including the 220 ms flip, which
Playwright's own stability wait covers without a timeout.
