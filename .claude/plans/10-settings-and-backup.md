# 10 — Settings, theme and backup

Status: done
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

- [x] Export downloads `cardio-backup-YYYY-MM-DD.json` containing stats.
- [x] Import merge and replace both work, with counts reported.
- [x] Theme survives a reload with no flash of the wrong palette. The store's half is
      covered by `theme.spec.ts`; the no-flash half is the pre-paint script that was
      already in `index.html`, which the store now matches rule for rule.
- [x] "Delete all data" requires typing a confirmation and then leaves a usable empty app
      (Unsorted present).

## Out of scope

Cloud backup, scheduled backup, partial (per-deck) export.

## Notes

- `serialise(data, now)` and `backupFilename(now)` take the clock as an argument: the
  domain never calls `Date.now()` (§13). The store supplies it, as every store does.
- Two files this list did not name were needed. `src/stores/backup.ts` holds the
  export/import/delete orchestration, because a view that thin cannot host logic worth
  testing (CLAUDE.md > Architecture, rule 4). `src/components/TypedConfirmDialog.vue` is
  shared by "Replace everything" and "Delete all data" — the same dialog, twice.
- The plan's "Rejects:" list and its orphan bullet disagree about a deck with a missing
  folder and a card with a missing deck. §10 settles it: they are repaired, not refused.
  See docs/decisions.md > ADR-034.
- Item 01 had already delivered `replaceAll` and the storage-durability request, so this
  item added `snapshot`, `mergeAll` and the `persisted()` status query beside them.
- The library repository now reports merges as `{ added, skipped }` totalled across the
  three tables, which is what the screen says out loud.
- Merged with item 09 after it landed. Its mastery memo is invalidated per deck by
  whoever writes (ADR-032), which an import cannot express: a replace changes what every
  deck id means, and some of them stop existing. `mastery.invalidateAll()` is the
  library-wide form of the same rule, and every write in the backup store calls it.
- Review round on PR #7. Fifteen findings, all fixed on the branch; the five that
  changed a design decision are ADR-038 to ADR-042. The rest were local:
  `snapshot()` now reads the three tables in one `'r'` transaction, so a write from a
  second tab cannot tear a backup; the export's object URL outlives the click by a
  minute, because Firefox and older WebKit fetch a `blob:` href after the click returns
  and revoking on the next tick cancels the download silently; `offerDownload` moved
  inside `attempt`, so a browser that refuses to make the URL says so instead of
  rejecting into a click handler; `busy` is bound to the four buttons it guards, so its
  no-op is visible rather than a click that does nothing; backup validation rejects a
  non-string name or face instead of `String()`-ing it into `"[object Object]"`, names
  which statistic it could not read, and reads an absent `lastSeenAt` as "never seen"
  rather than failing the whole file over it; `SettingsView.spec.ts` and
  `TypedConfirmDialog.spec.ts` unmount what they mount and reset the clock in
  `afterEach`, so one failing assertion no longer leaks a 2026 clock and a live keydown
  listener into every test after it.
