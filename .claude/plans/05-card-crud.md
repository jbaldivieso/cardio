# 05 — Cards, markdown and bulk add

Status: done
Depends on: 01, 04
Spec: §7.3, §7.4, §8 (markdown), §9 (bulk add)

## Goal

Create, edit and delete cards with a markdown preview, and paste a batch of cards in one
go.

## Deliverables

- `src/domain/markdown.ts` — one shared `markdown-it` (html off, linkify on, breaks on,
  `image` rule disabled), external-link rule, memoised `renderMarkdown()` with a bounded
  LRU.
- `src/components/MarkdownText.vue` — the only `v-html` in the app.
- `src/domain/bulkParse.ts` — `parseBulk(text, sep)` per §9.
- `src/views/DeckView.vue`, `src/views/CardEditView.vue` — replace placeholders.
- `src/components/CardRow.vue`, `BulkAddDialog.vue`.
- `src/stores/cards.ts` (or extend `library`) for the card list of one deck.
- Specs for all of the above.

## Tests first

`markdown.ts`:

- Emphasis, lists, inline and fenced code, tables, blockquotes render.
- `<script>alert(1)</script>` in a card face renders as visible text, not a script tag.
- `![x](http://e/x.png)` does not produce an `<img>`.
- A link gets `target="_blank"` and `rel="noopener noreferrer"`.
- A single newline becomes `<br>`.
- The same input twice returns the identical string (memoisation) and the cache is bounded.

`bulkParse.ts`:

- `front|back` → one card; whitespace trimmed.
- Blank and whitespace-only lines skipped, not reported as errors.
- Only the first separator splits: `a|b|c` → front `a`, back `b|c`.
- A line with no separator, or an empty face, is reported with its 1-based line number
  and contributes no card.
- Tab and `::` separators work.
- 500 lines parse without pathological behaviour.

Views:

- `CardEditView`: Save disabled while either face is empty or over 4000 chars; preview
  reflects typing; Cancel with unsaved changes asks first; create mode offers "Save and
  add another" and clears the fields.
- `DeckView`: rows show the rendered front clamped to two lines; empty state; delete
  confirms.
- `BulkAddDialog`: shows "N cards ready, M lines skipped" with the error lines listed;
  imports only on confirm; nothing is written when parsing found zero valid cards.

## Acceptance

- [x] Cards persist and reload.
- [x] `v-html` appears in `MarkdownText.vue` and nowhere else (grep it).
- [x] Bulk add writes in a single transaction.
- [x] `npm run verify` green.

## Out of scope

Mastery badges on rows (item 09). Search, tags, multi-line bulk faces — out of scope
entirely (§2).

## Notes

- The bounded LRU is its own pure function, `src/domain/memoise.ts`, rather than private
  state inside `markdown.ts`. Eviction has no observable effect through `renderMarkdown`
  alone — two equal strings are equal whether or not the cache held one — so testing the
  bound at all meant testing it where a spy can count the misses (ADR-023).
- `src/stores/errors.ts` holds the `error` / `attempt` pair both stores use; item 03's
  copy in `library.ts` moved there rather than being duplicated in `cards.ts`.
- The card faces of a deck live in `src/stores/cards.ts`, separate from `library`. It does
  not push counts back into the library store: every screen reloads on mount, so the
  folder and deck counts are recomputed from the database on the way back (ADR-024).
- The unsaved-changes confirmation is an `onBeforeRouteLeave` guard, so it covers the nav
  bar and the back button as well as Cancel (§7.4). That is why `CardEditView.spec.ts`
  mounts through a `RouterView` at the real route instead of mounting the view with props.
- `deck`, `card-new` and `card-edit` now take their route parameters as props, as item 04
  did for `folder` (ADR-022).
