# 00 — Scaffold

Status: done
Depends on: —
Spec: §12, §14

## Goal

A running, installable, tested skeleton so every later item starts from green.

## What exists

- Vite 8 + Vue 3 + TypeScript strict, `@/` → `src/`, base `/cardio/`.
- Bulma 1.x via Sass (`src/styles/main.scss`), `quietDeps` on.
- `vite-plugin-pwa` with manifest, icons in `public/`, `autoUpdate`, app-shell precache.
- Hash router with every route from spec §7 wired to a `PlaceholderPanel` view.
- `src/domain/models.ts` — entity types, `MASTERY_HISTORY_LIMIT`, `emptyStats()`.
- `src/db/index.ts` — Dexie v1 schema, `seedDefaults()` for the Unsorted folder.
- Vitest + happy-dom + `@vue/test-utils` + `fake-indexeddb` (`src/test/setup.ts`).
  Green: `src/db/index.spec.ts`, `src/components/AppNav.spec.ts`.
- Playwright, chromium desktop + Pixel 5, `e2e/smoke.spec.ts` green.
- ESLint (incl. the domain-purity rule), Prettier, `npm run verify`.
- CI workflow (lint, format, typecheck, coverage, build, e2e) and Pages deploy workflow.

## Notes

Pages needs one manual step in the repo settings: **Settings → Pages → Source: GitHub
Actions**.
