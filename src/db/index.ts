import Dexie, { type EntityTable } from 'dexie'
import type { Card, Deck, Folder } from '@/domain/models'

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
