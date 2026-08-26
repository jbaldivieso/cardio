# 08 — Quiz entry points

Status: not started
Depends on: 07
Spec: §6.1, §6.2, §7.2, §7.5

## Goal

Every way into a quiz: one-tap quickstart from a deck or folder, and the custom builder.

## Deliverables

- `src/views/QuizConfigureView.vue` — replaces the placeholder.
- `src/components/TierSlider.vue` — 7 steps with the §6.2 labels, keyboard accessible.
- `src/components/DeckPicker.vue` — decks grouped by folder, checkboxes, select-all
  per folder.
- Quickstart buttons in `DeckRow` and on the home screen's folder rows.
- `cardio.quizConfig` persistence for the last-used custom config.

## Tests first

- Quickstart uses the hard defaults (front, tier 4, size 20) regardless of what is
  stored in `cardio.quizConfig`.
- Quickstart is disabled for a deck with no cards, with a reason exposed to
  screen readers.
- A folder quiz pools every deck in that folder.
- `TierSlider`: 7 discrete positions, arrow keys move one step, the label matches the
  tier, `aria-valuetext` is set.
- `DeckPicker`: pre-checks the launch context; select-all toggles a folder's decks;
  Start is disabled until at least one deck with at least one card is selected.
- The configure screen restores the last-used config on a fresh visit (mock
  `localStorage`), and saves it on start.
- An empty resulting pool shows an inline explanation and does not navigate.

## Acceptance

- [ ] Deck quickstart, folder quickstart and custom quiz all reach a running session.
- [ ] Defaults are exactly those in spec §6.1.
- [ ] Config round-trips through `localStorage`; corrupt stored JSON falls back to
      defaults instead of throwing.
- [ ] `npm run verify` green; `PlaceholderPanel.vue` is now deleted.

## Out of scope

Mastery bars (item 09).
