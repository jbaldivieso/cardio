# 01 — Persistence layer

Status: done
Depends on: 00
Spec: §4 (entities, invariants, validation, deletion, durability)

## Goal

Every read and write the app needs, behind a repository API that no component or domain
module can see past. Validation and cascade rules live here, tested against a real
(faked) IndexedDB.

## Deliverables

- `src/db/repositories/folders.ts`, `decks.ts`, `cards.ts` — or one
  `src/db/repositories.ts` if it stays under ~200 lines.
- `src/db/validation.ts` — name and card-face rules from §4.2, returning typed errors
  rather than throwing strings.
- Boot wiring: `seedDefaults()` runs once at app start; request
  `navigator.storage.persist()` on first successful write (§4.5), failures ignored.
- Colocated `*.spec.ts` for each.

## API sketch

```ts
listFolders(): Promise<Folder[]>                       // name asc
createFolder(name: string, now: number): Promise<Folder>
renameFolder(id: string, name: string, now: number): Promise<void>
deleteFolder(id: string): Promise<void>                // cascades, rejects 'unsorted'

listDecks(folderId?: string): Promise<Deck[]>
createDeck(folderId: string, name: string, now: number): Promise<Deck>
renameDeck(id, name, now) / moveDeck(id, folderId, now) / deleteDeck(id)

listCards(deckId: string): Promise<Card[]>             // createdAt desc
createCard(deckId, front, back, now): Promise<Card>
createCards(deckId, faces: {front,back}[], now): Promise<Card[]>   // one transaction
updateCard(id, { front, back }, now): Promise<void>    // bumps updatedAt
deleteCard(id): Promise<void>
recordAttempt(id: string, got: boolean, now: number): Promise<Card>  // never bumps updatedAt
replaceAll(data: BackupPayload): Promise<void>         // used by item 10
```

## Tests first

- Creating a folder/deck/card assigns a UUID, sets both timestamps, and round-trips.
- Empty, whitespace-only and over-length names are rejected; the message names the field.
- Card faces trimmed; empty after trim rejected; >4000 chars rejected.
- `createDeck` with an unknown `folderId` rejects; same for `createCard` with an unknown
  `deckId`.
- Deleting a folder deletes its decks and their cards, and nothing else's.
- Deleting the Unsorted folder rejects; renaming it succeeds.
- `seedDefaults()` recreates a missing Unsorted folder and is idempotent (already green).
- `recordAttempt` increments the right counter, appends to `history`, sets `lastSeenAt`,
  caps history at 20 (21 attempts → 20 entries, oldest dropped), and leaves `updatedAt`
  unchanged.
- `listCards` ordering, `listDecks(folderId)` filtering.
- A failed multi-card insert writes nothing (transaction rollback).

## Acceptance

- [x] Every method above exists, typed, with tests.
- [x] No Dexie import outside `src/db/`.
- [x] Each test uses its own database name and deletes it afterwards.
- [x] `npm run verify` green.

## Out of scope

Stores, UI, backup file parsing (item 10), mastery (item 02).

## Notes

- The §4.2 rules live in `src/domain/validation.ts`, not `src/db/validation.ts` as the
  deliverables above say. Item 10's `src/domain/backup.ts` has to apply exactly the same
  rules to every imported row, and ESLint forbids `src/domain/**` from importing
  `@/db/*`; in `src/db` they would have had to be duplicated. Recorded as ADR-017.
- `listCards` is newest first, as specified. ADR-018 carries the reasoning, which is
  §7.4's "Save and add another": a card just typed belongs at the top of its deck.
- `cardRepo` has both stats writers. `recordAttempt(id, got, now)` is the one the plan
  asks for and the one the quiz uses; `saveStats(id, stats)` writes a snapshot wholesale,
  which is what §6.5's undo restores through. Both cap `history` and leave `updatedAt`.
- `replaceAll` lives on a fourth repository, `libraryRepo`, since it spans all three
  tables. It writes only — §10's validation stays in item 10, as does export reading.
- Delivered slightly ahead of the sketch, because §4.4's confirmation dialog and §6.3's
  quiz pool need them and they cost a line each: `folderRepo.contents(id)`,
  `deckRepo.cardCount(id)`, `cardRepo.listByDecks(deckIds)` and a `get(id)` per
  repository. `listDecks(folderId?)` is two methods, `list()` and `listByFolder(id)`, so
  that a forgotten argument cannot silently return every deck in the app.
- `seedDefaults()` runs in `src/main.ts` before the first mount, with a failure swallowed
  so a browser refusing IndexedDB still renders. It has no unit test of its own — there
  is nothing observable to assert until item 03 renders the folder list; item 12's e2e
  covers it end to end.
