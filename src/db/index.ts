import Dexie, { type EntityTable } from 'dexie'
import type { Card, Deck, Folder } from '@/domain/models'

/** Every deck belongs to a folder; this one always exists and cannot be deleted. */
export const UNSORTED_FOLDER_ID = 'unsorted'
export const UNSORTED_FOLDER_NAME = 'Unsorted'

export const DB_NAME = 'cardio'

export class CardioDb extends Dexie {
  folders!: EntityTable<Folder, 'id'>
  decks!: EntityTable<Deck, 'id'>
  cards!: EntityTable<Card, 'id'>

  constructor(name: string = DB_NAME) {
    super(name)
    // Indexes are declared for the lookups the app actually performs: decks by
    // folder, cards by deck, plus name/updatedAt for sorted listings.
    this.version(1).stores({
      folders: 'id, name, updatedAt',
      decks: 'id, folderId, name, updatedAt',
      cards: 'id, deckId, updatedAt',
    })
  }
}

export const db = new CardioDb()

/** Idempotent first-run setup. Safe to call on every app boot. */
export async function seedDefaults(target: CardioDb = db, now: number = Date.now()): Promise<void> {
  const existing = await target.folders.get(UNSORTED_FOLDER_ID)
  if (existing) return
  await target.folders.add({
    id: UNSORTED_FOLDER_ID,
    name: UNSORTED_FOLDER_NAME,
    createdAt: now,
    updatedAt: now,
  })
}
