# Decisions

Short records of the choices that were contested, and why they landed where they did.
Add an entry whenever you deviate from `docs/spec.md` or introduce a dependency.
Never rewrite history here — supersede an entry with a new one.

---

## ADR-001 — Mastery is decayed recent accuracy

**Decision.** Mastery is `100 × recentAccuracy × exposure × staleness`, an integer 0–100
(spec §5.2). Weighted over the last 10 attempts (decay 0.85), damped below 5 lifetime
attempts, and decayed toward half credit with a 60-day half-life.

**Why.** It is a pure function of stored history, so it is trivially unit-testable and
tunable later without a migration. It separates three things a single counter cannot:
_how well_ you answer, _how sure we are_, and _how long ago_.

**Alternatives.** `gets − misses` (the brief's simplest option) — rejected: no temporal
element, so a card missed heavily long ago reads as permanently mastered. Leitner boxes
— rejected: only six levels, too coarse for a 7-tier slider. SM-2/FSRS scheduling —
rejected as a product change: it makes a due-queue the primary entry point and demotes
the mastery slider the brief is built around.

**Consequence.** History must be retained per card (capped at 20 attempts), not just
counters.

## ADR-002 — One stat record per card; direction is presentational

**Decision.** A card has a single `CardStats`. Front-to-back and back-to-front answers
feed the same counters.

**Why.** Chosen explicitly over per-direction tracking for a smaller model, half the
tests, and one unambiguous number per deck.

**Consequence.** Heavy practice in one direction inflates the apparent mastery of the
other. Accepted for v1. Revisiting means adding `statsByDirection` and a migration —
the mastery functions themselves would not change.

## ADR-003 — Stats live on the card row

**Decision.** `stats` is a nested object on the card record, not a separate table.

**Why.** Stats are read with the card every single time and never queried by value. One
table, one write per answer, no join.

**Consequence.** Each answer rewrites the whole card row. Irrelevant at this scale.

## ADR-004 — Hash routing

**Decision.** `createWebHashHistory` with `base: '/cardio/'`.

**Why.** GitHub Pages cannot rewrite unknown paths to `index.html`. The usual
`404.html` copy trick works but costs a redirect and breaks deep-link tests subtly.
Hash routing is simply immune.

**Consequence.** URLs look like `/cardio/#/decks/abc`. Acceptable for a personal PWA
launched from the home screen.

## ADR-005 — Dexie over raw `idb`

**Decision.** Dexie 4 behind a repository layer in `src/db/`.

**Why.** Declarative schema and versioned upgrades, real transactions, typed tables.
The repository layer keeps Dexie out of stores and components so it stays replaceable.

**Consequence.** ~25 kB gzipped. No component or domain module may import Dexie
directly; ESLint enforces the domain half of that.

## ADR-006 — Tier 4 is 60/40, so the exact middle is not offered

**Decision.** Tier composition is 100/0, 90/10, 75/25, **60/40**, 45/55, 25/75, 0/100
(unmastered/mastered), defaulting to tier 4.

**Why.** The brief asked for both "the middle being an even mix" and "default: the 4th
tier … 60/40". With seven tiers those cannot both hold. The default matters more than
the symmetry, so tier 4 is 60/40 and an exact 50/50 falls between tiers 4 and 5.

**Consequence.** The slider is unmastered-leaning by design, which matches where
practice value actually sits.

## ADR-007 — Mastered ≥ 80, weak ≤ 40

**Decision.** `MASTERED_MIN = 80`, `WEAK_MAX = 40`.

**Why.** At 70, `GGGGM` — four gets and then a fresh miss — scored 73 and read as
"mastered", which is indefensible. At 80 that card is `learning` (73) while a single
slip after nine gets still holds `mastered` (81), and four clean gets is exactly the
bar. The weak boundary at 40 makes "one or two gets, or any card you keep missing"
eligible at the unmastered end of the slider.

## ADR-008 — Uniform sampling within each bucket

**Decision.** Once the tier fixes how many mastered and unmastered cards a session
takes, cards inside each bucket are chosen uniformly at random.

**Why.** The tier slider is the user-facing knob; a second, invisible weighting
(favouring the weakest or the stalest card) would make sessions harder to reason about
and to test. Deferred, not rejected.

## ADR-009 — Deck mastery counts new cards in the denominator

**Decision.** `masteredPct = round(100 × mastered / total)` over all cards in the deck.

**Why.** An untouched deck must read 0%, not 100% or "n/a". The three-segment bar
carries the nuance the single number cannot — mastered, learning, and never tried are
three states, as the brief noted.

## ADR-010 — No quiz resume in v1

**Decision.** A session is in-memory; reloading or navigating away loses the queue.

**Why.** Explicitly deprioritised against export/import, bulk add and dark mode. Every
answer is written the moment it is given, so nothing is actually lost except position.

## ADR-011 — Bulma 1.x via Sass, with its native `data-theme` dark mode

**Decision.** `@use 'bulma/sass'` from `src/styles/main.scss`; theme by
`data-theme="light|dark"` on `<html>`.

**Why.** Bulma 1 ships dark mode as CSS custom properties keyed off `data-theme`, so no
second stylesheet and no class juggling. Sass entry keeps variable overrides in one
place. Bulma's own deprecation warnings are silenced with `quietDeps`.

## ADR-012 — `html: false` in markdown-it instead of a sanitiser

**Decision.** Disable raw HTML (and the `image` rule) in markdown-it. No DOMPurify.

**Why.** With HTML escaping done by the parser there is no injection surface to
sanitise, and one fewer dependency. Images are disabled because they would fetch remote
resources, which an offline-only app must not do.

**Consequence.** `v-html` is allowed in exactly one component, `MarkdownText.vue`, which
renders only `renderMarkdown()` output.

## ADR-013 — Hard delete, no undo

**Decision.** Deletes cascade immediately inside a transaction, behind a confirmation
that names the counts. No trash, no soft-delete flag.

**Why.** Soft delete leaks into every query and aggregate for a single-user local app.
JSON export is the real safety net.

## ADR-014 — Vitest for units and components, Playwright for one happy path

**Decision.** Colocated `src/**/*.spec.ts` under Vitest with happy-dom; Playwright
confined to `e2e/` and to the happy path, on desktop Chromium and Pixel 5.

**Why.** Fast feedback where TDD happens, and a browser only where the real thing needs
proving (IndexedDB, service worker, touch). Colocation keeps a test beside the unit it
describes. The two runners never see each other's files: Vitest globs `src/`, Playwright
`testDir: './e2e'`.

## ADR-015 — Epoch milliseconds, injected clock and RNG

**Decision.** All timestamps are `number`. Domain functions take `now` and `rng`
parameters; only stores and components read the real clock or `Math.random()`.

**Why.** Dexie indexes numbers natively, `Date` round-trips through IndexedDB
inconsistently, and injected time is the only way mastery decay and shuffling can be
tested exactly (spec §5.4).

## ADR-016 — Scaffold decisions worth knowing

- `noUncheckedIndexedAccess` is deliberately **off**: the quiz sampling code indexes
  arrays constantly and the friction outweighed the benefit. `strict` is on.
- `verbatimModuleSyntax` is on, so type-only imports must say `import type`.
- The `@/` alias maps to `src/` in `tsconfig.json`, `vite.config.ts` and
  `vitest.config.ts` — all three must be updated together.
- ESLint forbids `src/domain/**` from importing Vue, Pinia, Dexie, `@/db/*` or
  `@/stores/*`. That rule is the architecture, not a style preference.

## ADR-017 — Repositories are factories over a database, with one validation error

**Decision.** `src/db/repositories` holds one repository per entity —
`createFolderRepo`, `createDeckRepo`, `createCardRepo`, plus `createLibraryRepo` for the
whole-library replace of §10 — each a factory taking a `CardioDb` and defaulting to the
shared instance, plus a bound singleton (`folderRepo`, `deckRepo`, `cardRepo`,
`libraryRepo`) for stores to import. Write methods take `now` as a **required** trailing
parameter. Everything that breaks a §4.2 invariant — an empty name, an over-long face, a
`folderId` or `deckId` that does not resolve, a target row that has disappeared, an
attempt to delete Unsorted — throws `ValidationError` carrying the `field` it belongs
to.

**Why.** The factory is what makes per-test isolation against `fake-indexeddb` possible
without a module-level reset hook, so every spec really can have its own database name.
`now` is required rather than defaulted because a default is a second, invisible clock:
the store owns `Date.now()` and passing it explicitly is what keeps timestamps exactly
assertable, mastery decay being measured in days. One error type with a
`field` gives a form something to attach a message to; a second class would only have to
be discriminated at every call site to say the same thing.

**Consequence.** Stores import `@/db/repositories/folders` and friends directly rather
than a barrel, because a barrel in `@/db` would import the modules that import it.
Methods that mutate a named row (`rename`, `move`, `update`, `recordAttempt`,
`saveStats`) reject when the row is gone, while `remove` is idempotent — a stale list
offering delete twice should not throw. Both stats writers trim `history` to
`MASTERY_HISTORY_LIMIT` on the way in, so the §4.2 cap holds at the storage boundary
whatever the caller hands over: `recordAttempt(id, got, now)` is the quiz's one-answer
write (§6.4), `saveStats(id, stats)` the wholesale one that undo restores through
(§6.5). Neither touches `updatedAt`.

The §4.2 rules themselves live in `src/domain/validation.ts` rather than `src/db`, which
is a deliberate departure from the plan's file list: `src/domain/backup.ts` has to apply
exactly the same rules to every imported row (§10) and ESLint forbids `src/domain/**`
from importing `@/db/*`. Putting them in `src/db` would have forced item 10 to duplicate
them.

## ADR-018 — Listing order is fixed in JavaScript, not by index

**Decision.** Folders and decks list alphabetically via
`localeCompare(…, { sensitivity: 'base' })`; cards list newest first by `createdAt`. All
three sorts happen after the query rather than through a Dexie index.

**Why.** Spec §2 puts user-selectable sort orders out of scope, so the order only has to
be the least surprising one. IndexedDB's index order is case-sensitive, which files
`Zebra` before `apple` and reads as a bug. Cards go newest first because §7.4's "Save and
add another" makes runs of new cards the common case, and a card just typed belongs at
the top of its deck rather than buried under two hundred older ones. `createdAt` is
deliberately not indexed — §4.3 fixes the version 1 indexes, and adding one to sort a few
thousand rows would cost a migration.

**Consequence.** The `name` indexes §4.3 declares are carried for future range queries
rather than used for ordering.

## ADR-019 — The durability request is scoped to the database instance

**Decision.** Every repository write goes through `durableWrite(database, …)`, which runs
the write and then, once per `CardioDb` instance, fires `navigator.storage.persist()`
without awaiting it.

**Why.** §4.5 asks for the request on the first _successful_ write, which rules out both
asking on every write — Firefox prompts — and asking at boot, before the user has
anything worth keeping. Keying "already asked" to the database instance rather than to
the module means a test's throwaway database starts fresh without exporting a reset hook
that exists only for tests.

**Consequence.** A failed write never triggers the request, and a missing or rejecting
Storage API resolves to `false` rather than failing the write that triggered it.
