# Cardio

An offline-first flash-card PWA. Markdown cards, organised into decks and folders, with
a quiz that picks what to show you based on how well you actually know each card.

Live at **https://cardio.baldivieso.com/** — installable, and fully usable
offline. All data stays on the device in IndexedDB; there is no server and no account.

## Why the quiz is the point

Every answer you give ("Got it" / "Missed it") feeds a per-card **mastery** score built
from recency-weighted accuracy, how often you have seen the card, and how long ago. A
7-tier slider then decides the mix of the next quiz — from _only what I don't know_ to
_only what I know_ — defaulting to a 60/40 lean toward the cards you are weaker on.
The details, including exact test vectors, are in [`docs/spec.md`](docs/spec.md).

## Quick start

```bash
npm ci
npm run dev          # http://localhost:5173/
```

```bash
npm test             # unit + component tests
npm run test:watch   # the TDD loop
npm run verify       # lint + format + typecheck + unit tests + build
npm run e2e:install  # once per machine: download Chromium
npm run e2e          # Playwright happy path (builds and previews first)
```

Node 22+ is required.

## Layout

```
src/domain/      pure logic: mastery, quiz selection, markdown, parsing
src/db/          Dexie schema + repositories (the only IndexedDB code)
src/stores/      Pinia stores; own the clock and the RNG
src/components/  presentational components
src/views/       one per route
e2e/             Playwright specs
docs/            spec, decisions, original brief
.claude/plans/   the work, in order
```

## Documentation

| File                                     | What it is                                           |
| ---------------------------------------- | ---------------------------------------------------- |
| [`docs/spec.md`](docs/spec.md)           | The specification. Canonical.                        |
| [`docs/decisions.md`](docs/decisions.md) | Why each contested choice was made.                  |
| [`.claude/plans/`](.claude/plans/)       | Sequenced work items with tests-first checklists.    |
| [`CLAUDE.md`](CLAUDE.md)                 | Conventions and architecture rules for contributors. |

## Deployment

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml`. One-time setup: **Settings → Pages → Build and
deployment → Source: GitHub Actions**.

The site is served from the custom domain **cardio.baldivieso.com**, declared by
`public/CNAME` and set under **Settings → Pages → Custom domain**, with a DNS `CNAME`
record pointing `cardio` at `jbaldivieso.github.io`. Because the domain root is the site
root, the Vite `base` and the PWA manifest `scope` are both `/`; dropping the custom
domain means setting both back to `/cardio/`.

CI (`.github/workflows/ci.yml`) runs lint, format check, typecheck, unit tests with
coverage, the production build, and Playwright on every push to `main` and on any pull
request.

## Licence

MIT — see [LICENSE](LICENSE).
