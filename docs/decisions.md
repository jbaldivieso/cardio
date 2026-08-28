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

**Consequence.** URLs look like `#/decks/abc` under the site root. Acceptable for a
personal PWA launched from the home screen. The base moved from `/cardio/` to `/` with
the custom domain (ADR-046); the hash part is unaffected.

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

**Narrowed by ADR-054** to one control. The quickstart buttons and both custom quizzes
are no longer rendered at all when they cannot run, leaving **Start quiz** on the
configure screen (§7.5) as the only action this ADR still governs: `aria-disabled="true"`
and `is-static` until a checked deck has a card, the `disabled` attribute off so it keeps
its place in the tab order, and a guard in its own handler. Its reason is the one that
was never hidden — `#quiz-start-reason` is an ordinary paragraph above the button, read
by everyone rather than by a screen reader alone — which is part of why this is the gate
worth keeping. Why it stays disabled rather than going away is ADR-054's argument, not
this one's.

**Correction: the tooltip half never worked.** The Why below says a `disabled` button's
`title` "never appears" because it cannot be focused. That is the wrong mechanism — a
`title` is drawn on hover, which focus has no bearing on — and the conclusion drawn from
it does not survive either: Bulma's `.button.is-static` is `pointer-events: none`, so the
element this ADR reached for instead sees no hover and draws no tooltip of its own. Every
gated action here offered the pointer nothing; only the `aria-describedby` sentence ever
carried the reason, and Start quiz never carried a `title` in the first place. §7.2's "disabled with
a tooltip" is the requirement that went unmet for as long as this ADR stood, and ADR-054
rewrote it rather than repairing it.

The rest of this ADR is the decision as it was taken, when it covered four actions
rather than one. Read its "each points at a visually hidden sentence" with the same
care: Start quiz's has always been on screen.

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

## ADR-034 — A backup's orphans are repaired, not refused

**Decision.** `validateBackup` rejects a file for its envelope (`app`, `schemaVersion`), a
missing table, or any row that breaks §4.2 — and writes nothing when it does. Broken
_references_ are different: a deck whose folder is not in the file is re-homed to
Unsorted, a card whose deck is not in the file is dropped, and both are counted and shown
before the import runs.

**Why.** §10 asks for exactly this ("orphans are re-homed: decks to Unsorted, cards are
rejected with a count"), while the plan file's "Rejects:" list also names those two cases
as rejections. Its next bullet then asks for the re-homing, so the two readings cannot
both hold. The spec is canonical, and it is also the better behaviour: a backup is the
user's only copy, and refusing all 4,000 cards over one dangling deck id is the one
outcome nobody wants.

**Consequence.** A partially hand-edited file will quietly flatten decks into Unsorted, so
the settings screen names every repair before the user chooses merge or replace, rather
than reporting them afterwards. Validation is file-scoped, as §10 writes it: it does not
consult the live library, so a deck referencing a folder that exists on disk but not in
the file is still re-homed.

## ADR-035 — The reserved Unsorted id belongs to the domain

**Retired by ADR-050**, which removed the reserved folder and the constant with it.

**Decision.** `UNSORTED_FOLDER_ID` moved from `src/db/index.ts` to `src/domain/models.ts`.
`src/db` re-exports it, so every existing import still reads `from '@/db'`.
`UNSORTED_FOLDER_NAME` stayed in `src/db`.

**Why.** Backup validation runs in the domain and has to name the folder it re-homes
orphaned decks to (ADR-032). The domain imports nothing (CLAUDE.md > Architecture), so
the alternatives were passing the id in as a parameter of `validateBackup` — ceremony for
a constant §4.1 fixes — or duplicating the string. The id is a data-model fact; the name
is a seeding detail, and only `seedDefaults` needs it.

**Consequence.** One more constant lives in `models.ts` alongside `MASTERY_HISTORY_LIMIT`.
Nothing else changed: `@/db` is still where the rest of the app reads it from.

## ADR-036 — Importing is two steps, and the pending file is a shallow ref

**Decision.** `useBackupStore` validates a chosen file into `pending` and writes nothing
until the user picks merge or replace. `pending` is a `shallowRef`.

**Why.** §10 requires validation before any write and asks the counts to be reported;
holding the validated library between the two makes "no write on a bad file" the shape of
the store rather than a rule to remember, and lets the screen say what the file holds — and
what had to be repaired — while the user still has the choice. The ref is shallow for the
reason ADR-015's neighbours already found in the quiz store: these rows go to IndexedDB
verbatim, and a deep ref hands Dexie reactive proxies, which are not structured-cloneable.
That failure is a `DataCloneError` at write time, not a type error, so the spec that
caught it (`merge` returning nothing) is worth keeping.

**Consequence.** The screen has three states to draw — refused, pending, imported — and
`discard()` is what clears them. Anything else that later writes rows straight from a
`ref` needs the same care.

## ADR-037 — The version on the settings screen comes from the build

**Decision.** `vite.config.ts` defines `__APP_VERSION__` from `package.json`, declared in
`src/env.d.ts`; `vitest.config.ts` mirrors the define so a spec renders the real value.

**Why.** §7.8 asks the settings screen to show the app version, and `package.json` is the
one place it is written down. Importing `../../package.json` from a component would work,
but it reaches outside `src/` and outside the `@/` alias, and it puts a build manifest in
the module graph of a screen. A build-time constant keeps the value in one place and
leaves nothing to drift.

**Consequence.** The two Vite configs have to keep the same define. `vitest.config.ts` is
already deliberately separate from `vite.config.ts` (no PWA plugin in unit tests), so this
is the second thing they share knowingly rather than by import.

## ADR-038 — One rule for the theme, enforced against `index.html` itself

**Decision.** The pre-paint script in `index.html` reads an unrecognised value in
`cardio.theme` as `system`, exactly as `readPreference()` does. `theme.spec.ts` extracts
that script from the file and runs it, asserting it lands on the same theme as the store.

**Why.** §11 asks the two to agree and the plan's acceptance box asks for no flash of the
wrong palette, but "keep in sync" was only a comment. They had already drifted: the script
read anything other than `light|dark|system` as `light`, the store read it as `system`, so
a device set to dark with a stale or half-written key painted light before first paint and
flipped to dark on mount — a flash on every reload, indefinitely, since nothing rewrites
the key. A comment cannot fail; a spec can.

**Consequence.** The script is now covered by a unit test that reads the repository's own
`index.html` from disk, which is the only file outside `src/` any spec touches. Changing
either half without the other turns that spec red.

## ADR-039 — A summary dropped mid-read re-reads itself (amends ADR-032)

**Decision.** When `ensure` finishes a read that `invalidate` or `invalidateAll` marked as
dropped, it reads those decks again itself rather than waiting to be asked.

**Why.** ADR-032 has the in-flight read throw its stale result away, which was right, and
left the re-read to "the next `ensure`". There is no next one: `ensure` refuses to issue a
read for a deck already in `reading`, and the screens call it from a watcher over the deck
ids they are showing — a list a quiz answer or an import does not change. So the watcher
never re-fires, the summary stays unknown, and the bar sits blank until the user navigates
away and back. `invalidateAll` widened that from one deck to every deck being read, which
is every deck on screen during an import.

**Consequence.** `ensure` can now recurse once per invalidation that lands mid-read. It
terminates because only a further write can refill `dropped`. The three specs that used to
assert the summary was _absent_ after a mid-read write now assert it is _fresh_, which is
the outcome those tests were really about.

## ADR-040 — The chosen file belongs to the store, and the screen discards on entry

**Decision.** `useBackupStore` holds the chosen file's name alongside `pending`, clears
both when the file is loaded or discarded, and reads the `File` itself (`read(file)`) so a
browser that cannot hand it over is refused with a reason. `SettingsView` calls
`backup.discard()` in `onMounted`.

**Why.** The store is app-scoped and the screen is not. A file validated on one visit
survived navigating away: coming back re-created the view with no filename but left
`pending` armed, so the screen offered Merge and Replace for a file it could not name and
the user had not chosen this time. Splitting the file across the two — name on the screen,
contents in the store — also meant a completed import cleared one and not the other. One
owner fixes both, and moving `file.text()` inside the store puts a `NotReadableError` on
the same error surface as a malformed file instead of rejecting into a `@change` handler.

**Consequence.** `inspect(text)` stays for callers that already have the text; `read(file)`
is what the screen uses. Any future screen that touches the backup store must assume it
may arrive holding the last screen's state.

## ADR-041 — The three modals share one shell

**Decision.** `ModalShell.vue` owns the Bulma modal card, its title and close button, the
backdrop click and the document-level Escape handler. `ConfirmDialog`, `TypedConfirmDialog`
and `NameDialog` supply a body, a footer and whether the card is a `form`.

**Why.** `TypedConfirmDialog` arrived as `ConfirmDialog`'s chrome with `NameDialog`'s input
plumbing pasted into it — around 90 of its 104 lines already existed. Three copies of a
focus-and-Escape contract is three places for it to drift, and the accessibility details
are exactly the ones that are easy to get subtly different.

**Consequence.** One more component in the tree, and the dialogs pass their `data-testid`
down as a prop so every existing test and e2e selector still reaches them unchanged.

## ADR-042 — A confirmation quotes no counts it could not read

**Decision.** `SettingsView` treats the library's size as `LibraryCounts | null`, `null`
until the first read succeeds and whenever `library.error` is set, and the §7.8 wording in
`src/domain/prompts.ts` takes that `null` and drops the figures rather than printing zeros.
The screen also renders `library.error`, which it previously ignored.

**Why.** A failed read leaves the folder and deck lists empty, which is indistinguishable
from an empty library. The danger zone then read "0 folders, 0 decks and 0 cards stored in
this browser" and its confirmation promised the user there was nothing to lose immediately
before `replaceAll` wiped a library that was in fact full. A count nobody has is not zero.

**Consequence.** Two wordings for each destructive prompt, both covered by `prompts.spec.ts`.
The action stays available when the read fails — the user may well be deleting _because_
something is broken — it simply stops claiming to know what it is about to destroy.

## ADR-043 — The mastered segment is the headline number, not its own rounding

**Supersedes the arithmetic in ADR-033.** `segmentWidths()` sets the mastered segment to
`summary.masteredPct` exactly, and shares the remaining width between `learning` and
`new` by largest remainder. The three still add up to 100.

**Why.** ADR-033 rounded all three shares by largest remainder, independently of
`masteredPct`, which spec §5.5 pins to `round(100 × mastered / total)`. The two rules
disagree by a point on about one mix in twelve: a deck of one card per band draws the
mastered segment at 34% beside a headline and an `aria-label` that both say 33%. The
segment and the sentence next to it are the same claim, so they cannot be computed two
different ways — and §5.5 owns `masteredPct`, so the bar is what yields.

**Consequence.** The two remaining segments absorb the difference, so `learning` and
`new` may each sit a point off their exact share — invisible on a bar this size, and
neither is quoted in words anywhere. A deck rounding to `100%` mastered while a few cards
are still unmastered draws a full bar; that already followed from §5.5 owning the
headline. The leftover pass now shares one point between two bands rather than two
points among three, and no longer mutates its accumulator from inside a `map` callback.

## ADR-044 — The mastery track is painted with Bulma's border token, not a class

**Supersedes the colour choice in ADR-033.** The empty track and the `new` segment take
a one-declaration scoped class, `background-color: var(--bulma-border)`, instead of
Bulma's `has-background` helper.

**Why.** `has-background` resolves to `--bulma-background`, which Bulma sets to 96%
lightness in light mode and 14% in dark. A mastery bar sits on a `.box`, which is
`--bulma-scheme-main`: 100% and 9%. So the track ADR-033 called "the theme's neutral" was
drawing at roughly 1.05:1 against the card behind it — invisible. Spec §7.9 asks for "an
empty grey track" for a zero-card deck and a visible neutral for the untried share, and a
deck of nothing but new cards rendered as no bar at all. Bulma generates no
`has-background-border` helper, so there is no class that reaches the right token.

**Alternatives.** A fixed grey such as `has-background-grey-lighter` — rejected: it does
not move when the theme does, which is the whole reason ADR-011 colours by token.
Bordering the track instead of filling it — rejected: a 0.5rem bar with a 1px border
leaves almost no fill, and the border would read as part of the mastered segment.

**Consequence.** One more custom declaration than the "Bulma classes first" rule prefers,
in the SFC that already owns the bar's geometry. It stays a Bulma custom property, so
`data-theme` still swaps it: 86% on 100% in light, 24% on 9% in dark.

Measured, that moves the track from 1.10:1 to 1.41:1 in light and 1.14:1 to 1.59:1 in
dark. Both are short of WCAG 1.4.11's 3:1, and deliberately so: reaching 3:1 against a
white `.box` needs lightness at or below 60%, which is `--bulma-text-weak` — a mid-grey
that reads as a _filled_ segment and would make an empty deck look part-mastered. The bar
carries nothing that the headline beside it and its own `aria-label` do not already say
in words, so it is a redundant visual aid rather than a graphic required to understand
the content. Rendered against the real built stylesheet, the empty track now reads as a
groove in both themes where before it was invisible in light.

The component test asserts the class, which pins the token but not the contrast. Anything
that changes this colour has to be looked at, in both themes, with an empty deck on
screen.

## ADR-045 — The install hint appears only where the browser can act on it

**Decision.** Spec §7.8 asks for "install instructions when not installed". They are
shown where the browser has actually offered to install the app — Chrome and its kin,
once `beforeinstallprompt` has fired — or in the two places installing works with no such
event: a full browser on iOS, which installs from the Share sheet, and Safari 17 or later
on macOS, which installs from File > Add to Dock. Everywhere else the section is absent,
not empty.

**Why.** Instructions no menu can carry out read as a bug in the browser or in the user.
A desktop Firefox has no install command at all, and Chrome fires no event when the
criteria are unmet or the app is already installed, so a browser that cannot install the
app is better off saying nothing about it. The event is the only reliable signal that
this build is installable here, since a user agent string does not say so.

The same principle governs the wording, which is why the `browser` branch names no menu
item: it is "Install app" on Android Chrome, "Install <name>…" under Cast/save/share on
desktop Chrome, "Apps > Install this site as an app" on Edge and "Add page to > Home
screen" on Samsung Internet, and all four fire the event. The text points at the menu and
the address bar without claiming what either is labelled.

**Consequence.** The signal arrives once, moments after load, long before anyone opens
Settings, so `useInstallStore` is created at boot in `main.ts` rather than by the screen
that reads it. That one call is load-bearing and nothing tests it — `src/main.ts` is
excluded from coverage, and both specs build the store by hand — so removing it would
break the hint silently. The event is listened for and never deferred: calling
`preventDefault()` on it suppresses the browser's own install affordance, which is the
very thing the hint points at. `appinstalled` clears the hint, so a tab that installs the
app while it is open stops advertising it.

The two event-less branches are user-agent sniffed, in `isIosBrowser` and
`isMacSafariWithDock`, because neither platform offers an alternative. The costs, all of
them:

- iPadOS 13 and later report the desktop Mac string, so the touch-point count is what
  separates an iPad from a Mac. A Mac that grows a touch screen would see the iOS hint.
- A web view embedded in another app reports iOS but has no Share sheet. It is excluded
  by the host app's token (`FBAN`, `Instagram`, `GSA/` and the rest) or by the absence of
  `Safari/`, which a bare `WKWebView` omits. That list is a moving target; an app not on
  it shows a hint its user cannot act on.
- Add to Dock arrived in Safari 17 but only on macOS Sonoma, and the platform part of the
  user agent has been frozen at `10_15_7` for years. A Safari 17 on Ventura is therefore
  told about a menu item it does not have. Sonoma is three years old, so this is the
  narrow end of a narrow branch, but it is not nothing.

## ADR-046 — The site lives at `cardio.baldivieso.com`, so the base is `/`

**Decision.** Serve the app from the custom domain `cardio.baldivieso.com` rather than
`jbaldivieso.github.io/cardio/`. `public/CNAME` carries the domain into every build's
artifact; Vite's `base`, and with it the manifest `id`, `scope` and `start_url`, become
`/`.

**Why.** A custom domain is served from its own root — GitHub Pages does not keep the
project name in the path — so a `base` of `/cardio/` would ask for `/cardio/assets/…`
on a host that has no such directory and the app shell would not load at all. Keeping
the CNAME in `public/` rather than only in the repository's Pages settings means the
domain is version-controlled and survives a re-deploy from a clean checkout.

**Consequence.** The origin changed, and IndexedDB, `localStorage` and the service worker
are all per-origin. An install or a database on `jbaldivieso.github.io` does not carry
over: that data is reachable only through settings' export, and only from a browser that
still has the old origin cached, since GitHub redirects the `github.io` URL to the custom
domain. For a single-user app with a backup format this is a one-time export/import, not
a migration.

DNS is the part this repository cannot assert: a `CNAME` record for `cardio` pointing at
`jbaldivieso.github.io`, and **Settings → Pages → Custom domain** set to match, with
_Enforce HTTPS_ on once the certificate is issued. Until both exist the deploy succeeds
and the domain does not resolve.

## ADR-047 — A first visit gets a splash, not an empty list

**Decision.** The home screen shows a centred greeting — **Cardio**, _Flashcards for
faster learning_, and a **Create a folder** button — instead of the folder list whenever
the library holds no decks and no folder beyond the seeded Unsorted. The splash replaces
the header too, so the greeting has the screen to itself. `library.isEmpty` is the
predicate; the `folders-empty` notification it supersedes is gone.

**Why.** Spec §7.1 asks for an empty state, but the one that existed keyed off
`folders.length === 0`, and `seedDefaults()` puts Unsorted in the database before the
first paint (§4.2). The condition was therefore unreachable outside a failed read: what a
genuine first visit actually saw was a table of one row named Unsorted holding nothing,
which explains neither what the app is nor what to do next.

**Why that predicate.** "No decks" alone would take the splash down only once a deck
existed, so the folder the splash just asked for would appear to do nothing. Excluding
any folder but Unsorted keeps the button's effect immediate: create a folder, the splash
gives way to the list holding it. Cards live in decks, so no decks means no cards without
counting them.

**Consequence.** Unsorted is unreachable while the splash is up, so the first deck of a
brand-new library goes into a folder its owner named rather than into Unsorted. That is
the flow §7.1's copy already described — decks live inside folders — and Unsorted returns
to the list the moment anything else does. A read that fails leaves the library looking
empty, so the splash appears under the error banner; the banner is what explains it, and
inviting a folder is still the right offer.

## ADR-048 — Chartreuse marks what is in motion, not what is done

**Decision.** `--cardio-accent`, the Grove palette's chartreuse (`#8cb43a` light,
`#a9d14f` dark), is spent in exactly two places: the `learning` segment of
`MasteryBar.vue`, via the shared `.cardio-mastery-accent` class in `main.scss`, and the
tier in force on `TierSlider.vue`, via `accent-color` on the native range. `MasteryBadge`
keeps `is-success` and `is-warning` and takes the new palette from Bulma's tokens
untouched.

**Why those two.** The accent is the only high-energy colour in a palette that is
otherwise olive, green and teal, so a third use would make it the theme rather than the
spark. Both places it does land are the same idea: the part of the screen that is
currently moving. On the bar, mastered green fills in from the left and chartreuse is the
live edge in front of it; on the slider, it is the one tier out of seven that the next
quiz will actually use. What is finished is green, what is untried is grey, and the
bright colour is reserved for the boundary between them.

**Why `accent-color` on the slider.** It is the one property a native range answers to
without being rebuilt, so the browser keeps its own thumb geometry, its focus ring and
its platform hit area — the 44px target of spec §7 stays the browser's business.
Hand-drawing `::-webkit-slider-thumb` and `::-moz-range-thumb` would have bought a
matching filled track on the left of the thumb at the cost of owning focus styling in two
vendor dialects, which is not a trade this slider needs.

**Alternatives.** Leaving `learning` on `has-background-warning` — rejected, but not on
contrast grounds: measured, the boundary between the learning and mastered segments is
2.07:1 in light and 1.42:1 in dark for _both_ colours, identically. The palette's amber
and its chartreuse happen to sit at the same distance from the green. The reason is
meaning: warning is the colour Bulma gives a caution, and a card halfway to mastered is
not a fault. Using the accent on the mastered segment instead — rejected: mastery is the
resting state, and the eye should land on it last.

**Consequence.** The dark theme's 1.42:1 across the mastered/learning boundary means
those two segments are separated by hue and saturation, not lightness, and a viewer who
cannot tell chartreuse from green sees one bar of one colour. That is the condition
ADR-044 already accepted for this bar: the headline beside it and the track's own
`aria-label` state every number in words, so the bar is a redundant aid. Against the page
itself the accent is legible in both themes — 2.41:1 on the light `.box`, 9.56:1 on the
dark one.

Warning now has exactly one consumer left, the `learning` badge in `MasteryBadge.vue`.
Anything that changes `--cardio-accent` has to be looked at in both themes with a
part-way deck on screen, and the slider checked in a browser that draws its own thumb.

---

## ADR-049 — Nebula Sans, four faces, self-hosted

**Decision.** The app sets `$family-primary` to `'Nebula Sans', system-ui, sans-serif`
and ships the typeface itself: four `@font-face` rules in `src/styles/main.scss` pointing
at woff2 files from `@fontsource/nebula-sans`, a new runtime dependency. The faces are
400 normal, 400 italic, 600 normal and 700 normal. Bulma's two remaining weight tokens
are pinned onto them — `--bulma-weight-medium: 600` (buttons) and
`--bulma-weight-extrabold: 700` (titles) — because Nebula Sans has no 500 or 800.

**Why self-hosted.** Spec §13 allows no fetch to any origin at runtime, which rules out
Google Fonts and every other CDN. Fontsource is a build-time package: Vite hashes the
woff2 files into `dist/assets/`, the existing `globPatterns` sweep already matches
`woff2`, and the service worker precaches all four. After the first load the typeface is
as offline as the rest of the app. Nebula Sans is SIL OFL 1.1, so redistributing it
inside our own bundle is exactly what the licence is for; the licence text travels with
the package.

**Why hand-written `@font-face` rather than Fontsource's stylesheets.** Importing
`@fontsource/nebula-sans/400.css` and friends would have been one line each, but every
one of those stylesheets lists a `.woff` beside its `.woff2`, and Vite emits both. That
is a second copy of all four faces — 388 KB — sitting in `dist/` that nothing which can
run a service worker is old enough to ask for, and that `globPatterns` would not
precache anyway. Four hand-written rules cost eight lines and ship only what is used.

**Why four faces.** Each is about 70 KB and every one is precached, so the count is a
real cost, not a stylesheet detail; the four are the ones the app actually renders.
Bulma's scale asked for six. 500 (buttons) and 800 (titles) have no face in this family
at all, and left alone the browser's font-matching would have resolved them one way in
Nebula Sans and another way in the `system-ui` fallback, so a button would change weight
the moment the font finished loading. Pinning both to shipped faces makes the fallback
render at the same weights as the real thing. 300 and 900 are not referenced anywhere in
the app.

**Alternatives.** The full Fontsource family, six weights and their italics — rejected:
1.7 MB of precache for twelve faces to render four. A variable font would have collapsed
the whole range into one file, but Nebula Sans does not publish one. Subsetting the woff2
down from its ~70 KB latin coverage — rejected for now: it needs a build-time subsetter
and a rule about which glyphs a flash card may contain, and card text is user-authored.

**Consequence.** The precache grew from about 1.1 MB to 1.39 MB, a one-time cost on
install. Bold-italic together — `***like this***` in a card — has no face of its own and
gets the 400 italic thickened by the browser. `--bulma-weight-extrabold` no longer means
800; anything that later wants a heavier title has to add the 900 face rather than change
that number. Code blocks keep Bulma's monospace stack, which is system fonts and reaches
no network; Nebula Sans has no mono companion.

---

## ADR-050 — Every folder is one the user made

**Supersedes the reserved folder of §4.1 and §4.2.** The `unsorted` folder is gone:
`seedDefaults()`, `UNSORTED_FOLDER_ID` and `UNSORTED_FOLDER_NAME` are deleted, `main.ts`
writes nothing before the first paint, and no repository refuses a delete. `isEmpty` is
now `folders.length === 0`, and `canDeleteFolder()` is gone with the last folder the UI
had to treat differently.

**Why.** A folder nobody made is a row nobody wants. It was seeded before the first
paint to guarantee that a deck always had somewhere to live, and the guarantee was never
worth its cost: on a first visit it was the only row on the screen, holding nothing, and
ADR-047 already had to hide it behind a splash to keep that screen legible. Every layer
then carried the exception — a delete the repository refused, a `deletable` prop, an id
the domain had to know about. Removing the folder removes all of it, and the splash the
first visit already gets is where the app asks for the first real folder.

**What the splash says now.** The greeting gained one line — "Start with a folder.
Folders hold decks, and decks hold your cards." — which is §7.1's "explains that decks
live inside folders", finally said on the screen that needs it rather than in an empty
list's notification.

**An orphaned deck in a backup is dropped, not re-homed** (amends ADR-034). With no
reserved folder to re-home it to, a deck whose folder the file does not carry has
nowhere to go, so it is left out and counted, and its cards go with it — the treatment
§10 already gave a card whose deck was missing. `BackupRepairs.rehomedDecks` became
`rejectedDecks`, and the import preview says "1 deck with no folder will be left out."
Inventing a folder to hold the orphans would have put back exactly the auto-created
folder this ADR removes.

**A partial file loses more than it used to.** `validateBackup` is a pure function over
the file, so "missing folder" means missing _from the file_, not from the library the
rows are about to land in. A merge whose file carries a deck but not its folder therefore
drops that deck even when the live library has a folder of that id; before this change
the deck survived, in the wrong folder. An export always carries every folder, so only a
hand-edited or truncated file can reach this, and the import preview names the count
before anything is written — but it is a loss where there used to be a repair, and the
alternative (validating against the library) would put a database read inside a domain
function.

**Consequence.** A library made before this change still has its seeded folder, named
Unsorted or whatever it was renamed to. It is an ordinary folder now: it can be deleted,
and while it is there the library is not empty, so the splash stays down. Nothing
migrates it away — deleting a folder someone may have filled is not a decision this
change gets to make for them. Replacing everything from a backup, and the danger zone's
own **Delete all data**, now leave a genuinely empty library, so both land back on the
splash; `deleteEverythingPrompt` no longer promises that Unsorted comes back.

---

## ADR-051 — A gated navigation is a disabled button, not a dead link

**Superseded by ADR-054.** A **Custom quiz** with nothing to configure is no longer
rendered at all, so there is no gated state left for the element swap below to serve.

**Extends ADR-031.** The **Custom quiz** actions on the folder and deck screens are
`RouterLink`s while they lead somewhere and a `<button class="is-static"
aria-disabled="true">` carrying the same label and `data-testid` when they do not. Both
are gated on the cards below them: a folder with no cards anywhere in it, a deck with
none of its own, has nothing for `quiz-configure` to configure. The deck row's **Move**
is gated the same way when the library holds one folder, since a move needs somewhere to
go; it stays a `<button>` in both states and only takes `is-static` and `aria-disabled`.

**Why not keep the link and swallow the click.** A `RouterLink` renders its own `onClick`
before any listener the caller adds, so a `@click.prevent` on it navigates first and
prevents afterwards. `custom` with a slot would work, at the cost of hand-writing the
anchor, its `href` and its focus behaviour. Swapping the element is one `v-if` and leaves
the enabled path exactly as it was.

**Why a button and not a link with no `href`.** An `<a>` without `href` is not focusable,
which loses the ADR-031 property this is built on: a gated action keeps its place in the
tab order so its `aria-describedby` reason can be heard. A `<button>` with `aria-disabled`
and no handler keeps focus, and reads as a disabled control rather than as a link that
goes nowhere.

**Consequence.** The action changes role between its two states — link when live, button
when not. Anything asserting on `RouterLink` for these actions has to seed a card first.
Each gated action needs a reason element that exists whenever the gate is closed: the
deck screen reuses `#deck-quiz-reason`, which already says the one thing there is to say,
and the folder screen and deck row carry their own.

---

## ADR-052 — A row's overflow actions live behind a disclosure, not an ARIA menu

**Decision.** `ActionMenu.vue` holds the actions §7.1 and §7.2 always called an overflow
menu: a trigger carrying Feather's "more-horizontal", inlined like the app's other two
icons, sitting immediately after the row's name, and a Bulma `dropdown-menu` holding
whatever buttons the row passes in the slot. Folder rows put rename and delete there;
deck rows put rename, move and delete. Quiz stays out on the row in both.

**Why a disclosure.** `role="menu"` is a promise of menu keyboard behaviour — arrow keys
between items, Home and End, typeahead — and a slot full of ordinary buttons delivers
none of it. The trigger is a plain button with `aria-expanded` and `aria-controls`; the
panel is a group of buttons Tab walks in order, which is the disclosure pattern and is
what the markup actually does. Escape closes the panel and puts the focus back on the
trigger, and a press anywhere outside closes it.

**Why the panel is `v-if` and not `v-show`.** Bulma hides an inactive `dropdown-menu`
with `display: none`, so both look the same in a browser; only `v-if` keeps a closed
menu's buttons out of the DOM, where nothing — a test, a `find`, an accessibility tree —
can reach an action that is not on screen. `aria-controls` is bound only while the panel
exists, since it would otherwise name an id that is not there.

**Consequence.** Rename, move and delete cost two presses instead of one, which is the
trade §7.1 asked for: the row now reads as a name, its size and the one action it is
for. The 44 px target of §7 is applied once, on `.dropdown-item` inside the panel via
`:deep`, rather than by every row that fills the slot. Anything reaching for
`folder-rename`, `deck-rename`, `deck-move` or `deck-delete` — a test, or a future
keyboard shortcut — has to open the menu first. The panel closes on any press that
reaches it, with no exceptions: ADR-054 leaves no gated item in the slot to make one for.

---

## ADR-053 — A row menu's panel is measured against the row, not its trigger

**Decision.** `ActionMenu`'s `.dropdown` is `position: static` and its `.dropdown-menu`
is `left: auto; right: 0`, which pins an open panel to the right edge of
`.cardio-row-main` — the row's name column, made `position: relative` for this. The panel
opens below that column rather than directly below the trigger.

**Why.** ADR-052 puts the trigger immediately after the row's name, so its left edge
moves with the name's length, and Bulma anchors an open panel to that left edge with a
`min-width` of 12 rem. On a 393 px viewport a name of a dozen or so characters put the
panel's right edge past the screen: measured at 430 px for a folder called "Kitchen
Vocabulary" and 490 px for a name half again as long, taking `document.scrollWidth` with
it. Part of the menu was unreachable and the page scrolled sideways.

**Why not `is-right`.** Bulma's own right-alignment pins the panel to the _trigger's_
right edge, which fails at the other end of the same range: a short name leaves the
trigger near the left margin and a 12 rem panel hanging off that side instead. The row's
name column is the one anchor that is on screen at every name length and every width.

**Consequence.** The panel drops below the name and its count rather than from the
trigger itself, which reads as attached to the row and has the incidental benefit of not
covering the count. `ActionMenu` now depends on its host being a positioned box:
`.cardio-row-main` carries a comment saying so, and a row that uses the menu without it
would see the panel escape to the next positioned ancestor. `e2e/row-menu.spec.ts` holds
the regression at both viewports, with the short and the long name as the two ends of
the range; it is an e2e test because the panel's position comes from Bulma's stylesheet
and the width of a name in the app's own font, which jsdom has neither of.

---

## ADR-054 — An action with nothing to act on is not rendered

**Narrows ADR-031, supersedes ADR-051, amends ADR-052.** The quickstart **Quiz** on a
deck row, a folder row and the deck screen, the **Custom quiz** on the folder and deck
screens, and **Move** in a deck row's menu are absent from the DOM whenever they cannot
run. No `aria-disabled`, no `is-static`, no `title`, and none of the `is-sr-only`
sentences that used to carry the reason: the control is simply not there until it works.

**Why.** ADR-031 kept a gated action on screen so its reason could be heard, and on the
rows and the two headers it offered that reason two ways — a `title` for the pointer, an
`aria-describedby` sentence for a screen reader. Only the second ever worked. Bulma's `.button.is-static` is
`pointer-events: none`, so the element never sees a hover and the browser never draws the
tooltip; the sighted user got a grey button that stayed silent when pressed and explained
itself only to a screen reader. §7.2 had asked for "disabled with a tooltip", and the
implementation had been quietly delivering half of it since ADR-031 was written.

Restoring the tooltip was the smaller change, and it would still have left a control
whose whole purpose is to be pressed and refuse. The empty states already say what is
missing — an empty deck's screen says "No cards in this deck yet", an empty folder's says
to create a deck — so the reason was never only on the disabled button, and the button
was the least useful place it appeared.

**The one exception is `quiz-configure`'s Start quiz** (§7.5), which keeps ADR-031's
treatment. It is the screen's only submit, and its gate opens and closes while the user
works — untick the last deck and a hidden button would vanish from under the pointer,
which is worse than a disabled one that says why. A gate the user can open from the same
screen is a different thing from an action that has nowhere to go.

**Consequence.** An empty deck's row is a name, a count and its menu; a library with one
folder has no **Move** anywhere in it. `DeckRow` and `FolderRow` lost their `useId`
reason ids and their guard functions — the handlers no longer need to check what the
render already decided — and `ActionMenu` lost the `aria-disabled` branch that kept the
panel open for a gated item, since no slot passes one any more. The `movable` and
`cardCount` props stay: they now decide whether to render rather than how. A test can no
longer press a gated action to prove it does nothing, so the assertions are that the
`data-testid` is absent, which is the stronger claim anyway.
