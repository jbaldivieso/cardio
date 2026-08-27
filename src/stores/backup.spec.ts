import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { seedDefaults, UNSORTED_FOLDER_ID } from '@/db'
import { serialise } from '@/domain/backup'
import type { LibraryData } from '@/domain/backup'
import { useBackupStore } from '@/stores/backup'
import { useLibraryStore } from '@/stores/library'
import { useMasteryStore } from '@/stores/mastery'
import { repositories } from '@/stores/repositories'
import { useTestDatabase } from '@/test/repositories'

describe('backup store', () => {
  const test = useTestDatabase()

  beforeEach(async () => {
    setActivePinia(createPinia())
    await seedDefaults(test.db, 1000)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:cardio')
    vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined)
  })

  /** A folder holding one deck of one card, and the ids of all three. */
  async function seedLibrary(): Promise<LibraryData> {
    const folder = await repositories.folders.create('Spanish', 1000)
    const deck = await repositories.decks.create(folder.id, 'Verbs', 1000)
    await repositories.cards.create(deck.id, { front: 'hablar', back: 'to speak' }, 1000)
    return repositories.library.snapshot()
  }

  /** A backup document for a library that shares nothing with the stored one. */
  function otherLibrary(): string {
    return serialise(
      {
        folders: [{ id: 'other-folder', name: 'German', createdAt: 1, updatedAt: 1 }],
        decks: [
          { id: 'other-deck', folderId: 'other-folder', name: 'Nouns', createdAt: 1, updatedAt: 1 },
        ],
        cards: [
          {
            id: 'other-card',
            deckId: 'other-deck',
            front: 'der Hund',
            back: 'the dog',
            createdAt: 1,
            updatedAt: 1,
            stats: { gets: 2, misses: 1, history: [{ at: 5, got: true }], lastSeenAt: 5 },
          },
        ],
      },
      Date.UTC(2026, 7, 26),
    )
  }

  describe('export', () => {
    it('writes a file that reads back as the whole library', async () => {
      const stored = await seedLibrary()
      const store = useBackupStore()

      const file = await store.exportBackup()

      expect(JSON.parse(file?.json ?? '{}')).toMatchObject({ app: 'cardio', schemaVersion: 1 })
      expect(JSON.parse(file?.json ?? '{}').cards).toEqual(stored.cards)
    })

    it('names the file for the day it was taken (§10)', async () => {
      vi.setSystemTime(new Date(2026, 7, 26, 9, 15))
      const store = useBackupStore()

      const file = await store.exportBackup()

      expect(file?.filename).toBe('cardio-backup-2026-08-26.json')
      vi.useRealTimers()
    })

    it('includes the statistics a quiz has recorded (§10)', async () => {
      const stored = await seedLibrary()
      await repositories.cards.recordAttempt(stored.cards[0].id, true, 2000)
      const store = useBackupStore()

      const file = await store.exportBackup()

      expect(JSON.parse(file?.json ?? '{}').cards[0].stats.gets).toBe(1)
    })

    it('hands the file to the browser to download', async () => {
      const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue(undefined)
      const store = useBackupStore()

      const file = await store.exportBackup()

      expect(clicked).toHaveBeenCalledTimes(1)
      const anchor = clicked.mock.instances[0] as HTMLAnchorElement
      expect(anchor.download).toBe(file?.filename)
    })

    it('leaves no anchor behind in the document', async () => {
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue(undefined)
      const store = useBackupStore()

      await store.exportBackup()

      expect(document.querySelectorAll('a')).toHaveLength(0)
    })
  })

  describe('inspecting a file', () => {
    it('accepts a backup and says what is in it', async () => {
      const store = useBackupStore()

      store.inspect(otherLibrary())

      expect(store.errors).toEqual([])
      expect(store.pending?.counts).toEqual({ folders: 1, decks: 1, cards: 1 })
    })

    it('reports the repairs it had to make (§10)', () => {
      const store = useBackupStore()
      const orphaned = serialise(
        {
          folders: [],
          decks: [{ id: 'd', folderId: 'gone', name: 'Loose', createdAt: 1, updatedAt: 1 }],
          cards: [],
        },
        0,
      )

      store.inspect(orphaned)

      expect(store.pending?.repairs).toEqual({ rehomedDecks: 1, rejectedCards: 0 })
    })

    it('refuses a file that is not a Cardio backup, with a reason', () => {
      const store = useBackupStore()

      store.inspect(JSON.stringify({ app: 'flashy', schemaVersion: 1 }))

      expect(store.pending).toBeNull()
      expect(store.errors).toEqual(['That file is not a Cardio backup.'])
    })

    it('writes nothing at all when the file is refused', async () => {
      const store = useBackupStore()

      store.inspect('nonsense')
      await store.merge()

      expect(await test.db.decks.count()).toBe(0)
      expect(await test.db.cards.count()).toBe(0)
    })

    it('forgets a refused file once another is chosen', () => {
      const store = useBackupStore()
      store.inspect('nonsense')

      store.inspect(otherLibrary())

      expect(store.errors).toEqual([])
      expect(store.pending).not.toBeNull()
    })
  })

  describe('merge', () => {
    it('adds the rows the library does not have', async () => {
      const store = useBackupStore()
      store.inspect(otherLibrary())

      const report = await store.merge()

      expect(report).toMatchObject({ mode: 'merge', added: 3, skipped: 0 })
      expect(await test.db.cards.get('other-card')).toBeDefined()
    })

    it('skips the rows it already has, and keeps their content', async () => {
      const stored = await seedLibrary()
      const store = useBackupStore()
      store.inspect(serialise(stored, 0))

      const report = await store.merge()

      // Four rows: the seeded folder, deck and card, plus Unsorted.
      expect(report).toMatchObject({ added: 0, skipped: 4 })
      expect((await test.db.cards.get(stored.cards[0].id))?.front).toBe('hablar')
    })

    it('leaves the library that was there alone', async () => {
      const stored = await seedLibrary()
      const store = useBackupStore()
      store.inspect(otherLibrary())

      await store.merge()

      expect(await test.db.decks.get(stored.decks[0].id)).toBeDefined()
    })

    it('refreshes the folder list a screen is showing', async () => {
      const library = useLibraryStore()
      await library.load()
      const store = useBackupStore()
      store.inspect(otherLibrary())

      await store.merge()

      expect(library.folders.map((folder) => folder.name)).toContain('German')
    })

    it('drops the mastery summaries the screens were showing', async () => {
      const stored = await seedLibrary()
      const mastery = useMasteryStore()
      await mastery.ensure([stored.decks[0].id])
      const store = useBackupStore()
      store.inspect(otherLibrary())

      await store.merge()

      expect(mastery.deckSummary(stored.decks[0].id)).toBeUndefined()
    })

    it('does nothing without a file to import', async () => {
      const store = useBackupStore()

      await expect(store.merge()).resolves.toBeUndefined()
    })
  })

  describe('replace', () => {
    it('drops everything that was there and loads the file', async () => {
      const stored = await seedLibrary()
      const store = useBackupStore()
      store.inspect(otherLibrary())

      const report = await store.replace()

      expect(report).toMatchObject({ mode: 'replace', added: 3, skipped: 0 })
      expect(await test.db.decks.get(stored.decks[0].id)).toBeUndefined()
      expect(await test.db.cards.get('other-card')).toBeDefined()
    })

    it('leaves the Unsorted folder in place (§4.2)', async () => {
      const store = useBackupStore()
      store.inspect(otherLibrary())

      await store.replace()

      expect(await test.db.folders.get(UNSORTED_FOLDER_ID)).toBeDefined()
    })

    it('drops the mastery summaries the screens were showing', async () => {
      const stored = await seedLibrary()
      const mastery = useMasteryStore()
      await mastery.ensure([stored.decks[0].id])
      const store = useBackupStore()
      store.inspect(otherLibrary())

      await store.replace()

      expect(mastery.deckSummary(stored.decks[0].id)).toBeUndefined()
    })

    it('does nothing without a file to import', async () => {
      const store = useBackupStore()

      await expect(store.replace()).resolves.toBeUndefined()
    })
  })

  describe('deleting everything', () => {
    it('empties the library', async () => {
      await seedLibrary()
      const store = useBackupStore()

      await store.deleteEverything()

      expect(await test.db.decks.count()).toBe(0)
      expect(await test.db.cards.count()).toBe(0)
    })

    it('leaves a usable app behind, with Unsorted in it', async () => {
      await seedLibrary()
      const library = useLibraryStore()
      const store = useBackupStore()

      await store.deleteEverything()

      expect((await test.db.folders.toArray()).map((folder) => folder.id)).toEqual([
        UNSORTED_FOLDER_ID,
      ])
      expect(library.folders.map((folder) => folder.id)).toEqual([UNSORTED_FOLDER_ID])
    })

    it('drops the mastery summaries the screens were showing', async () => {
      const stored = await seedLibrary()
      const mastery = useMasteryStore()
      await mastery.ensure([stored.decks[0].id])
      const store = useBackupStore()

      await store.deleteEverything()

      expect(mastery.deckSummary(stored.decks[0].id)).toBeUndefined()
    })

    it('reports that it did it', async () => {
      const store = useBackupStore()

      await expect(store.deleteEverything()).resolves.toBe(true)
    })
  })

  describe('when the database refuses', () => {
    it('surfaces the failure instead of reporting an import', async () => {
      const store = useBackupStore()
      store.inspect(otherLibrary())
      vi.spyOn(repositories.library, 'mergeAll').mockRejectedValue(new Error('quota exceeded'))

      const report = await store.merge()

      expect(report).toBeUndefined()
      expect(store.error).toBe('quota exceeded')
    })
  })
})
