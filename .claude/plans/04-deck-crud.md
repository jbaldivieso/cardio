# 04 — Deck CRUD

Status: not started
Depends on: 01, 03
Spec: §7.2

## Goal

Inside a folder: list its decks with card counts, create, rename, move between folders,
and delete.

## Deliverables

- `src/views/FolderView.vue` — replaces the placeholder.
- `src/components/DeckRow.vue`, `MoveDialog.vue` (folder select).
- `src/components/Breadcrumb.vue` — reused by item 05.
- Extend `src/stores/library.ts` with deck actions.
- Specs.

## Tests first

- Store: `createDeck` in the current folder; `moveDeck` changes `folderId` and removes
  the deck from the old folder's list; delete cascades (already covered at the repository
  level — here assert the store's state).
- `FolderView`: unknown `folderId` → a not-found message, not a crash; empty folder →
  empty state inviting a first deck; each row shows its card count.
- `MoveDialog`: lists every folder except the current one; emits the chosen id.
- `Breadcrumb`: renders `Folders / <name>` with a working link.

## Acceptance

- [ ] Full deck CRUD persists.
- [ ] Deleting a deck confirms with its card count.
- [ ] Breadcrumb navigates back to home.
- [ ] `data-testid`s on rows and actions.

## Out of scope

The quickstart **Quiz** button (item 08) and the mastery bar (item 09) — this item leaves
room for both in `DeckRow` but adds neither.
