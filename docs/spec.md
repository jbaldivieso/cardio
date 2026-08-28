# Cardio — Specification

**Status:** canonical and self-contained. This document is the source of truth; the
brief it was derived from lives outside the repository.
`docs/decisions.md` records _why_ each contested choice was made.
Work is sequenced in `.claude/plans/`.

---

## 1. Product summary

Cardio is an offline-first flash-card PWA. A card has a markdown front and back;
cards live in decks; decks live in folders. Quizzing is the centre of the app: the
user sees one side of a card, taps to flip, and self-grades with **Got it** or
**Missed it**. Those grades accumulate into a per-card **mastery** score that drives
which cards a future quiz selects.

- Single user, no accounts, no server. All data is in IndexedDB on the device.
- No network requests after the app shell loads.
- Deployed as a static SPA to GitHub Pages, on a custom domain:
  `https://cardio.baldivieso.com/`.
- Installable, and fully functional offline.

## 2. Scope

### In scope for v1

1. CRUD for folders, decks, cards.
2. Markdown rendering of card faces.
3. Quizzing: quickstart from a deck, quiz from a folder, and a custom quiz across any
   selection of decks; front-or-back direction; 7-tier mastery weighting.
4. Mastery scoring per card, and mastery summaries per deck and folder.
5. Bulk card entry by pasting delimited lines.
6. JSON export / import of the entire database.
7. Dark mode (system-following by default).
8. Installable PWA with offline app shell.

### Explicitly out of scope for v1

Accounts, sync, sharing, or any server. Images, audio, or attachments on cards.
Anki import. Cloze deletion. Internationalisation. Spaced-repetition scheduling, due
dates, or notifications. Per-direction statistics. Resuming an interrupted quiz.
Search. User-selectable sort orders. Soft delete or undo of deletions. Tags.

Do not build these. If one turns out to be load-bearing for something in scope, stop
and raise it rather than expanding scope silently.

## 3. Glossary

| Term          | Meaning                                                            |
| ------------- | ------------------------------------------------------------------ |
| **Attempt**   | One answer to one card during a quiz: a _get_ or a _miss_.         |
| **Mastery**   | Integer 0–100 per card, derived from its attempt history.          |
| **Band**      | `new` (never attempted), `learning`, or `mastered` (mastery ≥ 80). |
| **Weak**      | Mastery ≤ 40. Includes `new` cards, whose mastery is 0.            |
| **Direction** | Which face a quiz shows first: `front` (default) or `back`.        |
| **Tier**      | The 1–7 position of the mastery slider for a quiz.                 |
| **Pool**      | Every card in the decks selected for a quiz.                       |
| **Session**   | One quiz run: an ordered list of cards plus the answers given.     |

## 4. Data model

### 4.1 Entities

All timestamps are **epoch milliseconds**. All IDs are `crypto.randomUUID()`.

```ts
interface Folder {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

interface Deck {
  id: string
  folderId: string
  name: string
  createdAt: number
  updatedAt: number
}

interface Attempt {
  at: number
  got: boolean
}

interface CardStats {
  gets: number
  misses: number
  history: Attempt[] // chronological, oldest first, capped at 20
  lastSeenAt: number | null
}

interface Card {
  id: string
  deckId: string
  front: string
  back: string
  createdAt: number
  updatedAt: number
  stats: CardStats
}
```

Declared in `src/domain/models.ts` (already scaffolded). The domain layer owns these
types; the db layer imports them, never the reverse.

### 4.2 Invariants and validation

- `Folder.name`, `Deck.name`: trimmed, 1–80 characters, non-empty. Duplicate names are
  allowed (they are labels, not keys).
- `Card.front`, `Card.back`: trimmed, non-empty, at most 4000 characters each.
- Every `Deck.folderId` references an existing folder; every `Card.deckId` an existing deck.
- Every folder is one the user made. The app creates none of its own, and any folder
  can be renamed or deleted (ADR-050). A library with no folders is the first-run state
  §7.1 greets with the splash.
- `updatedAt` tracks _content_ edits only. Recording a quiz answer changes `stats`
  (and `stats.lastSeenAt`) but must **not** bump `Card.updatedAt`, or every quiz would
  reorder every listing.
- `history` holds at most `MASTERY_HISTORY_LIMIT` (20) attempts; the oldest are dropped
  first. `gets` and `misses` are lifetime counters and are never trimmed.

### 4.3 Dexie schema

```ts
this.version(1).stores({
  folders: 'id, name, updatedAt',
  decks: 'id, folderId, name, updatedAt',
  cards: 'id, deckId, updatedAt',
})
```

Indexes exist for the lookups the app performs: decks by folder, cards by deck, and
name/`updatedAt` for sorted listings. `stats` is a nested object on the card row — not
indexed, and never queried by value.

**Migration policy:** never edit `version(1)`. Add `version(2).stores({...}).upgrade()`
and cover the upgrade with a unit test that seeds a v1 database first.

### 4.4 Deletion

Hard delete, cascading, inside one Dexie transaction:

- Deleting a folder deletes its decks and all their cards.
- Deleting a deck deletes its cards.

Every destructive action requires a confirmation dialog naming the counts, e.g.
_"Delete “Spanish”? This removes 4 decks and 212 cards. This cannot be undone."_
There is no undo and no trash.

### 4.5 Storage durability

On first successful write, request `navigator.storage.persist()` (best effort, ignore
rejection). Because a cleared browser profile destroys everything, the settings screen
must present JSON export prominently (§10).

## 5. Mastery

Implemented as pure functions in `src/domain/mastery.ts`. No I/O, no `Date.now()` —
`now` is always a parameter.

### 5.1 Constants

```ts
export const MASTERY_WINDOW = 10 // attempts considered "recent"
export const MASTERY_DECAY = 0.85 // per-attempt weight decay, newest = 1.0
export const MASTERY_EXPOSURE_TARGET = 5 // attempts needed for full confidence
export const MASTERY_HALF_LIFE_DAYS = 60 // staleness half-life
export const MASTERED_MIN = 80 // band boundary, inclusive
export const WEAK_MAX = 40 // "needs work" boundary, inclusive
```

### 5.2 Formula

```
mastery(stats, now) =
  if gets + misses == 0 -> 0

  attempts       = gets + misses
  window         = last MASTERY_WINDOW entries of history (newest last)
  weight(i)      = MASTERY_DECAY ^ i          // i = 0 for the newest attempt
  recentAccuracy = Σ weight(i) * got(i) / Σ weight(i)
  exposure       = min(1, attempts / MASTERY_EXPOSURE_TARGET)
  daysSinceSeen  = (now - lastSeenAt) / 86_400_000
  staleness      = 0.5 + 0.5 * 0.5 ^ (daysSinceSeen / MASTERY_HALF_LIFE_DAYS)

  round(100 * recentAccuracy * exposure * staleness), clamped to 0..100
```

Each factor answers one question: _recentAccuracy_ — how have you done lately;
_exposure_ — have you done it often enough to be sure; _staleness_ — how long ago,
decaying toward half credit, never to zero.

Edge cases, all of which need a test:

- `attempts == 0` → mastery `0`, band `new`. A new card is _weak_, so it is eligible at
  the unmastered end of the slider.
- `history` empty but counters non-zero (possible via import) → fall back to
  `recentAccuracy = gets / attempts`.
- `lastSeenAt == null` but counters non-zero → treat `daysSinceSeen` as 0
  (`staleness = 1`).
- `now` earlier than `lastSeenAt` (clock skew) → clamp `daysSinceSeen` to 0.
- Mastery is clamped to 0–100 and always an integer.

### 5.3 Bands

```
band(stats, now) =
  gets + misses == 0        -> 'new'
  mastery(stats, now) >= 80 -> 'mastered'
  otherwise                 -> 'learning'
```

### 5.4 Test vectors

History patterns are chronological, oldest first: `G` = get, `M` = miss.
These values are exact — write them as the red tests for `mastery()`.

| history           | last seen    | gets | misses | mastery | band     |
| ----------------- | ------------ | ---- | ------ | ------- | -------- |
| (none)            | never        | 0    | 0      | 0       | new      |
| `G`               | today        | 1    | 0      | 20      | learning |
| `GG`              | 1 day ago    | 2    | 0      | 40      | learning |
| `GGG`             | today        | 3    | 0      | 60      | learning |
| `GGGG`            | today        | 4    | 0      | 80      | mastered |
| `GGGGG`           | today        | 5    | 0      | 100     | mastered |
| `GGGGGGGG`        | today        | 8    | 0      | 100     | mastered |
| `GMGGM`           | today        | 3    | 2      | 56      | learning |
| `GMGMG`           | today        | 3    | 2      | 61      | learning |
| `MMM`             | today        | 0    | 3      | 0       | learning |
| `GGGGM`           | today        | 4    | 1      | 73      | learning |
| `MGGGG`           | today        | 4    | 1      | 86      | mastered |
| `GGGGGGGGGM`      | today        | 9    | 1      | 81      | mastered |
| `MMMMMGGGGGGGGGG` | today        | 10   | 5      | 100     | mastered |
| `GGGGG`           | 30 days ago  | 5    | 0      | 85      | mastered |
| `GGGGG`           | 60 days ago  | 5    | 0      | 75      | learning |
| `GGGGG`           | 120 days ago | 5    | 0      | 63      | learning |
| `GGGGG`           | 365 days ago | 5    | 0      | 51      | learning |
| (none)            | 5 days ago   | 4    | 1      | 78      | learning |

Read the interesting rows as behaviour, not arithmetic: four clean gets earns
`mastered`; one fresh miss after four gets (`GGGGM` → 73) loses it; a single slip after
nine gets (81) does not; a perfect card left alone for two months (75) falls back to
`learning` and so becomes eligible for practice again.

### 5.5 Aggregates for decks and folders

In `src/domain/aggregates.ts`:

```ts
interface MasterySummary {
  total: number // cards counted
  new: number
  learning: number
  mastered: number
  masteredPct: number // round(100 * mastered / total), 0 when total == 0
}
```

- `masteredPct` is the headline number shown as "68% mastered". Its denominator is
  **all** cards, `new` included — an untouched deck reads 0%, not 100%.
- The three counts always sum to `total` and drive a 3-segment bar (§7.6).
- A folder summary is the sum of its decks' counts, recomputed the same way.
- Computed on demand in a single pass over the deck's cards, memoised per deck in the
  store and invalidated on any card write.

## 6. Quiz engine

Selection and scoring are pure functions in `src/domain/quiz.ts`; orchestration and
persistence live in `src/stores/quiz.ts`.

### 6.1 Configuration

```ts
interface QuizConfig {
  deckIds: string[] // one or many, must be non-empty
  direction: 'front' | 'back' // default 'front'
  tier: 1 | 2 | 3 | 4 | 5 | 6 | 7 // default 4
  size: 10 | 20 | 50 | 'all' // default 20
}
```

The last-used config is persisted to `localStorage` under `cardio.quizConfig` and
pre-fills the custom-quiz screen. Quickstart always uses the **defaults above**, not
the remembered config, so its behaviour never surprises.

### 6.2 The mastery slider

Seven tiers. Tiers 1 and 7 are hard filters; 2–6 are target mixes of the session.

| Tier  | Label                  | Composition                        |
| ----- | ---------------------- | ---------------------------------- |
| 1     | Only what I don't know | Weak cards only (mastery ≤ 40)     |
| 2     | Mostly unmastered      | 90% unmastered / 10% mastered      |
| 3     |                        | 75 / 25                            |
| **4** | **Default**            | **60 / 40**                        |
| 5     |                        | 45 / 55                            |
| 6     | Mostly mastered        | 25 / 75                            |
| 7     | Only what I know       | Mastered cards only (mastery ≥ 80) |

"Unmastered" here means `mastery < 80`, which includes `new` cards. The brief called for
the middle tier to be an even mix; the default tier is the 4th and it is deliberately
60/40 unmastered-leaning, so an exact 50/50 sits between tiers 4 and 5. See
`docs/decisions.md` ADR-006.

### 6.3 Building a session

`buildSession(cards, config, rng): Card[]`, where `rng: () => number` returns
`[0, 1)` and is injected so tests are deterministic.

```
1. pool = cards from config.deckIds
   pool empty -> return [] (caller shows the empty state, §7.5)
2. size = config.size === 'all' ? pool.length : min(config.size, pool.length)
3. tier 1: bucket = pool where mastery <= WEAK_MAX
   tier 7: bucket = pool where mastery >= MASTERED_MIN
     if bucket is empty, fall back to the whole pool
     take a uniform sample of `size` from bucket, shuffle, done
4. tiers 2..6:
   mastered   = pool where mastery >= MASTERED_MIN
   unmastered = the rest
   wantMastered   = round(size * masteredShare[tier])
   wantUnmastered = size - wantMastered
   takeMastered   = min(wantMastered, mastered.length)
   takeUnmastered = min(wantUnmastered, unmastered.length)
   shortfall = size - takeMastered - takeUnmastered
     fill the shortfall from whichever bucket has cards left,
     unmastered first, then mastered
   sample uniformly without replacement from each bucket
5. shuffle the combined list (Fisher-Yates using rng) and return it
```

Guarantees to assert in tests:

- Result length is exactly `size`, and never exceeds the pool.
- No card appears twice.
- Composition matches the tier table when both buckets are large enough
  (tier 4, size 20 → 12 unmastered / 8 mastered; size 10 → 6 / 4).
- A one-sided pool still yields a full-length session (shortfall backfill).
- Tier 1 with no weak cards, and tier 7 with no mastered cards, fall back to the pool
  rather than returning nothing.
- Given a fixed `rng`, output is identical across runs.

### 6.4 Recording an answer

```
recordAnswer(stats, got, now) -> CardStats   // pure, returns a new object
  gets   += got ? 1 : 0
  misses += got ? 0 : 1
  history = [...history, { at: now, got }] trimmed to the last 20
  lastSeenAt = now
```

The store writes the card immediately, one write per answer, so abandoning a quiz keeps
every answer already given. `Card.updatedAt` is untouched (§4.2).

### 6.5 Session lifecycle

States: `configuring` → `running` → `complete`. The running session holds the card
list, the current index, whether the current card is flipped, the answers so far, and a
one-entry undo snapshot of the previous card's pre-answer `CardStats`.

- Answering advances to the next card; answering the last card completes the session.
- **Undo** is offered only for the immediately previous card. It restores that card's
  saved `CardStats` verbatim, steps the index back, and shows that card flipped.
- Leaving mid-quiz (nav, back button) asks for confirmation. Confirming discards the
  session; answers already recorded stay recorded. There is no resume (ADR-010).
- A session is in-memory only. Reload loses the queue by design.

### 6.6 Summary

On completion show: cards answered, gets, misses, accuracy (`round(100 * gets / answered)`),
and the list of missed cards (front rendered, truncated). Two actions: **Quiz the missed
cards** — builds a new session from exactly those cards, same direction, tier and size
rules bypassed, order shuffled — and **Done**, returning to where the quiz started.

## 7. Screens

Hash routes (`createWebHashHistory`). Route names are stable API for tests.

| Name             | Path                       | Purpose                    |
| ---------------- | -------------------------- | -------------------------- |
| `home`           | `/`                        | Folder list                |
| `folder`         | `/folders/:folderId`       | Decks in a folder          |
| `deck`           | `/decks/:deckId`           | Cards in a deck            |
| `card-new`       | `/decks/:deckId/cards/new` | Card editor (create)       |
| `card-edit`      | `/cards/:cardId/edit`      | Card editor (edit)         |
| `quiz-configure` | `/quiz/configure`          | Custom quiz builder        |
| `quiz-run`       | `/quiz/run`                | Running quiz               |
| `quiz-summary`   | `/quiz/summary`            | Results                    |
| `settings`       | `/settings`                | Theme, backup, danger zone |
| `not-found`      | `/:pathMatch(.*)*`         | Fallback                   |

Mobile-first. Every interactive target is at least 44×44 CSS px. Prefer Bulma classes
over bespoke CSS. Every element an e2e test touches carries a `data-testid`.

### 7.1 Home — folders

List of folders, each row: name, deck count, card count, mastery bar (§7.6), link to the
folder, and a **Quiz** action that starts a quickstart quiz across all decks in the
folder. Header action: **New folder** (modal, name field). Row overflow menu, behind a
"more" trigger beside the name: rename (modal), delete (confirm dialog, §4.4). Empty state invites creating a folder and
explains that decks live inside folders.

### 7.2 Folder — decks

Breadcrumb `Folders / <name>`. Header actions: **New deck** (modal) and
**Custom quiz** (goes to `quiz-configure` with this folder's decks pre-checked).
Each deck row: name, card count, mastery bar, and a **Quiz** quickstart button
(`direction: front`, `tier: 4`, `size: 20`) that goes straight to `quiz-run`.
Row overflow, behind a "more" trigger beside the name: rename, move to another folder
(modal with folder select), delete.
An action with nothing to act on is disabled with a tooltip saying why: quickstart and
the header's **Custom quiz** when there are no cards to draw on, and **Move** when
there is no other folder to move the deck to. Empty state invites creating a deck.

### 7.3 Deck — cards

Breadcrumb `Folders / <folder> / <deck>`. Header actions: **New card**, **Bulk add**
(§9), **Quiz** and **Custom quiz** — the last two disabled with a tooltip while the deck
has no cards. Each card row shows the rendered front (clamped to ~2 lines), a mastery
badge (`new` / `NN%`), and edit/delete actions. Tapping a row opens the editor.

### 7.4 Card editor

Two markdown textareas (front, back) with a live rendered preview each, a character
counter, and Save / Cancel. Save is disabled while either side is empty or over
length. Unsaved-changes confirmation on navigate away. On create, stay on the deck and
offer **Save and add another** so runs of cards are quick to enter.

### 7.5 Quiz configure

Direction toggle (Front / Back), the 7-tier slider with its label, session size
(10 / 20 / 50 / All), and every deck grouped by folder as checkboxes with a
select-all per folder. Pre-filled from the launch context, then from
`cardio.quizConfig`. **Start quiz** is disabled until at least one deck with at least
one card is checked. If the resulting pool is empty, show an inline explanation instead
of navigating.

### 7.6 Quiz run

- Progress `7 / 20` plus a Bulma progress bar; an exit affordance that confirms.
- One card fills the viewport, showing the configured side. The whole card is the flip
  target: tap, click, `Space`, or `Enter`. Flip is a CSS 3D transform over
  `--cardio-flip-duration`, which `prefers-reduced-motion` collapses to 0.
- Before the flip: only a "Tap to reveal" hint. After the flip: both faces are visible
  (front above, back below, labelled) plus **Missed it** and **Got it** buttons.
  Keyboard: `1` / `←` = missed, `2` / `→` = got. The grading buttons must not be
  reachable before the flip.
- The undo affordance appears after the first answer and applies to that answer only.
- Long content scrolls inside the card; the page itself never scrolls horizontally.
- Announce the revealed face and the progress change via `aria-live="polite"`.

### 7.7 Quiz summary

Per §6.6.

### 7.8 Settings

Theme (System / Light / Dark), **Export backup**, **Import backup** (merge or replace),
storage-persistence status, install instructions when not installed, app version, and a
danger zone: **Delete all data** behind a typed confirmation.

### 7.9 Mastery bar

Reusable component: a thin 3-segment stacked bar — mastered, learning, new — with
`aria-label` "68% mastered, 12 learning, 4 new", and the headline `masteredPct` beside
it. Colours: mastered `is-success`, learning `is-warning`, new neutral grey. Zero-card
decks render an empty grey track and "No cards yet".

## 8. Markdown

`src/domain/markdown.ts` wraps one shared `markdown-it` instance:

```ts
new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: false })
```

- `html: false` is the security boundary: raw HTML in a card is escaped, so no
  sanitiser is needed and none should be added.
- `breaks: true` — a single newline is a line break, which is what card authors expect.
- Supported by consequence: emphasis, headings, lists, blockquotes, inline code, fenced
  code, tables, links.
- The `image` rule is **disabled** (`md.disable('image')`): `![alt](url)` would emit an
  `<img>` and reach the network, which §13 forbids. With that rule off, the `!` stays as
  text and the `[alt](url)` after it is still read as a link, so the whole thing renders
  as `!<a href="url" target="_blank" rel="noopener noreferrer">alt</a>`. Nothing is
  fetched — following the link is the reader's choice, not the page's.
- Links get `target="_blank" rel="noopener noreferrer"` via a renderer rule.
- Rendering is memoised by source string (bounded LRU, e.g. 500 entries) since quiz
  screens re-render the same faces repeatedly.
- Exposed as `renderMarkdown(src: string): string`, consumed through one
  `MarkdownText.vue` component that is the _only_ place in the app using `v-html`.

## 9. Bulk card add

Modal from the deck screen. A textarea plus a separator select: `|` (default), Tab, or
`::`. Parsing lives in `src/domain/bulkParse.ts`:

- One card per line. `front<sep>back`.
- Blank lines and whitespace-only lines are skipped silently.
- Leading/trailing whitespace is trimmed from both faces.
- Only the **first** occurrence of the separator splits the line, so the back may
  contain the separator.
- A line with no separator, or with an empty face, is reported as a numbered error and
  imported not at all.
- Multi-line card faces are not supported in v1; say so in the modal's help text.

`parseBulk(text, sep)` returns `{ cards: {front,back}[], errors: {line:number,reason:string}[] }`.
The modal shows "12 cards ready, 2 lines skipped" with the errors listed, and imports
only on explicit confirm, in one transaction.

## 10. Export and import

`src/domain/backup.ts` for shape and validation; `src/db` for reading and writing.

```json
{
  "app": "cardio",
  "schemaVersion": 1,
  "exportedAt": "2026-08-26T12:00:00.000Z",
  "folders": [{ "id": "...", "name": "...", "createdAt": 0, "updatedAt": 0 }],
  "decks": [{ "id": "...", "folderId": "...", "name": "...", "createdAt": 0, "updatedAt": 0 }],
  "cards": [
    {
      "id": "...",
      "deckId": "...",
      "front": "...",
      "back": "...",
      "createdAt": 0,
      "updatedAt": 0,
      "stats": { "gets": 0, "misses": 0, "history": [], "lastSeenAt": null }
    }
  ]
}
```

- Export downloads `cardio-backup-YYYY-MM-DD.json` via a Blob URL. Statistics are
  included.
- Import offers two modes: **Merge** — add rows whose IDs are absent, skip existing
  ones, and report both counts; **Replace everything** — behind a typed confirmation,
  clear all three tables and load the file. Nothing is seeded afterwards; a file with
  no folders leaves an empty library.
- Validation before any write: `app === 'cardio'`, `schemaVersion === 1`, every array
  present, every row passing §4.2 validation, no card referencing a missing deck and no
  deck a missing folder (orphans are rejected with a count: a deck whose folder is
  absent, and any card left without a deck). Failure means no write at all and a
  readable error.

## 11. Theme

Preference `system` | `light` | `dark` in `localStorage` under `cardio.theme`, default
`system`. Resolved to Bulma's `data-theme="light|dark"` on `<html>`. `index.html`
contains a pre-paint bootstrap script; `src/stores/theme.ts` owns it thereafter and must
stay in sync with that script. Under `system`, react live to
`matchMedia('(prefers-color-scheme: dark)')`.

## 12. PWA

Configured in `vite.config.ts` (done): `registerType: 'autoUpdate'`, app-shell precache,
`standalone`, portrait, theme `#00d1b2`, icons in `public/`. Requirements:

- Offline: after one visit, a cold start with the network off reaches a usable app with
  all data intact.
- Updates: the service worker updates in the background and applies on the next load.
  No update prompt in v1.
- The manifest `scope` and `start_url` must remain the site root, `/` — see ADR-046.
- Never add a runtime caching rule for a third-party origin; there are none.

## 13. Non-functional

- **Performance:** usable up to ~10,000 cards. Deck aggregates compute in a single pass
  and are memoised; do not recompute mastery per render inside a `v-for`. Session
  building is O(pool).
- **Accessibility:** keyboard-operable throughout; visible focus; the quiz card is a
  real `button`-semantics element; `aria-live` for flips and progress; contrast holds in
  both themes.
- **Offline-first:** no `fetch` to any origin at runtime, ever.
- **Time and randomness:** never call `Date.now()` or `Math.random()` inside domain
  code. Both are injected, which is what makes the suite deterministic.

## 14. Testing

Red/green TDD, per `CLAUDE.md`.

- **Unit (Vitest, `src/**/*.spec.ts`, colocated):** the whole domain layer — mastery,
  aggregates, quiz selection, answer recording, bulk parsing, backup validation,
  markdown — held at or near 100% branch coverage, tests written first. Repositories are
  tested against `fake-indexeddb` with a per-test database name.
- **Component (Vitest + `@vue/test-utils` + happy-dom):** the flip-and-grade interaction,
  the mastery bar, the card editor's validation, the bulk-add modal's reporting. Assert
  behaviour and rendered text, not internals.
- **E2E (Playwright, `e2e/`, chromium desktop + Pixel 5):** exactly one happy path, no
  edge cases — create folder → create deck → bulk-add 3 cards → quickstart quiz →
  answer all three → summary shows 2 got / 1 missed → deck mastery bar has updated.
- **CI gates:** `npm run lint`, `format:check`, `typecheck`, `test:coverage`, `build`,
  and the Playwright suite. All must pass before merge.

## 15. Definition of done for any plan item

1. Tests were written before the implementation and fail without it.
2. `npm run verify` passes (lint, format check, typecheck, unit tests, build).
3. `npm run e2e` passes when UI changed.
4. No scope beyond the item's plan file; no dependency added without a new ADR.
5. Placeholder views the item replaces are deleted, not left behind.
6. The plan file's `Status` is updated and any deviation is written into
   `docs/decisions.md`.
