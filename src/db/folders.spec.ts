import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CardioDb, seedDefaults, UNSORTED_FOLDER_ID } from '@/db'
import { createFolderRepo } from '@/db/folders'
import { emptyStats } from '@/domain/models'
import { ValidationError } from '@/domain/validation'

describe('folder repository', () => {
  let db: CardioDb
  let folders: ReturnType<typeof createFolderRepo>

  beforeEach(() => {
    db = new CardioDb(`cardio-test-${crypto.randomUUID()}`)
    folders = createFolderRepo(db)
  })

  afterEach(async () => {
    await db.delete()
  })

  async function seedDeck(id: string, folderId: string, cardIds: string[]): Promise<void> {
    await db.decks.add({ id, folderId, name: id, createdAt: 1, updatedAt: 1 })
    await db.cards.bulkAdd(
      cardIds.map((cardId) => ({
        id: cardId,
        deckId: id,
        front: 'f',
        back: 'b',
        createdAt: 1,
        updatedAt: 1,
        stats: emptyStats(),
      })),
    )
  }

  describe('create', () => {
    it('stores a folder whose timestamps both start at the given moment', async () => {
      const folder = await folders.create('Spanish', 5000)

      expect(await db.folders.get(folder.id)).toEqual({
        id: folder.id,
        name: 'Spanish',
        createdAt: 5000,
        updatedAt: 5000,
      })
    })

    it('trims the name before storing it', async () => {
      const folder = await folders.create('  Spanish  ', 5000)

      expect(folder.name).toBe('Spanish')
    })

    it('gives each folder its own id', async () => {
      const one = await folders.create('One', 5000)
      const two = await folders.create('Two', 5000)

      expect(one.id).not.toBe(two.id)
    })

    it('rejects a blank name without writing anything', async () => {
      await expect(folders.create('   ', 5000)).rejects.toThrow(ValidationError)
      expect(await db.folders.count()).toBe(0)
    })

    it('rejects a name over the length limit', async () => {
      await expect(folders.create('a'.repeat(81), 5000)).rejects.toThrow(ValidationError)
    })

    it('allows two folders to share a name', async () => {
      await folders.create('Spanish', 5000)

      await expect(folders.create('Spanish', 6000)).resolves.toMatchObject({ name: 'Spanish' })
    })
  })

  describe('list', () => {
    it('orders folders by name, ignoring case', async () => {
      await folders.create('zebra', 1000)
      await folders.create('Apple', 2000)
      await folders.create('mango', 3000)

      expect((await folders.list()).map((folder) => folder.name)).toEqual([
        'Apple',
        'mango',
        'zebra',
      ])
    })

    it('returns an empty list for a fresh database', async () => {
      expect(await folders.list()).toEqual([])
    })
  })

  describe('get', () => {
    it('returns undefined for an id that is not there', async () => {
      expect(await folders.get('nope')).toBeUndefined()
    })
  })

  describe('rename', () => {
    it('bumps updatedAt and leaves createdAt alone', async () => {
      const folder = await folders.create('Spanish', 5000)

      const renamed = await folders.rename(folder.id, '  Español  ', 9000)

      expect(renamed).toEqual({
        id: folder.id,
        name: 'Español',
        createdAt: 5000,
        updatedAt: 9000,
      })
    })

    it('renames the Unsorted folder, which is a label like any other', async () => {
      await seedDefaults(db, 1000)

      const renamed = await folders.rename(UNSORTED_FOLDER_ID, 'Inbox', 2000)

      expect(renamed.name).toBe('Inbox')
    })

    it('rejects a blank name and leaves the stored name intact', async () => {
      const folder = await folders.create('Spanish', 5000)

      await expect(folders.rename(folder.id, ' ', 9000)).rejects.toThrow(ValidationError)
      expect((await db.folders.get(folder.id))?.name).toBe('Spanish')
    })

    it('reports a folder that is no longer there', async () => {
      await expect(folders.rename('gone', 'Spanish', 9000)).rejects.toThrow(ValidationError)
    })
  })

  describe('remove', () => {
    it('deletes the folder together with its decks and their cards', async () => {
      const folder = await folders.create('Spanish', 1000)
      await seedDeck('deck-1', folder.id, ['card-1', 'card-2'])
      await seedDeck('deck-2', folder.id, ['card-3'])

      await folders.remove(folder.id)

      expect(await db.folders.count()).toBe(0)
      expect(await db.decks.count()).toBe(0)
      expect(await db.cards.count()).toBe(0)
    })

    it('leaves another folder, its decks and its cards untouched', async () => {
      const doomed = await folders.create('Spanish', 1000)
      const keeper = await folders.create('German', 1000)
      await seedDeck('deck-1', doomed.id, ['card-1'])
      await seedDeck('deck-2', keeper.id, ['card-2'])

      await folders.remove(doomed.id)

      expect((await db.folders.toArray()).map((row) => row.id)).toEqual([keeper.id])
      expect((await db.decks.toArray()).map((row) => row.id)).toEqual(['deck-2'])
      expect((await db.cards.toArray()).map((row) => row.id)).toEqual(['card-2'])
    })

    it('refuses to delete the Unsorted folder', async () => {
      await seedDefaults(db, 1000)

      await expect(folders.remove(UNSORTED_FOLDER_ID)).rejects.toThrow(ValidationError)
      expect(await db.folders.get(UNSORTED_FOLDER_ID)).toBeDefined()
    })

    it('is a no-op for a folder that is already gone', async () => {
      const keeper = await folders.create('German', 1000)

      await expect(folders.remove('gone')).resolves.toBeUndefined()
      expect(await db.folders.get(keeper.id)).toBeDefined()
    })
  })

  describe('contents', () => {
    it('counts the decks and cards a delete would take with it', async () => {
      const folder = await folders.create('Spanish', 1000)
      await seedDeck('deck-1', folder.id, ['card-1', 'card-2'])
      await seedDeck('deck-2', folder.id, ['card-3'])

      expect(await folders.contents(folder.id)).toEqual({ decks: 2, cards: 3 })
    })

    it('counts nothing for an empty folder', async () => {
      const folder = await folders.create('Spanish', 1000)

      expect(await folders.contents(folder.id)).toEqual({ decks: 0, cards: 0 })
    })
  })
})
