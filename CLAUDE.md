# Cardio — working notes for Claude

Offline-first flash-card PWA. Vue 3 + TypeScript + Vite, Bulma for CSS, IndexedDB via
Dexie, deployed to GitHub Pages at `https://jbaldivieso.github.io/cardio/`. No server,
no accounts, no network calls at runtime.

**Read before writing code:**

- `docs/spec.md` — the specification. Canonical. Algorithms, screens, formats, exact
  test vectors.
- `docs/decisions.md` — why things are the way they are. Add an ADR when you deviate.
- `.claude/plans/` — the work, in order. Do one item at a time.

## Commands

| Command                     | Purpose                                                                |
| --------------------------- | ---------------------------------------------------------------------- |
| `npm run dev`               | Dev server on `http://localhost:5173/cardio/`                          |
| `npm test`                  | Unit + component tests once                                            |
| `npm run test:watch`        | The TDD loop                                                           |
| `npm run test:coverage`     | Coverage report                                                        |
| `npm run typecheck`         | `vue-tsc --noEmit`                                                     |
| `npm run lint` / `lint:fix` | ESLint                                                                 |
| `npm run format`            | Prettier write                                                         |
| `npm run build`             | Production build to `dist/`                                            |
| `npm run verify`            | lint + format + typecheck + unit + build. **Run before every commit.** |
| `npm run e2e`               | Playwright (builds and previews first)                                 |
| `npm run e2e:install`       | One-time browser download in a fresh VM                                |

## Architecture

```
src/
  domain/      Pure TypeScript. Models, mastery, quiz selection, markdown, parsing.
  db/          Dexie schema + repositories. The only place that touches IndexedDB.
  stores/      Pinia. Orchestrates repositories, holds UI state, owns clock and RNG.
  components/  Reusable presentational Vue components.
  views/       One per route. Thin: wire stores to components.
  router/      Route table. Route names are stable API for tests.
  styles/      Bulma entry + the few app-level styles.
```

Rules, in priority order:

1. **`src/domain/` imports nothing.** No Vue, no Pinia, no Dexie, no `@/db`, no
   `@/stores`, no browser globals. ESLint enforces it. This is what keeps the
   interesting logic testable as plain functions.
2. **No `Date.now()` or `Math.random()` in `src/domain/`.** Pass `now: number` and
   `rng: () => number` as parameters. Stores supply the real ones.
3. **Only `src/db/` imports Dexie.** Stores call repositories; components call stores.
4. **Views are thin.** Logic that deserves a test belongs in `domain/` or a store, not
   in an SFC.
5. **`v-html` appears in exactly one component**, `MarkdownText.vue`, rendering only
   `renderMarkdown()` output (spec §8).

## How to work

Red/green TDD, genuinely:

1. Read the plan item and the spec sections it cites.
2. Write the failing test first. Run it. **See it fail for the right reason.**
3. Write the least code that makes it pass.
4. Refactor with the test green.
5. `npm run verify`, plus `npm run e2e` if UI changed.

The spec's test vectors (§5.4, §6.3) are exact expected values — type them in as tests
before implementing. If your implementation disagrees with a vector, the implementation
is wrong; if you are convinced the vector is wrong, stop and say so rather than editing
the spec quietly.

One test asserts one behaviour, named for the behaviour (`it('demotes a card after a
fresh miss')`). Test rendered output and public behaviour, never component internals or
store privates.

### Per plan item

- Stay inside the item's scope. Something out of scope but worth doing goes at the
  bottom of the plan file as a note, not into the diff.
- Delete the `PlaceholderPanel` usage the item replaces. Delete
  `src/components/PlaceholderPanel.vue` itself with the last one.
- Update the item's `Status:` line when done, and record deviations in
  `docs/decisions.md`.
- Branch per item (`git switch -c 03-folder-crud`), open a PR, keep commits small with
  imperative subjects ("Add folder repository", not "feat: added stuff"). No
  conventional-commit prefixes.

## Conventions

- Vue 3 `<script setup lang="ts">`, Composition API, no Options API, no mixins.
- SFC order: `<script setup>`, `<template>`, `<style scoped>` (last resort — reach for
  Bulma classes first).
- TypeScript `strict`. No `any` (ESLint error). `import type` for type-only imports
  (`verbatimModuleSyntax` is on).
- Import via the `@/` alias, not `../../`.
- Bulma classes over custom CSS. Custom CSS only for the quiz card's 3D flip and
  layout that Bulma genuinely lacks; keep it in the SFC's scoped block or
  `src/styles/main.scss` if shared.
- Mobile-first. Interactive targets ≥ 44×44 px.
- Add `data-testid` to anything an e2e test needs to reach. Query by testid or by
  accessible role/text, never by CSS class.
- IDs: `crypto.randomUUID()`. Timestamps: epoch ms.
- Unit tests colocated as `src/**/foo.spec.ts`. Playwright specs only in `e2e/`.

## Gotchas

- **Base path is `/cardio/`.** The dev server and preview serve the app at
  `/cardio/`, not `/`. Playwright's `baseURL` already accounts for it; use relative
  `page.goto('./')`.
- **Hash router.** Deep links look like `/cardio/#/decks/:id`. URL assertions in tests
  must include the `#`.
- **`npm run e2e` builds first** (its `webServer` runs `npm run build && npm run
preview`), so it is slow — a minute or two. Run unit tests during development and
  e2e before pushing.
- **Fresh VM:** `npm ci && npm run e2e:install` before the first Playwright run.
- **IndexedDB in unit tests** comes from `fake-indexeddb`, loaded by
  `src/test/setup.ts`. Give every test its own database name
  (`new CardioDb("cardio-test-" + crypto.randomUUID())`) and delete it in `afterEach`;
  shared names leak state between tests.
- **The service worker is off in dev** (`devOptions.enabled: false`). Test PWA
  behaviour against `npm run build && npm run preview`.
- **Dexie schema:** never edit `version(1)`. Add a new version with an `upgrade()` and a
  test that starts from a v1 database.
- Bulma emits Sass deprecation warnings; `quietDeps` silences them. Not our bug, do not
  "fix" Bulma.

## Do not

- Add a runtime dependency without an ADR in `docs/decisions.md` explaining why.
- Make any network request at runtime, including fonts, CDNs or analytics.
- Build anything listed as out of scope in spec §2 (auth, sync, media, spaced-repetition
  scheduling, search, tags, per-direction stats, quiz resume, undo of deletes).
- Regenerate the icons in `public/`.
- Bump `Card.updatedAt` when recording a quiz answer (spec §4.2).
- Leave `console.log` in committed code.
- Commit with a failing or skipped test. If a test must be disabled, explain why in the
  PR and in the plan file.
