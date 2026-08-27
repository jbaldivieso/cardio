# 11 — PWA polish

Status: done
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

- [x] Offline cold start works after one visit.
- [x] Manifest `scope` and `start_url` are still `/cardio/`.
- [x] No runtime request to any third-party origin (check the network panel).
- [x] Lighthouse PWA checks pass on the built preview (installable, offline-ready).

## Out of scope

Push notifications, background sync, update prompts (§12: no update UI in v1).

## Notes

### The offline check, as run

Against `npm run build && npm run preview` (`http://localhost:4173/cardio/`), driving a
real Chromium. Each step is spec §12's wording made concrete:

1. **Load once, online.** Wait for `navigator.serviceWorker.controller`, then count the
   precache: 33 entries, which is every file in `dist/` except `sw.js`, its Workbox
   runtime and `.nojekyll`. Create a folder through the UI so there is data to lose.
2. **Go offline, cold start.** Close the tab, open a new one with the network off, and
   navigate to `/cardio/`, `#/settings`, `#/quiz/configure` and an unknown route in turn.
   All four render; the folder from step 1 is still listed; no request fails.
3. **Third-party origins.** Every request the context made, across both steps, was to
   `localhost:4173`.

**Result: all of it passes.** The lazily-imported route chunks are precached, so a route
first visited offline still loads.

### Installability, since Lighthouse no longer has a PWA category

Chrome's own verdict, read through `Page.getInstallabilityErrors` on the built preview in
a real profile: **no errors**, and `beforeinstallprompt` fires. (In Playwright's default
incognito context the only error is `in-incognito`, which masks everything else — the
check has to run against a persistent profile to mean anything.) The manifest parses with
no errors, `scope` and `start_url` are `/cardio/`, `display` is `standalone`,
`orientation` is `portrait`, the theme colour matches the `<meta>` tag, and all three
manifest icons are served.

### A second deploy

Built a second time with a different version stamp, served from the same URL. Load one
after that deploy still shows the old version while the new worker installs behind it;
the load after shows the new one, with no prompt and no cache clearing — which is §12's
"updates in the background and applies on the next load". `cleanupOutdatedCaches` leaves
exactly one cache bucket.

Note that only a real navigation triggers the update check: a hash-only change is a
same-document navigation, so it neither re-fetches `sw.js` nor reloads the app.

### The precache manifest had five entries twice

`includeAssets` named `favicon.svg` and `apple-touch-icon.png`, and the plugin adds the
three manifest icons of its own accord — all five are in `public/`, so
`workbox.globPatterns` had already swept them out of `dist/`. Workbox de-duplicated them
at runtime (33 entries cached either way), so nothing was broken; the build log simply
claimed 38 entries. `includeManifestIcons: false` and no `includeAssets` leaves the glob
as the single source of what is cached.

### Not done here

- **Installing on a real phone** — no device in this environment. The manifest, the
  icons and Chrome's installability verdict are as far as automation reaches; the
  home-screen icon, the standalone launch and the portrait lock still want one look on
  hardware.
- **An offline e2e spec.** The check above is a script run by hand, so nothing guards
  offline start in CI. It would sit naturally beside item 12's happy path, and needs its
  own Playwright project: the SW is only present in a build, and the test has to survive
  a context that is offline from the second step onwards.
