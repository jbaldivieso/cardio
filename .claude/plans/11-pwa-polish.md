# 11 — PWA polish

Status: not started
Depends on: 07
Spec: §12, §13

## Goal

Prove and finish the installable, offline-capable behaviour the brief asks for.

## Deliverables

- Verified manifest and icon set (already generated — do not regenerate).
- An install hint on the settings screen when `beforeinstallprompt` is available or on
  iOS, and nothing when already installed (`display-mode: standalone`).
- A documented offline check in `docs/spec.md` §12 terms, run manually and recorded in
  the PR.
- Any fix needed so the app shell and route chunks are all precached.

## Tests first

Unit/component:

- The install hint renders only when not already installed (mock `matchMedia` and the
  event).

Manual checklist (record the result in the PR):

- `npm run build && npm run preview`, load once, go offline, cold reload → app works,
  data intact.
- Install to the home screen on a phone; it opens standalone, in portrait, with the
  right icon and theme colour.
- A second deploy is picked up on the next load without a manual cache clear.

## Acceptance

- [ ] Offline cold start works after one visit.
- [ ] Manifest `scope` and `start_url` are still `/cardio/`.
- [ ] No runtime request to any third-party origin (check the network panel).
- [ ] Lighthouse PWA checks pass on the built preview (installable, offline-ready).

## Out of scope

Push notifications, background sync, update prompts (§12: no update UI in v1).
