import type { CardioDb } from '@/db'

/** The sliver of `navigator.storage` this module uses; keeps the tests cast-free. */
export type DurableStorage = Pick<StorageManager, 'persist'>

/**
 * Ask the browser to make this origin's storage persistent (spec §4.5).
 *
 * Best effort by design: an origin that has not earned the browser's trust is
 * simply refused, and a browser without the API refuses by omission. Neither is
 * a failure worth propagating into the write that triggered it.
 */
export async function requestPersistentStorage(
  storage: DurableStorage | undefined = globalThis.navigator?.storage,
): Promise<boolean> {
  if (!storage?.persist) return false
  try {
    return await storage.persist()
  } catch {
    return false
  }
}

// Keyed by database instance rather than module-global so that each test's
// database starts fresh, and so a real app (one instance) asks exactly once.
const asked = new WeakSet<CardioDb>()

/**
 * Run a write and, if it succeeded, make the one durability request this
 * database gets (§4.5). The request is deliberately not awaited: durability is
 * a background nicety, never something a user waits on.
 */
export async function durableWrite<T>(database: CardioDb, write: () => Promise<T>): Promise<T> {
  const result = await write()
  if (!asked.has(database)) {
    asked.add(database)
    void requestPersistentStorage()
  }
  return result
}
