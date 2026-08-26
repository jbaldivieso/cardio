/**
 * The listing orders the app uses. Both are applied in JavaScript rather than by
 * a Dexie index: `name` needs case-insensitive collation, and `createdAt` is
 * deliberately not indexed (spec §4.3 fixes the version 1 indexes).
 */

/** Alphabetical, case- and accent-insensitive. Used for folder and deck lists. */
export function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

/** Oldest first, so a deck reads in the order its cards were added. */
export function byCreatedAt<T extends { createdAt: number }>(a: T, b: T): number {
  return a.createdAt - b.createdAt
}
