# 03 — Folder CRUD

Status: not started
Depends on: 01
Spec: §7.1 (home), §4.4 (deletion), §7 (conventions)

## Goal

The home screen: see your folders with counts, create, rename and delete them.

## Deliverables

- `src/stores/library.ts` — folders and decks state, loading flags, error surface,
  owns the clock (`Date.now()`) when calling repositories.
- `src/views/FoldersView.vue` — replaces the placeholder.
- `src/components/FolderRow.vue`, `NameDialog.vue` (create/rename modal),
  `ConfirmDialog.vue` (destructive confirm, takes a message and requires an explicit
  click).
- Specs for the store and for both dialogs.

## Tests first

- Store: `load()` populates folders; `create()` appends and persists; `rename()` updates
  in place; `remove()` drops it; a rejected repository call sets `error` and leaves state
  unchanged.
- `NameDialog`: Save disabled while empty or whitespace; trims on submit; emits `submit`
  with the trimmed name; `Escape` cancels.
- `ConfirmDialog`: renders the supplied counts message; emits only on confirm.
- `FoldersView`: renders one row per folder with deck and card counts; empty state when
  none; the Unsorted row offers rename but not delete.

## Acceptance

- [ ] Create, rename, delete work against IndexedDB and survive a reload.
- [ ] Delete confirmation names the deck and card counts (§4.4 wording).
- [ ] Unsorted cannot be deleted from the UI.
- [ ] Rows link to `/folders/:id`; `data-testid`s on rows, actions and the empty state.
- [ ] Mobile layout: no horizontal scroll at 360 px wide.

## Out of scope

Mastery bars (item 09) — leave the space, no placeholder graphic. Folder-level quiz
button (item 08).
