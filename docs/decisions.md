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

## ADR-020 — Stores reach their repositories through one swappable record

**Decision.** Stores import `repositories` from `src/stores/repositories.ts` — a single
record holding the `folderRepo`, `deckRepo` and `cardRepo` singletons — rather than
importing each singleton directly. `src/test/repositories.ts` swaps its three entries for
repositories bound to a per-spec `CardioDb` and restores them afterwards.

**Why.** Every spec needs its own database name (CLAUDE.md > Gotchas), but the singletons
are bound to the real `db` at import time. The alternatives were worse: `vi.mock` of three
modules in every store and component spec, repeated per file and re-resolving the mocked
binding on each access; or fake repositories, which would have tested the store against a
stub instead of against Dexie, leaving "create persists" unproven. With the record, store
and component specs exercise the real repositories over `fake-indexeddb`, so a store test
that writes and reloads really does prove persistence.

**Consequence.** One mutable module-level record exists that application code only reads.
Component specs get the same seam for free, which is what lets `FoldersView.spec.ts` mount
the real view over a real database. Specs that mount a view must wait for the database to
open — `fake-indexeddb` resolves its first read over several turns of the event loop, so
`flushPromises()` alone is not enough and `vi.waitUntil` / `vi.waitFor` are used instead.

## ADR-021 — Confirmation wording is a pure function, over counts already in the store

**Decision.** `src/domain/prompts.ts` builds the §4.4 sentence
(`deleteFolderPrompt`, `countLabel`); the counts it is given come from the library store's
single pass over the loaded decks, not from a `folderRepo.contents()` query per row.

**Why.** The exact wording is an acceptance criterion, and a pure function makes it
assertable without mounting a dialog — pluralisation included, which is the part that
would otherwise be untested logic inside an SFC. The counts are already loaded to render
each row ("2 decks · 6 cards"), so querying them again on the way into the dialog would
be a second source of truth for the same number, and an async step between the click and
the dialog opening.

**Consequence.** `folderRepo.contents()` is currently unused by the app. It stays as the
repository-level answer to the same question, which item 10's export path can use.
A confirmation is only as fresh as the last `load()`; for a single-user offline app with
no background writer, that is exactly as fresh as the row the user just clicked.

## ADR-022 — Route parameters reach a screen as props

**Decision.** Routes with parameters are declared `props: true`, so `FolderView` takes
`folderId` as a prop rather than reading `useRoute().params`. Route names and paths — the
stable API tests rely on (§7) — are untouched.

**Why.** A screen that takes its subject as a prop is a plain component: its spec mounts
it with `props: { folderId }`, with no router to build, no history to seed and no
navigation to await. Reading the parameter inside the view would have pulled a real router
into every view spec purely to supply one string.

**Consequence.** Views declare exactly what they need from the URL, and a missing or
unknown id is handled in one place — the "that folder is not here" branch — rather than
depending on what the router happened to put in `params`.

## ADR-023 — The markdown cache is a general memoiser, not private state

**Decision.** `src/domain/memoise.ts` provides `memoise(compute, limit)`, a bounded
least-recently-used cache around a pure function. `renderMarkdown` is that function applied
to markdown-it with a 500-entry limit (§8).

**Why.** §8 asks for memoisation _and_ a bound, but a bound has no observable effect through
`renderMarkdown`: strings compare by value, so a cache hit and a re-render are
indistinguishable from outside. Keeping the cache private would have left "bounded" either
untested or tested through a hook that exists only for tests. As its own function it is
testable the honest way — a spy counts how often the wrapped function actually runs, which
is what proves both the caching and the eviction.

**Consequence.** One more domain module, reusable for item 09's per-deck summaries, which
have the same shape of problem. `Map` insertion order is what makes the LRU work: reading an
entry deletes and re-sets it, so the oldest key is always the first one out.

## ADR-024 — The cards store does not write back into the library's counts

**Decision.** `src/stores/cards.ts` owns the card list of the deck on screen. Adding or
deleting a card does not adjust the deck and folder counts held by `src/stores/library.ts`.

**Why.** Every screen calls `load()` on mount, so the counts a user sees after navigating
back are read from the database, not from whatever a previous screen remembered. Wiring the
cards store into the library's counters would add a second way for those numbers to be
right, and a way for them to drift — the count would then have two authors, one of which
(the loader) periodically overwrites the other.

**Consequence.** The two stores stay independent, and neither imports the other. The counts
are as fresh as the last mount, which for a single-user offline app with no background
writer is always. If a future screen ever shows a live count beside a card list without
remounting, it should read `cards.cards.length` rather than have the cards store push a
number sideways.

## ADR-025 — A dialog holding typed input survives a refused write

**Decision.** `NameDialog`, `MoveDialog` and `BulkAddDialog` take an `error` prop and stay
open when the write behind them is rejected, showing the reason inside the dialog with the
input still in it. `ConfirmDialog` closes either way and lets the screen's error banner
explain.

**Why.** Every dialog used to close unconditionally, so a rejected write threw away what
the user had typed along with the attempt. That is cheap for a folder name and expensive
for a bulk paste — a batch assembled over several minutes could vanish because of one bad
line, with a message that named no line. The split is about what there is to lose: a
confirmation holds nothing, so keeping it open would only hide the banner that explains
the failure, since a modal covers the screen the banner is on. That covering is also why
a dialog that stays open must carry the message itself: staying open without one is worse
than closing, because the reason ends up behind the modal.

**Consequence.** Each view owns a `dialogError` alongside `dialog`, and `openDialog()` is
the one way to change either, so the error cannot outlive the dialog that caused it. The
store's own `error` still drives the screen-level banner; the dialog copy is a snapshot
taken at the moment a submit failed.

## ADR-026 — Bulk add checks face length, which §9 does not list

**Decision.** `parseBulk` reports a face longer than `FACE_MAX_LENGTH` as a numbered
error, alongside the missing-separator and empty-face cases §9 does enumerate.

**Why.** §9's list is about lines the parser cannot read, and §4.2's length limit is
enforced at the repository. Between the two sat a gap: an over-long line parsed clean,
then `createMany` rejected the entire batch with a message that named no line number,
because validation there is per-face and not per-line. Checking it during the parse puts
the complaint where every other complaint about a line already goes.

**Consequence.** `src/domain/bulkParse.ts` imports `FACE_MAX_LENGTH` from
`src/domain/validation.ts` — domain to domain, so the layer stays pure. The repository
still validates, since it is the boundary that has to; the parser now just makes sure the
batch it hands over will pass.

## ADR-027 — The card row is a pointer shortcut, not a button

**Decision.** `CardRow`'s whole-row click has no `role="button"` and no `tabindex`. The
row's own **Edit** button is the focusable control that reaches the editor.

**Why.** §7.3 asks that tapping a row open the editor. Making the row itself a button
would nest interactive elements inside it — the row's Edit and Delete buttons, plus any
link the front's markdown rendered — which assistive technology handles worse than a
plain container, and the front cannot be wrapped in a `<button>` for the same reason. A
duplicate control that is already reachable is the better answer than a role that lies
about the element's contents.

**Consequence.** `cursor: pointer` (`.cardio-tappable`) carries the affordance for
pointer users. Anyone tempted to "fix" the missing role should read this first: the
keyboard path is Edit, and it is tested.

## ADR-028 — The slider's middle three tiers needed labels §6.2 does not give

**Decision.** `tierLabel` returns, for tiers 1–7: "Only what I don't know", "Mostly
unmastered", "Leaning unmastered", "A mix of both", "Leaning mastered", "Mostly
mastered", "Only what I know".

**Why.** §6.2's table labels only tiers 1, 2, 6 and 7; tier 4's cell reads "Default",
which designates the starting position rather than describing the mix, and tiers 3 and 5
are blank. A seven-stop slider has to say something at every stop — §7.5 shows the label
beside it and item 08 asserts `aria-valuetext` — so the three gaps are filled with a
scale that reads monotonically from one hard filter to the other.

**Why not "Balanced" at tier 4.** Tier 4 is 60/40 unmastered-leaning on purpose
(ADR-006). Calling it balanced would advertise the even split that decision explicitly
declined to offer, so "A mix of both" says what is true without claiming 50/50.

**Consequence.** The four labels §6.2 does give are verbatim; the other three are ours,
and are the string the slider announces. Changing one is a UI copy change, not a spec
deviation.

## ADR-029 — §6.4 is written once, in the domain, and the repository wraps it

**Decision.** `cardRepo.recordAttempt` computes the new statistics by calling
`recordAnswer` from `src/domain/quiz.ts` rather than re-deriving them; its own job is
the transaction, the history cap and leaving `updatedAt` alone.

**Why.** The repository landed in item 01, before the domain had a §6.4 function, so it
carried its own copy of the counter-and-history rule. Item 06 then delivered
`recordAnswer` as the canonical one. Two implementations of the same paragraph is one
too many: the next change to the rule — a different cap, a third outcome — would have
had to find both.

**Consequence.** `src/db/` imports from `src/domain/`, which is the direction the
architecture already allows (it does so for `models` and `validation`). The store writes
answers through `recordAttempt`, so the read-modify-write stays inside one Dexie
transaction and no in-memory copy can clobber a counter.

## ADR-030 — The quiz card is a tappable container, not a button

**Decision.** `QuizCard`'s flip surface is a plain element with a click handler and
`cursor: pointer`. `Space` and `Enter` reach it through a document-level `keydown`
listener, which also carries the `1` / `←` / `2` / `→` grading shortcuts of §7.6.

**Why.** §7.6 asks that tap, click, `Space` and `Enter` all flip the card. The obvious
way — make the card a `<button>` — nests whatever the face's markdown rendered (links,
lists) inside a button, which is the same problem ADR-027 settled for the card row, only
worse here because the face is the whole screen. A document listener gives the keyboard
the same four inputs without lying about the element's contents, and it is what makes
grading reachable from the keyboard at all, since §7.6 wants no reveal button to focus.

**Consequence.** The listener is global while a card is mounted, so anything drawn on
top of the quiz has to say so: `keyboardActive` is false while the leave confirmation is
open, and `QuizRunView` is the one place that sets it. A future overlay over the running
quiz must do the same.

It also has to stand aside for whatever the user has tabbed to. Exit and Undo sit beside
the card the whole time, and the nav bar is above it; cancelling their `Space` or `Enter`
would flip the card instead of pressing them, which strands a keyboard-only user in the
quiz. `QuizCard` therefore ignores `Space` and `Enter` that arrive from anything
activatable, and ignores the grading keys only inside a field the user can type in — a
button has no use for `1` or `←`, so grading still works with the focus on **Got it**.

## ADR-031 — A gated action says `aria-disabled`, not `disabled`

**Decision.** The quickstart buttons on a deck row, a folder row and the deck screen, and
**Start quiz** on the configure screen, carry `aria-disabled="true"` and Bulma's
`is-static` when they cannot run. They keep the `disabled` attribute off, stay in the tab
order, and each points at a visually hidden sentence with `aria-describedby` saying why.
Their handlers return early, so a click does nothing.

**Why.** §7.2 asks that quickstart be "disabled with a tooltip when the deck has no
cards", and item 08 asks that the reason reach a screen reader. A truly `disabled`
button satisfies neither half: it cannot be focused, so its `title` never appears and its
description is never announced — the control simply goes quiet, and the user is left to
guess what is wrong with the deck.

**Consequence.** Every gated action needs its own guard in the handler, because the
browser no longer enforces one for us. The `is-sr-only` sentence carries the reason in
both states, so the description is useful once the deck has cards too.

## ADR-032 — Mastery summaries live in their own store, invalidated by the writer

**Decision.** `src/stores/mastery.ts` holds one `MasterySummary` per deck id, reads a deck
once, and keeps that summary until someone calls `invalidate(deckId)`. The store that
performs a write makes that call: `src/stores/cards.ts` after every card write, and
`src/stores/quiz.ts` after each answer it records and each one an undo takes back. Folder
roll-ups are a computed over the library store's decks, so `mastery` imports `library`.

**Why.** Banding a deck means reading all of its cards, which is far too much to do while
a row renders (§13), so §5.5 asks for a memo per deck. A memo that outlives a mount cannot
be kept honest by the "every screen calls `load()` on mount" rule that ADR-024 relies on:
navigate to a deck, add a card, come back, and the bar would still show the old numbers.
Something has to say when a summary died, and only the writer knows.

This is not the sideways write ADR-024 rules out. That one had the cards store _author_ a
number the library store also authors, giving one figure two sources that could drift.
`invalidate` authors nothing: it drops a cache entry, and the next read recomputes from
the database, which stays the single source. The `now` the store stamps at each read is
the same clock the badges are scored against, so a screenful of mastery is one instant.

**Consequence.** A deck whose summary is not read yet has no bar rather than a wrong one,
and a folder waits for all of its decks before it shows anything — late beats wrong. Any
future writer of `CardStats` has one obligation: invalidate the deck it wrote to. The
cache is keyed by deck id and never pruned; ids are UUIDs, decks are few, and only decks
the library still lists are ever looked up.

## ADR-033 — The bar's segments are whole percentages, by largest remainder

**Decision.** `segmentWidths()` in `src/domain/aggregates.ts` returns three integer
percentages that add up to exactly 100: floor each share, then give the leftover percent
to the bands that lost the most to the flooring, ties going to the band nearer the left.

**Why.** Rounding three shares independently produces 99 or 101 — a bar visibly short of
its track, or one segment clipped off the end. Letting the last segment absorb the
remainder with `flex-grow` would hide the arithmetic but make the widths untestable, and
the bar is small enough that a fractional percent buys nothing. Whole numbers keep the
rendered `style` assertable against the spec's own example (5 / 3 / 2 → 50 / 30 / 20).

**Consequence.** The arithmetic sits in the domain with a test, not in the SFC. The
component maps the three numbers onto Bulma's `has-background-success`,
`has-background-warning`, and plain `has-background` — the theme's neutral, which is also
the empty track, so the untried share reads as bar that has not been filled in yet.
