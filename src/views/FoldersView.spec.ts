import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Router } from 'vue-router'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { routes } from '@/router'
import { useLibraryStore } from '@/stores/library'
import { useQuizStore } from '@/stores/quiz'
import { repositories } from '@/stores/repositories'
import { useTestDatabase } from '@/test/repositories'
import FoldersView from '@/views/FoldersView.vue'

describe('FoldersView', () => {
  const test = useTestDatabase()
  /** The screen pushes routes of its own, so a test can read where it went. */
  let router: Router

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  async function mountView(): Promise<VueWrapper> {
    const store = useLibraryStore()
    // The screen navigates when a quiz starts and when a folder is created, so
    // it needs a real router even though its links are stubbed.
    router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(FoldersView, {
      global: { plugins: [router], stubs: { RouterLink: RouterLinkStub } },
      attachTo: document.body,
    })
    // The first read opens the database, which fake-indexeddb resolves over
    // several turns of the event loop rather than in microtasks alone.
    await vi.waitUntil(() => !store.loading)
    await flushPromises()
    return wrapper
  }

  function rows(wrapper: VueWrapper) {
    return wrapper.findAll('[data-testid="folder-row"]')
  }

  /** Rename and delete live behind a row's overflow menu (§7.1). */
  async function openRowMenu(wrapper: VueWrapper, index = 0): Promise<void> {
    await rows(wrapper)[index].get('[data-testid="folder-menu"]').trigger('click')
  }

  /** A library someone has started, so the screen lists it instead of the splash. */
  async function seedStartedLibrary(): Promise<string> {
    const folder = await repositories.folders.create('German', 1000)
    await repositories.decks.create(folder.id, 'Verbs', 1000)
    return folder.id
  }

  it('renders one row per folder, with its deck and card counts', async () => {
    await repositories.folders.create('Zoology', 1000)
    const folder = await repositories.folders.create('Spanish', 1000)
    const deck = await repositories.decks.create(folder.id, 'Verbs', 1000)
    await repositories.cards.create(deck.id, { front: 'ser', back: 'to be' }, 1000)

    const wrapper = await mountView()

    expect(rows(wrapper)).toHaveLength(2)
    expect(rows(wrapper)[0].text()).toContain('Spanish')
    expect(rows(wrapper)[0].text()).toContain('1 deck')
    expect(rows(wrapper)[0].text()).toContain('1 card')
  })

  it('links each row to its folder', async () => {
    const folderId = await seedStartedLibrary()

    const wrapper = await mountView()

    expect(rows(wrapper)[0].getComponent(RouterLinkStub).props('to')).toEqual({
      name: 'folder',
      params: { folderId },
    })
  })

  it('shows how much of each folder is mastered', async () => {
    const folder = await repositories.folders.create('Spanish', 1000)
    const deck = await repositories.decks.create(folder.id, 'Verbs', 1000)
    const card = await repositories.cards.create(deck.id, { front: 'ser', back: 'to be' }, 1000)
    await repositories.cards.create(deck.id, { front: 'ir', back: 'to go' }, 1000)
    // Five clean gets today: spec §5.4's mastery 100, so one of the two cards.
    for (let i = 0; i < 5; i += 1) {
      await repositories.cards.recordAttempt(card.id, true, Date.now())
    }

    const wrapper = await mountView()
    // The bar arrives one read after the row it sits in.
    await vi.waitUntil(() => rows(wrapper)[0].text().includes('mastered'))

    expect(rows(wrapper)[0].get('[data-testid="mastery-headline"]').text()).toBe('50% mastered')
  })

  it('says a folder holding no cards has none, rather than 0%', async () => {
    await seedStartedLibrary()

    const wrapper = await mountView()

    expect(rows(wrapper)[0].get('[data-testid="mastery-bar"]').text()).toBe('No cards yet')
  })

  describe('the empty library', () => {
    it('greets a first-time visitor with the splash instead of a list of nothing', async () => {
      const wrapper = await mountView()

      expect(rows(wrapper)).toHaveLength(0)
      expect(wrapper.get('[data-testid="library-splash"]').text()).toContain('Cardio')
    })

    it('keeps the header out of the way while the splash is up', async () => {
      const wrapper = await mountView()

      expect(wrapper.find('[data-testid="new-folder"]').exists()).toBe(false)
    })

    it('opens the new-folder dialog from the splash', async () => {
      const wrapper = await mountView()

      await wrapper.get('[data-testid="splash-create"]').trigger('click')
      await wrapper.get('[data-testid="name-input"]').setValue('Spanish')
      await wrapper.get('[data-testid="name-save"]').trigger('click')

      await vi.waitFor(() => expect(rows(wrapper)[0].text()).toContain('Spanish'))
      expect(wrapper.find('[data-testid="library-splash"]').exists()).toBe(false)
    })

    it('lists the library instead once it holds a folder', async () => {
      await seedStartedLibrary()

      const wrapper = await mountView()

      expect(wrapper.find('[data-testid="library-splash"]').exists()).toBe(false)
      expect(rows(wrapper)).toHaveLength(1)
    })

    it('still explains a failed read, behind the splash', async () => {
      vi.spyOn(repositories.folders, 'list').mockRejectedValue(new Error('IndexedDB is gone.'))

      const wrapper = await mountView()

      expect(wrapper.get('[data-testid="library-error"]').text()).toContain('IndexedDB is gone.')
      expect(wrapper.find('[data-testid="library-splash"]').exists()).toBe(true)
    })
  })

  // Libraries created before folders became user-only carry a seeded folder with
  // the reserved id "unsorted"; it is an ordinary folder now, delete included.
  it('offers rename and delete on every folder, the retired Unsorted included', async () => {
    await test.db.folders.add({ id: 'unsorted', name: 'Unsorted', createdAt: 1, updatedAt: 1 })

    const wrapper = await mountView()
    await openRowMenu(wrapper)

    expect(rows(wrapper)[0].find('[data-testid="folder-rename"]').exists()).toBe(true)
    expect(rows(wrapper)[0].find('[data-testid="folder-delete"]').exists()).toBe(true)
  })

  it('keeps rename and delete behind the row menu, leaving Quiz on the row', async () => {
    const folder = await repositories.folders.create('German', 1000)
    const deck = await repositories.decks.create(folder.id, 'Verbs', 1000)
    // Quiz is only on the row when there is something to quiz (ADR-054).
    await repositories.cards.create(deck.id, { front: 'sein', back: 'to be' }, 1000)

    const wrapper = await mountView()

    expect(rows(wrapper)[0].get('[data-testid="folder-quiz"]').isVisible()).toBe(true)
    expect(rows(wrapper)[0].find('[data-testid="folder-rename"]').exists()).toBe(false)
    expect(rows(wrapper)[0].find('[data-testid="folder-delete"]').exists()).toBe(false)

    await openRowMenu(wrapper)

    expect(rows(wrapper)[0].get('[data-testid="folder-rename"]').isVisible()).toBe(true)
    expect(rows(wrapper)[0].get('[data-testid="folder-delete"]').isVisible()).toBe(true)
  })

  it('adds a folder through the new-folder dialog', async () => {
    await seedStartedLibrary()
    const wrapper = await mountView()

    await wrapper.get('[data-testid="new-folder"]').trigger('click')
    await wrapper.get('[data-testid="name-input"]').setValue('Anatomy')
    await wrapper.get('[data-testid="name-save"]').trigger('click')

    await vi.waitFor(() => expect(rows(wrapper)[0].text()).toContain('Anatomy'))
    expect(wrapper.find('[data-testid="name-dialog"]').exists()).toBe(false)
  })

  it('opens the folder it just created', async () => {
    await seedStartedLibrary()
    const wrapper = await mountView()

    await wrapper.get('[data-testid="new-folder"]').trigger('click')
    await wrapper.get('[data-testid="name-input"]').setValue('Anatomy')
    await wrapper.get('[data-testid="name-save"]').trigger('click')

    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('folder'))
    const created = useLibraryStore().folders.find((folder) => folder.name === 'Anatomy')
    expect(router.currentRoute.value.params.folderId).toBe(created?.id)
  })

  it('stays on the list after renaming a folder', async () => {
    await repositories.folders.create('Spanihs', 1000)
    const wrapper = await mountView()

    await openRowMenu(wrapper)
    await rows(wrapper)[0].get('[data-testid="folder-rename"]').trigger('click')
    await wrapper.get('[data-testid="name-input"]').setValue('Spanish')
    await wrapper.get('[data-testid="name-save"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('keeps the name dialog open, with the reason, when the write fails', async () => {
    await seedStartedLibrary()
    const wrapper = await mountView()
    vi.spyOn(repositories.folders, 'create').mockRejectedValueOnce(
      new Error('Name cannot be empty.'),
    )

    await wrapper.get('[data-testid="new-folder"]').trigger('click')
    await wrapper.get('[data-testid="name-input"]').setValue('Spanish')
    await wrapper.get('[data-testid="name-save"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="name-dialog"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="name-error"]').text()).toBe('Name cannot be empty.')
  })

  it('renames a folder through the rename dialog', async () => {
    await repositories.folders.create('Spanihs', 1000)
    const wrapper = await mountView()

    await openRowMenu(wrapper)
    await rows(wrapper)[0].get('[data-testid="folder-rename"]').trigger('click')
    await wrapper.get('[data-testid="name-input"]').setValue('Spanish')
    await wrapper.get('[data-testid="name-save"]').trigger('click')

    await vi.waitFor(() => expect(rows(wrapper)[0].text()).toContain('Spanish'))
  })

  it('names the deck and card counts before deleting a folder', async () => {
    const folder = await repositories.folders.create('Spanish', 1000)
    const deck = await repositories.decks.create(folder.id, 'Verbs', 1000)
    await repositories.cards.create(deck.id, { front: 'ser', back: 'to be' }, 1000)
    const wrapper = await mountView()

    await openRowMenu(wrapper)
    await rows(wrapper)[0].get('[data-testid="folder-delete"]').trigger('click')

    expect(wrapper.get('[data-testid="confirm-message"]').text()).toBe(
      'Delete “Spanish”? This removes 1 deck and 1 card. This cannot be undone.',
    )
  })

  it('deletes the folder once the confirmation is accepted', async () => {
    await repositories.folders.create('Spanish', 1000)
    const wrapper = await mountView()

    await openRowMenu(wrapper)
    await rows(wrapper)[0].get('[data-testid="folder-delete"]').trigger('click')
    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')

    await vi.waitFor(() => expect(rows(wrapper)).toHaveLength(0))
  })

  it('keeps the folder when the confirmation is dismissed', async () => {
    await repositories.folders.create('Spanish', 1000)
    const wrapper = await mountView()

    await openRowMenu(wrapper)
    await rows(wrapper)[0].get('[data-testid="folder-delete"]').trigger('click')
    await wrapper.get('[data-testid="confirm-cancel"]').trigger('click')
    await flushPromises()

    expect(rows(wrapper)).toHaveLength(1)
    expect(wrapper.find('[data-testid="confirm-dialog"]').exists()).toBe(false)
  })

  it('shows the store error when the library cannot be read', async () => {
    vi.spyOn(repositories.folders, 'list').mockRejectedValue(new Error('IndexedDB is gone.'))

    const wrapper = await mountView()

    expect(wrapper.get('[data-testid="library-error"]').text()).toContain('IndexedDB is gone.')
  })

  describe('starting a quiz', () => {
    it('pools every deck in the folder', async () => {
      const folder = await repositories.folders.create('Spanish', 1000)
      const other = await repositories.folders.create('German', 1000)
      const verbs = await repositories.decks.create(folder.id, 'Verbs', 1000)
      const nouns = await repositories.decks.create(folder.id, 'Nouns', 1000)
      const elsewhere = await repositories.decks.create(other.id, 'Other', 1000)
      await repositories.cards.create(verbs.id, { front: 'ser', back: 'to be' }, 1000)
      await repositories.cards.create(nouns.id, { front: 'casa', back: 'house' }, 1000)
      await repositories.cards.create(elsewhere.id, { front: 'nein', back: 'no' }, 1000)
      const wrapper = await mountView()
      const quiz = useQuizStore()

      const spanish = rows(wrapper).find((row) => row.text().includes('Spanish'))
      await spanish?.get('[data-testid="folder-quiz"]').trigger('click')
      await vi.waitUntil(() => quiz.phase === 'running')

      expect(quiz.cards.map((card) => card.deckId).sort()).toEqual([nouns.id, verbs.id].sort())
      expect(quiz.direction).toBe('front')
    })

    it('offers no quickstart on a folder with no cards in it', async () => {
      await repositories.folders.create('Spanish', 1000)
      const wrapper = await mountView()

      const spanish = rows(wrapper).find((row) => row.text().includes('Spanish'))
      expect(spanish?.find('[data-testid="folder-quiz"]').exists()).toBe(false)
    })
  })
})
