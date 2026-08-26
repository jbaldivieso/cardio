# 05 — Cards, markdown and bulk add

Status: not started
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

- [ ] Cards persist and reload.
- [ ] `v-html` appears in `MarkdownText.vue` and nowhere else (grep it).
- [ ] Bulk add writes in a single transaction.
- [ ] `npm run verify` green.

## Out of scope

Mastery badges on rows (item 09). Search, tags, multi-line bulk faces — out of scope
entirely (§2).
