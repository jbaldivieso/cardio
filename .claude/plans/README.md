# Plans

One file per work item, in order. Do them one at a time, on a branch named after the
item. Each file states its own scope; `docs/spec.md` holds the detail it cites.

| #   | Item                                                               | Depends on |
| --- | ------------------------------------------------------------------ | ---------- |
| 00  | [Scaffold](00-scaffold.md) — **done**                              | —          |
| 01  | [Persistence layer](01-persistence-layer.md) — **done**            | 00         |
| 02  | [Mastery domain](02-mastery-domain.md) — **done**                  | 00         |
| 03  | [Folder CRUD](03-folder-crud.md) — **done**                        | 01         |
| 04  | [Deck CRUD](04-deck-crud.md) — **done**                            | 01, 03     |
| 05  | [Card CRUD + markdown + bulk add](05-card-crud.md) — **done**      | 01, 04     |
| 06  | [Quiz selection domain](06-quiz-selection.md) — **done**           | 02         |
| 07  | [Quiz runner UI](07-quiz-ui.md) — **done**                         | 05, 06     |
| 08  | [Quiz entry points](08-quiz-entry-points.md) — **done**            | 07         |
| 09  | [Mastery display](09-mastery-display.md) — **done**                | 02, 04     |
| 10  | [Settings, theme and backup](10-settings-and-backup.md) — **done** | 01         |
| 11  | [PWA polish](11-pwa-polish.md)                                     | 07         |
| 12  | [E2E happy path](12-e2e-happy-path.md)                             | 08, 09     |

01 and 02 were independent of each other. Everything from 03 on assumes the persistence
layer exists.

## Item format

```
# NN — Title
Status: not started | in progress | done
Depends on: item numbers
Spec: the sections of docs/spec.md this implements

## Goal            one paragraph, what the user can do afterwards
## Deliverables    files to add or change
## Tests first     the red tests to write before any implementation
## Acceptance      checkboxes, verifiable
## Out of scope    what belongs to a later item
## Notes           anything discovered while doing it
```

Definition of done for every item: spec §15.
