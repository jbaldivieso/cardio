import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { seedDefaults, UNSORTED_FOLDER_ID } from '@/db'
import { serialise } from '@/domain/backup'
import { useInstallStore } from '@/stores/install'
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

  /** A desktop browser with no install affordance, unless a test says otherwise. */
  const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0'
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
  const MAC_SAFARI =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'

  /**
   * The browser's answer about durability, which §7.8 asks the screen to show,
   * beside the user agent the install hint reads (§12).
   */
  function stubStorage(persisted: boolean, userAgent = FIREFOX, maxTouchPoints = 0): void {
    vi.stubGlobal('navigator', {
      userAgent,
      maxTouchPoints,
      storage: { persisted: async () => persisted },
    })
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

  describe('the shape of the screen', () => {
    it('runs from what the app is down to what cannot be undone', async () => {
      // Storage sits immediately above Backup because it is the reason to make
      // one; that adjacency is what lets Backup carry no preamble of its own.
      stubStorage(false, IPHONE, 5)

      const wrapper = await mountView()

      expect(wrapper.findAll('h2').map((heading) => heading.text())).toEqual([
        'About',
        'Theme',
        'Storage',
        'Backup',
        'Install',
        'Danger zone',
      ])
    })
  })

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
    it('names the button for what it makes, not for the file format', async () => {
      const wrapper = await mountView()

      expect(wrapper.get('[data-testid="export-backup"]').text()).toBe('Create backup')
    })

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

      expect(wrapper.get('[data-testid="storage-status"]').text()).toContain(
        'may delete your cards',
      )
    })
  })

  describe('the app itself', () => {
    // The real sequence: the event fires moments after boot, and the screen is
    // opened long afterwards. Only a store built at boot is still listening.
    // The wording names no menu item: it differs between Chrome, Edge and
    // Samsung Internet, all of which fire the event (ADR-045).
    it('points at the browser once the browser offers to install it', async () => {
      useInstallStore()
      globalThis.dispatchEvent(new Event('beforeinstallprompt'))

      const wrapper = await mountView()

      expect(wrapper.get('[data-testid="install-hint"]').text()).toContain('address bar')
    })

    it('points an iPhone at Add to Home Screen', async () => {
      stubStorage(false, IPHONE, 5)

      const wrapper = await mountView()

      expect(wrapper.get('[data-testid="install-hint"]').text()).toContain('Add to Home Screen')
    })

    it('points macOS Safari at Add to Dock', async () => {
      stubStorage(false, MAC_SAFARI)

      const wrapper = await mountView()

      expect(wrapper.get('[data-testid="install-hint"]').text()).toContain('Add to Dock')
    })

    it('says nothing in a browser that cannot install it', async () => {
      const wrapper = await mountView()

      expect(wrapper.find('[data-testid="install-hint"]').exists()).toBe(false)
    })

    it('drops the install hint once it is installed', async () => {
      stubMatchMedia(['display-mode: standalone'])
      useInstallStore()
      globalThis.dispatchEvent(new Event('beforeinstallprompt'))

      const wrapper = await mountView()

      expect(wrapper.find('[data-testid="install-hint"]').exists()).toBe(false)
    })

    it('says in plain words how a card becomes mastered', async () => {
      const wrapper = await mountView()

      expect(wrapper.get('[data-testid="about-mastery"]').text()).toContain('mastered')
    })

    it('shows the version it is running', async () => {
      const wrapper = await mountView()

      expect(wrapper.get('[data-testid="app-version"]').text()).toContain(__APP_VERSION__)
    })
  })

  describe('the danger zone', () => {
    it('warns with an icon rather than with text a screen reader cannot see', async () => {
      const wrapper = await mountView()

      const heading = wrapper.get('#settings-danger')
      expect(heading.find('svg').exists()).toBe(true)
      // The icon carries no accessible name of its own. It is a second look at
      // a heading that already says everything, not a second thing to read.
      expect(heading.text()).toBe('Danger zone')
    })

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
