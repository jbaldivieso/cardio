/**
 * The listing orders the app uses. Both are applied in JavaScript rather than by
 * a Dexie index: `name` needs case-insensitive collation, and `createdAt` is
 * deliberately not indexed (spec §4.3 fixes the version 1 indexes).
 */

/** Alphabetical, case- and accent-insensitive. Used for folder and deck lists. */
export function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

/** Newest first, so a card just added is at the top of its deck rather than buried. */
export function byNewestFirst<T extends { createdAt: number }>(a: T, b: T): number {
  return b.createdAt - a.createdAt
}
