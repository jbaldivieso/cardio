import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CardioDb, UNSORTED_FOLDER_ID, UNSORTED_FOLDER_NAME } from '@/db'
import { createLibraryRepo, type LibrarySnapshot } from '@/db/repositories/library'
import type { Card } from '@/domain/models'
import { emptyStats } from '@/domain/models'

function cardIn(deckId: string, id: string, front: string): Card {
  return {
    id,
    deckId,
    front,
    back: 'back',
    createdAt: 1,
    updatedAt: 1,
    stats: { ...emptyStats(), gets: 3, misses: 1, lastSeenAt: 900 },
  }
}

const snapshot: LibrarySnapshot = {
  folders: [{ id: 'folder-1', name: 'Spanish', createdAt: 1, updatedAt: 1 }],
  decks: [{ id: 'deck-1', folderId: 'folder-1', name: 'Verbs', createdAt: 1, updatedAt: 1 }],
  cards: [cardIn('deck-1', 'card-1', 'hablar')],
}

describe('library repository', () => {
  let db: CardioDb
  let library: ReturnType<typeof createLibraryRepo>

  beforeEach(async () => {
    db = new CardioDb(`cardio-test-${crypto.randomUUID()}`)
    library = createLibraryRepo(db)
    // Something to be replaced, so "replace" can be told from "merge".
    await db.folders.bulkAdd([
      { id: UNSORTED_FOLDER_ID, name: UNSORTED_FOLDER_NAME, createdAt: 1, updatedAt: 1 },
      { id: 'old-folder', name: 'German', createdAt: 1, updatedAt: 1 },
    ])
    await db.decks.add({
      id: 'old-deck',
      folderId: 'old-folder',
      name: 'Nouns',
      ...{ createdAt: 1, updatedAt: 1 },
    })
    await db.cards.add(cardIn('old-deck', 'old-card', 'der Hund'))
  })

  afterEach(async () => {
    await db.delete()
  })

  describe('replaceAll', () => {
    it('loads the snapshot and drops everything that was there before', async () => {
      await library.replaceAll(snapshot, 5000)

      expect((await db.decks.toArray()).map((deck) => deck.id)).toEqual(['deck-1'])
      expect((await db.cards.toArray()).map((card) => card.id)).toEqual(['card-1'])
      expect((await db.folders.toArray()).map((folder) => folder.name)).toContain('Spanish')
      expect(await db.folders.get('old-folder')).toBeUndefined()
    })

    it('keeps statistics exactly as the snapshot carried them', async () => {
      await library.replaceAll(snapshot, 5000)

      expect((await db.cards.get('card-1'))?.stats).toEqual(snapshot.cards[0].stats)
    })

    it('re-seeds the Unsorted folder, which the snapshot need not contain', async () => {
      await library.replaceAll(snapshot, 5000)

      expect(await db.folders.get(UNSORTED_FOLDER_ID)).toEqual({
        id: UNSORTED_FOLDER_ID,
        name: UNSORTED_FOLDER_NAME,
        createdAt: 5000,
        updatedAt: 5000,
      })
    })

    it('prefers the snapshot’s own Unsorted folder to a fresh one', async () => {
      const renamed = { id: UNSORTED_FOLDER_ID, name: 'Inbox', createdAt: 1, updatedAt: 2 }

      await library.replaceAll({ ...snapshot, folders: [...snapshot.folders, renamed] }, 5000)

      expect(await db.folders.get(UNSORTED_FOLDER_ID)).toEqual(renamed)
    })

    it('writes nothing at all when the snapshot cannot be loaded', async () => {
      const duplicated = { ...snapshot, cards: [snapshot.cards[0], snapshot.cards[0]] }

      await expect(library.replaceAll(duplicated, 5000)).rejects.toThrow()

      // The transaction rolled back, so the old library is still intact.
      expect(await db.folders.get('old-folder')).toBeDefined()
      expect(await db.cards.get('old-card')).toBeDefined()
    })

    it('empties the library when given an empty snapshot, leaving Unsorted behind', async () => {
      await library.replaceAll({ folders: [], decks: [], cards: [] }, 5000)

      expect(await db.decks.count()).toBe(0)
      expect(await db.cards.count()).toBe(0)
      expect((await db.folders.toArray()).map((folder) => folder.id)).toEqual([UNSORTED_FOLDER_ID])
    })
  })
})
