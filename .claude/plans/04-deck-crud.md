# 04 — Deck CRUD

Status: done
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

- [x] Full deck CRUD persists.
- [x] Deleting a deck confirms with its card count.
- [x] Breadcrumb navigates back to home.
- [x] `data-testid`s on rows and actions.

## Out of scope

The quickstart **Quiz** button (item 08) and the mastery bar (item 09) — this item leaves
room for both in `DeckRow` but adds neither.

## Notes

- The `folder` route now passes its parameter as a prop (`props: true`, ADR-022), so
  `FolderView` takes `folderId` and its spec mounts it without a router. Route names and
  paths are unchanged.
- `Breadcrumb` renders the `Folders` root itself and takes only the trail below it, which
  is what lets item 05 pass `[folder, deck]`.
- `MoveDialog` offers nothing and says why when the deck's folder is the only one, rather
  than opening an empty select.

## Review follow-ups

- `MoveDialog` takes an `error` and stays open when a move is refused, like the other
  dialogs that hold a choice or some typing (ADR-025).
