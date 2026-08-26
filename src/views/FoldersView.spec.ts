import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { seedDefaults, UNSORTED_FOLDER_ID } from '@/db'
import { useLibraryStore } from '@/stores/library'
import { repositories } from '@/stores/repositories'
import { useTestDatabase } from '@/test/repositories'
import FoldersView from '@/views/FoldersView.vue'

describe('FoldersView', () => {
  const test = useTestDatabase()

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  async function mountView(): Promise<VueWrapper> {
    const store = useLibraryStore()
    const wrapper = mount(FoldersView, {
      global: { stubs: { RouterLink: RouterLinkStub } },
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

  it('renders one row per folder, with its deck and card counts', async () => {
    await seedDefaults(test.db, 1000)
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
    await seedDefaults(test.db, 1000)

    const wrapper = await mountView()

    expect(rows(wrapper)[0].getComponent(RouterLinkStub).props('to')).toEqual({
      name: 'folder',
      params: { folderId: UNSORTED_FOLDER_ID },
    })
  })

  it('invites a first folder when there are none', async () => {
    const wrapper = await mountView()

    expect(rows(wrapper)).toHaveLength(0)
    expect(wrapper.get('[data-testid="folders-empty"]').text()).toContain('folder')
  })

  it('offers rename but not delete on the Unsorted folder', async () => {
    await seedDefaults(test.db, 1000)

    const wrapper = await mountView()

    expect(rows(wrapper)[0].find('[data-testid="folder-rename"]').exists()).toBe(true)
    expect(rows(wrapper)[0].find('[data-testid="folder-delete"]').exists()).toBe(false)
  })

  it('offers delete on any other folder', async () => {
    await repositories.folders.create('Spanish', 1000)

    const wrapper = await mountView()

    expect(rows(wrapper)[0].find('[data-testid="folder-delete"]').exists()).toBe(true)
  })

  it('adds a folder through the new-folder dialog', async () => {
    const wrapper = await mountView()

    await wrapper.get('[data-testid="new-folder"]').trigger('click')
    await wrapper.get('[data-testid="name-input"]').setValue('Spanish')
    await wrapper.get('[data-testid="name-save"]').trigger('click')

    await vi.waitFor(() => expect(rows(wrapper)[0].text()).toContain('Spanish'))
    expect(wrapper.find('[data-testid="name-dialog"]').exists()).toBe(false)
  })

  it('renames a folder through the rename dialog', async () => {
    await repositories.folders.create('Spanihs', 1000)
    const wrapper = await mountView()

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

    await rows(wrapper)[0].get('[data-testid="folder-delete"]').trigger('click')

    expect(wrapper.get('[data-testid="confirm-message"]').text()).toBe(
      'Delete “Spanish”? This removes 1 deck and 1 card. This cannot be undone.',
    )
  })

  it('deletes the folder once the confirmation is accepted', async () => {
    await repositories.folders.create('Spanish', 1000)
    const wrapper = await mountView()

    await rows(wrapper)[0].get('[data-testid="folder-delete"]').trigger('click')
    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')

    await vi.waitFor(() => expect(rows(wrapper)).toHaveLength(0))
  })

  it('keeps the folder when the confirmation is dismissed', async () => {
    await repositories.folders.create('Spanish', 1000)
    const wrapper = await mountView()

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
})
