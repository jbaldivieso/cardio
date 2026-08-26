import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { seedDefaults, UNSORTED_FOLDER_ID } from '@/db'
import { useLibraryStore } from '@/stores/library'
import { repositories } from '@/stores/repositories'
import { useTestDatabase } from '@/test/repositories'

describe('library store', () => {
  const test = useTestDatabase()

  beforeEach(async () => {
    setActivePinia(createPinia())
    await seedDefaults(test.db, 1000)
  })

  /** A folder holding `decks.length` decks of `cardsPerDeck` cards each. */
  async function seedFolder(name: string, decks: string[], cardsPerDeck: number): Promise<string> {
    const folder = await repositories.folders.create(name, 1000)
    for (const deckName of decks) {
      const deck = await repositories.decks.create(folder.id, deckName, 1000)
      for (let i = 0; i < cardsPerDeck; i += 1) {
        await repositories.cards.create(deck.id, { front: `f${i}`, back: `b${i}` }, 1000)
      }
    }
    return folder.id
  }

  describe('load', () => {
    it('populates the folders that are stored, alphabetically', async () => {
      await repositories.folders.create('Spanish', 1000)
      await repositories.folders.create('Anatomy', 1000)
      const store = useLibraryStore()

      await store.load()

      expect(store.folders.map((folder) => folder.name)).toEqual(['Anatomy', 'Spanish', 'Unsorted'])
    })

    it('counts the decks and cards of each folder', async () => {
      const folderId = await seedFolder('Spanish', ['Verbs', 'Nouns'], 3)
      const store = useLibraryStore()

      await store.load()

      expect(store.countsFor(folderId)).toEqual({ decks: 2, cards: 6 })
    })

    it('reports no decks and no cards for an empty folder', async () => {
      const store = useLibraryStore()

      await store.load()

      expect(store.countsFor(UNSORTED_FOLDER_ID)).toEqual({ decks: 0, cards: 0 })
    })

    it('clears the loading flag when it is done', async () => {
      const store = useLibraryStore()

      const loading = store.load()
      expect(store.loading).toBe(true)
      await loading

      expect(store.loading).toBe(false)
    })

    it('surfaces a rejected read as an error and leaves the folders empty', async () => {
      vi.spyOn(repositories.folders, 'list').mockRejectedValue(new Error('IndexedDB is gone.'))
      const store = useLibraryStore()

      await store.load()

      expect(store.error).toBe('IndexedDB is gone.')
      expect(store.folders).toEqual([])
      expect(store.loading).toBe(false)
    })
  })

  describe('createFolder', () => {
    it('appends the new folder to the list in name order', async () => {
      const store = useLibraryStore()
      await store.load()

      await store.createFolder('Spanish')

      expect(store.folders.map((folder) => folder.name)).toEqual(['Spanish', 'Unsorted'])
    })

    it('persists the folder so a reload still has it', async () => {
      const store = useLibraryStore()
      await store.load()

      await store.createFolder('Spanish')
      await store.load()

      expect(store.folders.map((folder) => folder.name)).toContain('Spanish')
    })

    it('timestamps the folder with the store clock', async () => {
      // Only Date is faked: fake-indexeddb's own event loop runs on real timers.
      vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
      const store = useLibraryStore()
      await store.load()

      await store.createFolder('Spanish')

      const created = store.folders.find((folder) => folder.name === 'Spanish')
      expect(created).toMatchObject({ createdAt: 1_700_000_000_000, updatedAt: 1_700_000_000_000 })
    })

    it('sets error and adds nothing when the name is blank', async () => {
      const store = useLibraryStore()
      await store.load()

      await store.createFolder('   ')

      expect(store.error).toBe('Name cannot be empty.')
      expect(store.folders).toHaveLength(1)
    })
  })

  describe('renameFolder', () => {
    it('updates the folder in place', async () => {
      const store = useLibraryStore()
      await store.load()
      const folder = await store.createFolder('Spanihs')

      await store.renameFolder(folder!.id, 'Spanish')

      expect(store.folders.map((entry) => entry.name)).toEqual(['Spanish', 'Unsorted'])
    })

    it('persists the new name', async () => {
      const store = useLibraryStore()
      await store.load()
      const folder = await store.createFolder('Spanihs')

      await store.renameFolder(folder!.id, 'Spanish')
      await store.load()

      expect(store.folders.map((entry) => entry.name)).toEqual(['Spanish', 'Unsorted'])
    })

    it('sets error and changes nothing when the folder is gone', async () => {
      const store = useLibraryStore()
      await store.load()

      await store.renameFolder('missing', 'Spanish')

      expect(store.error).toBe('That folder no longer exists.')
      expect(store.folders.map((entry) => entry.name)).toEqual(['Unsorted'])
    })
  })

  describe('removeFolder', () => {
    it('drops the folder and everything under it from the state', async () => {
      const folderId = await seedFolder('Spanish', ['Verbs'], 2)
      const store = useLibraryStore()
      await store.load()

      await store.removeFolder(folderId)

      expect(store.folders.map((folder) => folder.name)).toEqual(['Unsorted'])
      expect(store.decksIn(folderId)).toEqual([])
    })

    it('persists the deletion', async () => {
      const folderId = await seedFolder('Spanish', ['Verbs'], 2)
      const store = useLibraryStore()
      await store.load()

      await store.removeFolder(folderId)
      await store.load()

      expect(store.folders.map((folder) => folder.name)).toEqual(['Unsorted'])
    })

    it('refuses to delete Unsorted and leaves the state alone', async () => {
      const store = useLibraryStore()
      await store.load()

      await store.removeFolder(UNSORTED_FOLDER_ID)

      expect(store.error).toBe('The Unsorted folder cannot be deleted.')
      expect(store.folders.map((folder) => folder.name)).toEqual(['Unsorted'])
    })
  })

  describe('createDeck', () => {
    it('adds the deck to its folder, in name order', async () => {
      const folder = await repositories.folders.create('Spanish', 1000)
      const store = useLibraryStore()
      await store.load()

      await store.createDeck(folder.id, 'Verbs')
      await store.createDeck(folder.id, 'Nouns')

      expect(store.decksIn(folder.id).map((deck) => deck.name)).toEqual(['Nouns', 'Verbs'])
    })

    it('counts a new deck as empty', async () => {
      const folder = await repositories.folders.create('Spanish', 1000)
      const store = useLibraryStore()
      await store.load()

      const deck = await store.createDeck(folder.id, 'Verbs')

      expect(store.cardCount(deck!.id)).toBe(0)
      expect(store.countsFor(folder.id)).toEqual({ decks: 1, cards: 0 })
    })

    it('persists the deck so a reload still has it', async () => {
      const folder = await repositories.folders.create('Spanish', 1000)
      const store = useLibraryStore()
      await store.load()

      await store.createDeck(folder.id, 'Verbs')
      await store.load()

      expect(store.decksIn(folder.id).map((deck) => deck.name)).toEqual(['Verbs'])
    })

    it('sets error and adds nothing when the folder is gone', async () => {
      const store = useLibraryStore()
      await store.load()

      await store.createDeck('missing', 'Verbs')

      expect(store.error).toBe('That folder no longer exists.')
      expect(store.decks).toEqual([])
    })
  })

  describe('renameDeck', () => {
    it('updates the deck in place and persists it', async () => {
      const folderId = await seedFolder('Spanish', ['Verbz'], 0)
      const store = useLibraryStore()
      await store.load()
      const deck = store.decksIn(folderId)[0]

      await store.renameDeck(deck.id, 'Verbs')
      await store.load()

      expect(store.decksIn(folderId).map((entry) => entry.name)).toEqual(['Verbs'])
    })

    it('sets error and changes nothing when the deck is gone', async () => {
      const store = useLibraryStore()
      await store.load()

      await store.renameDeck('missing', 'Verbs')

      expect(store.error).toBe('That deck no longer exists.')
    })
  })

  describe('moveDeck', () => {
    it('takes the deck out of the old folder and into the new one', async () => {
      const from = await seedFolder('Spanish', ['Verbs'], 2)
      const to = await seedFolder('French', [], 0)
      const store = useLibraryStore()
      await store.load()
      const deck = store.decksIn(from)[0]

      await store.moveDeck(deck.id, to)

      expect(store.decksIn(from)).toEqual([])
      expect(store.decksIn(to).map((entry) => entry.name)).toEqual(['Verbs'])
    })

    it("moves the deck's cards to the new folder's counts", async () => {
      const from = await seedFolder('Spanish', ['Verbs'], 2)
      const to = await seedFolder('French', [], 0)
      const store = useLibraryStore()
      await store.load()

      await store.moveDeck(store.decksIn(from)[0].id, to)

      expect(store.countsFor(from)).toEqual({ decks: 0, cards: 0 })
      expect(store.countsFor(to)).toEqual({ decks: 1, cards: 2 })
    })

    it('persists the move', async () => {
      const from = await seedFolder('Spanish', ['Verbs'], 1)
      const to = await seedFolder('French', [], 0)
      const store = useLibraryStore()
      await store.load()

      await store.moveDeck(store.decksIn(from)[0].id, to)
      await store.load()

      expect(store.decksIn(to).map((entry) => entry.name)).toEqual(['Verbs'])
    })

    it('sets error and changes nothing when the target folder is gone', async () => {
      const from = await seedFolder('Spanish', ['Verbs'], 1)
      const store = useLibraryStore()
      await store.load()

      await store.moveDeck(store.decksIn(from)[0].id, 'missing')

      expect(store.error).toBe('That folder no longer exists.')
      expect(store.decksIn(from)).toHaveLength(1)
    })
  })

  describe('removeDeck', () => {
    it('drops the deck and its cards from the folder counts', async () => {
      const folderId = await seedFolder('Spanish', ['Verbs', 'Nouns'], 2)
      const store = useLibraryStore()
      await store.load()
      const deck = store.decksIn(folderId).find((entry) => entry.name === 'Verbs')!

      await store.removeDeck(deck.id)

      expect(store.decksIn(folderId).map((entry) => entry.name)).toEqual(['Nouns'])
      expect(store.countsFor(folderId)).toEqual({ decks: 1, cards: 2 })
    })

    it('persists the deletion', async () => {
      const folderId = await seedFolder('Spanish', ['Verbs'], 2)
      const store = useLibraryStore()
      await store.load()

      await store.removeDeck(store.decksIn(folderId)[0].id)
      await store.load()

      expect(store.decksIn(folderId)).toEqual([])
    })
  })

  describe('lookups', () => {
    it('finds a folder by id', async () => {
      const store = useLibraryStore()
      await store.load()

      expect(store.folder(UNSORTED_FOLDER_ID)?.name).toBe('Unsorted')
    })

    it('has no folder for an id that is not there', async () => {
      const store = useLibraryStore()
      await store.load()

      expect(store.folder('missing')).toBeUndefined()
    })

    it('finds a deck by id', async () => {
      const folderId = await seedFolder('Spanish', ['Verbs'], 0)
      const store = useLibraryStore()
      await store.load()

      expect(store.deck(store.decksIn(folderId)[0].id)?.name).toBe('Verbs')
    })
  })

  it('clears a previous error once an action succeeds', async () => {
    const store = useLibraryStore()
    await store.load()
    await store.createFolder('')
    expect(store.error).not.toBeNull()

    await store.createFolder('Spanish')

    expect(store.error).toBeNull()
  })
})
