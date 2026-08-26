# 10 — Settings, theme and backup

Status: not started
Depends on: 01
Spec: §7.8, §10 (export/import), §11 (theme), §4.5 (durability)

## Goal

Dark mode the user controls, a backup they can actually take, and a clearly-marked way
to wipe everything.

## Deliverables

- `src/stores/theme.ts` — `system | light | dark` in `localStorage` under
  `cardio.theme`, applied as `data-theme` on `<html>`, live-reacting to
  `prefers-color-scheme` under `system`. Must stay consistent with the pre-paint script
  in `index.html`.
- `src/domain/backup.ts` — `serialise(data)`, `validateBackup(json)` returning
  `{ ok: true, data } | { ok: false, errors }` per §10.
- `src/views/SettingsView.vue` — replaces the placeholder: theme control, export,
  import (merge / replace), storage-persistence status, install hint, version, danger
  zone behind a typed confirmation.
- Storage-persistence request on first write (§4.5) if not already done in item 01.
- Specs.

## Tests first

`backup.ts`:

- A round trip (export → import) reproduces every folder, deck, card and stat exactly.
- Rejects: wrong `app`, wrong `schemaVersion`, a missing array, a card with an empty
  face, a deck referencing a missing folder, a card referencing a missing deck.
- Rejection produces zero writes and a readable list of errors.
- Merge adds only unknown IDs and reports `{ added, skipped }`.
- Replace clears everything, loads the file, and re-seeds Unsorted.
- An orphaned deck is re-homed to Unsorted; orphaned cards are counted and rejected.

`theme.ts`:

- Default is `system`; an explicit choice persists and applies immediately.
- Under `system`, a `matchMedia` change flips `data-theme`.
- Corrupt or unknown stored values fall back to `system`.

## Acceptance

- [ ] Export downloads `cardio-backup-YYYY-MM-DD.json` containing stats.
- [ ] Import merge and replace both work, with counts reported.
- [ ] Theme survives a reload with no flash of the wrong palette.
- [ ] "Delete all data" requires typing a confirmation and then leaves a usable empty app
      (Unsorted present).

## Out of scope

Cloud backup, scheduled backup, partial (per-deck) export.
