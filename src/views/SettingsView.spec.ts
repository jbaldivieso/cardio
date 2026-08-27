import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { seedDefaults, UNSORTED_FOLDER_ID } from '@/db'
import { serialise } from '@/domain/backup'
import { THEME_KEY } from '@/stores/theme'
import { repositories } from '@/stores/repositories'
import { useTestDatabase } from '@/test/repositories'
import SettingsView from '@/views/SettingsView.vue'

describe('SettingsView', () => {
  const test = useTestDatabase()

  /** A `matchMedia` that answers whichever queries the test says match. */
  function stubMatchMedia(matching: string[] = []): void {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: matching.some((entry) => query.includes(entry)),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
  }

  /** The browser's answer about durability, which §7.8 asks the screen to show. */
  function stubStorage(persisted: boolean): void {
    vi.stubGlobal('navigator', { storage: { persisted: async () => persisted } })
  }

  beforeEach(async () => {
    setActivePinia(createPinia())
    localStorage.clear()
    document.body.innerHTML = ''
    delete document.documentElement.dataset.theme
    stubMatchMedia()
    stubStorage(false)
    await seedDefaults(test.db, 1000)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:cardio')
    vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined)
  })

  const mounted: VueWrapper[] = []

  // Timers and mounted components are undone here rather than in the tests that
  // make them: a failing assertion would skip that line, and a leaked clock or a
  // dialog still listening on `document` turns one failure into a cascade.
  afterEach(() => {
    for (const wrapper of mounted) wrapper.unmount()
    mounted.length = 0
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  async function mountView(): Promise<VueWrapper> {
    const wrapper = mount(SettingsView, { attachTo: document.body })
    mounted.push(wrapper)
    await flushPromises()
    return wrapper
  }

  /** A backup file for a library that shares nothing with the stored one. */
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
            stats: { gets: 0, misses: 0, history: [], lastSeenAt: null },
          },
        ],
      },
      Date.UTC(2026, 7, 26),
    )
  }

  /**
   * Waits for a write to land on screen. IndexedDB resolves on its own schedule,
   * so flushing the microtask queue is not enough on its own.
   */
  async function shown(wrapper: VueWrapper, testid: string): Promise<void> {
    await vi.waitUntil(() => wrapper.find(`[data-testid="${testid}"]`).exists())
    await flushPromises()
  }

  /** Chooses a file in the import control, as the browser would. */
  async function chooseFile(wrapper: VueWrapper, contents: string): Promise<void> {
    const input = wrapper.get('[data-testid="import-file"]')
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File([contents], 'cardio-backup.json', { type: 'application/json' })],
    })
    await input.trigger('change')
    await flushPromises()
  }

  describe('theme', () => {
    it('opens on the theme in use', async () => {
      localStorage.setItem(THEME_KEY, 'dark')

      const wrapper = await mountView()

      expect(wrapper.get('[data-testid="theme-dark"]').attributes('aria-pressed')).toBe('true')
      expect(wrapper.get('[data-testid="theme-system"]').attributes('aria-pressed')).toBe('false')
    })

    it('applies a chosen theme to the page at once', async () => {
      const wrapper = await mountView()

      await wrapper.get('[data-testid="theme-dark"]').trigger('click')

      expect(document.documentElement.dataset.theme).toBe('dark')
    })

    it('remembers the chosen theme for the next visit', async () => {
      const wrapper = await mountView()

      await wrapper.get('[data-testid="theme-light"]').trigger('click')

      expect(localStorage.getItem(THEME_KEY)).toBe('light')
    })
  })

  describe('export', () => {
    it('downloads a dated backup file (§10)', async () => {
      const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue(undefined)
      vi.setSystemTime(new Date(2026, 7, 26, 9, 0))
      const wrapper = await mountView()

      await wrapper.get('[data-testid="export-backup"]').trigger('click')
      await vi.waitUntil(() => clicked.mock.instances.length > 0)

      const anchor = clicked.mock.instances[0] as HTMLAnchorElement
      expect(anchor.download).toBe('cardio-backup-2026-08-26.json')
    })

    it('surfaces a failed export instead of leaving the screen looking done', async () => {
      vi.spyOn(repositories.library, 'snapshot').mockRejectedValue(new Error('IndexedDB is gone.'))
      const wrapper = await mountView()

      await wrapper.get('[data-testid="export-backup"]').trigger('click')
      await shown(wrapper, 'backup-error')

      expect(wrapper.get('[data-testid="backup-error"]').text()).toContain('IndexedDB is gone.')
    })
  })

  describe('import', () => {
    it('says what a chosen file holds before importing any of it', async () => {
      const wrapper = await mountView()

      await chooseFile(wrapper, otherLibrary())

      const preview = wrapper.get('[data-testid="import-preview"]').text()
      expect(preview).toContain('1 folder')
      expect(preview).toContain('1 deck')
      expect(preview).toContain('1 card')
    })

    it('names the file that was chosen', async () => {
      const wrapper = await mountView()

      await chooseFile(wrapper, otherLibrary())

      expect(wrapper.get('[data-testid="import-filename"]').text()).toBe('cardio-backup.json')
    })

    it('merges the file and reports both counts', async () => {
      const wrapper = await mountView()
      await chooseFile(wrapper, otherLibrary())

      await wrapper.get('[data-testid="import-merge"]').trigger('click')
      await shown(wrapper, 'import-report')

      expect(wrapper.get('[data-testid="import-report"]').text()).toContain('3 added')
      expect(await test.db.cards.get('other-card')).toBeDefined()
    })

    it('lists why a file was refused, and offers no way to load it', async () => {
      const wrapper = await mountView()

      await chooseFile(wrapper, JSON.stringify({ app: 'flashy' }))

      expect(wrapper.get('[data-testid="import-errors"]').text()).toContain('not a Cardio backup')
      expect(wrapper.find('[data-testid="import-merge"]').exists()).toBe(false)
    })

    it('says what it had to repair to load the file (§10)', async () => {
      const wrapper = await mountView()
      const orphaned = serialise(
        {
          folders: [],
          decks: [{ id: 'd', folderId: 'gone', name: 'Loose', createdAt: 1, updatedAt: 1 }],
          cards: [],
        },
        0,
      )

      await chooseFile(wrapper, orphaned)

      expect(wrapper.get('[data-testid="import-repairs"]').text()).toContain('Unsorted')
    })

    it('forgets the file once it has been imported', async () => {
      const wrapper = await mountView()
      await chooseFile(wrapper, otherLibrary())

      await wrapper.get('[data-testid="import-merge"]').trigger('click')
      await shown(wrapper, 'import-report')

      expect(wrapper.get('[data-testid="import-filename"]').text()).toBe('No file chosen')
    })

    it('does not offer to load a file chosen on an earlier visit', async () => {
      const first = await mountView()
      await chooseFile(first, otherLibrary())
      first.unmount()

      const second = await mountView()

      expect(second.find('[data-testid="import-preview"]').exists()).toBe(false)
      expect(second.get('[data-testid="import-filename"]').text()).toBe('No file chosen')
    })

    it('says so when the browser cannot read the file that was chosen', async () => {
      const wrapper = await mountView()
      const input = wrapper.get('[data-testid="import-file"]')
      Object.defineProperty(input.element, 'files', {
        configurable: true,
        value: [{ name: 'gone.json', text: () => Promise.reject(new Error('NotReadableError')) }],
      })

      await input.trigger('change')
      await flushPromises()

      expect(wrapper.get('[data-testid="import-errors"]').text()).toContain('could not be read')
    })

    it('holds a replace behind a typed confirmation', async () => {
      const folder = await repositories.folders.create('Spanish', 1000)
      const wrapper = await mountView()
      await chooseFile(wrapper, otherLibrary())

      await wrapper.get('[data-testid="import-replace"]').trigger('click')

      expect(wrapper.find('[data-testid="typed-confirm-dialog"]').exists()).toBe(true)
      expect(await test.db.folders.get(folder.id)).toBeDefined()
    })

    it('replaces everything once the confirmation is typed', async () => {
      const folder = await repositories.folders.create('Spanish', 1000)
      const wrapper = await mountView()
      await chooseFile(wrapper, otherLibrary())
      await wrapper.get('[data-testid="import-replace"]').trigger('click')

      await wrapper.get('[data-testid="typed-confirm-input"]').setValue('REPLACE')
      await wrapper.get('[data-testid="typed-confirm-accept"]').trigger('click')
      await shown(wrapper, 'import-report')

      expect(await test.db.folders.get(folder.id)).toBeUndefined()
      expect(await test.db.cards.get('other-card')).toBeDefined()
    })

    it('leaves the library alone when the confirmation is cancelled', async () => {
      const folder = await repositories.folders.create('Spanish', 1000)
      const wrapper = await mountView()
      await chooseFile(wrapper, otherLibrary())
      await wrapper.get('[data-testid="import-replace"]').trigger('click')

      await wrapper.get('[data-testid="typed-confirm-cancel"]').trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-testid="typed-confirm-dialog"]').exists()).toBe(false)
      expect(await test.db.folders.get(folder.id)).toBeDefined()
    })
  })

  describe('storage durability (§4.5)', () => {
    it('says so when the browser has promised to keep the data', async () => {
      stubStorage(true)

      const wrapper = await mountView()

      expect(wrapper.get('[data-testid="storage-status"]').text()).toContain('persistent')
    })

    it('warns that the data can be evicted when it has not', async () => {
      const wrapper = await mountView()

      expect(wrapper.get('[data-testid="storage-status"]').text()).toContain('may be cleared')
    })
  })

  describe('the app itself', () => {
    it('shows how to install it when it is running in a browser tab', async () => {
      const wrapper = await mountView()

      expect(wrapper.get('[data-testid="install-hint"]').text()).toContain('Home Screen')
    })

    it('drops the install hint once it is installed', async () => {
      stubMatchMedia(['display-mode: standalone'])

      const wrapper = await mountView()

      expect(wrapper.find('[data-testid="install-hint"]').exists()).toBe(false)
    })

    it('shows the version it is running', async () => {
      const wrapper = await mountView()

      expect(wrapper.get('[data-testid="app-version"]').text()).toContain(__APP_VERSION__)
    })
  })

  describe('the danger zone', () => {
    it('holds the delete behind a typed confirmation', async () => {
      const folder = await repositories.folders.create('Spanish', 1000)
      const wrapper = await mountView()

      await wrapper.get('[data-testid="delete-all"]').trigger('click')

      expect(wrapper.find('[data-testid="typed-confirm-dialog"]').exists()).toBe(true)
      expect(await test.db.folders.get(folder.id)).toBeDefined()
    })

    it('quotes no counts when the library could not be read', async () => {
      vi.spyOn(repositories.folders, 'list').mockRejectedValue(new Error('IndexedDB is gone.'))

      const wrapper = await mountView()

      // Never "0 folders, 0 decks and 0 cards": that promises the user there is
      // nothing to lose, right beside the button that deletes everything.
      expect(wrapper.get('[data-testid="danger-summary"]').text()).toBe(
        'Everything you have is stored in this browser. There is no undo and no trash.',
      )
      expect(wrapper.get('[data-testid="backup-error"]').text()).toContain('IndexedDB is gone.')
    })

    it('names what will go when the library has been read', async () => {
      await repositories.folders.create('Spanish', 1000)

      const wrapper = await mountView()

      expect(wrapper.get('[data-testid="danger-summary"]').text()).toContain('2 folders')
    })

    it('leaves a usable empty app once the confirmation is typed', async () => {
      await repositories.folders.create('Spanish', 1000)
      const wrapper = await mountView()
      await wrapper.get('[data-testid="delete-all"]').trigger('click')

      await wrapper.get('[data-testid="typed-confirm-input"]').setValue('DELETE')
      await wrapper.get('[data-testid="typed-confirm-accept"]').trigger('click')
      await shown(wrapper, 'delete-report')

      expect((await test.db.folders.toArray()).map((folder) => folder.id)).toEqual([
        UNSORTED_FOLDER_ID,
      ])
      expect(wrapper.get('[data-testid="delete-report"]').text()).toContain('deleted')
    })
  })
})
