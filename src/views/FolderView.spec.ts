import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { seedDefaults, UNSORTED_FOLDER_ID } from '@/db'
import { useLibraryStore } from '@/stores/library'
import { repositories } from '@/stores/repositories'
import { useTestDatabase } from '@/test/repositories'
import FolderView from '@/views/FolderView.vue'

describe('FolderView', () => {
  const test = useTestDatabase()

  beforeEach(async () => {
    setActivePinia(createPinia())
    await seedDefaults(test.db, 1000)
  })

  async function mountView(folderId: string): Promise<VueWrapper> {
    const store = useLibraryStore()
    const wrapper = mount(FolderView, {
      props: { folderId },
      global: { stubs: { RouterLink: RouterLinkStub } },
      attachTo: document.body,
    })
    await vi.waitUntil(() => !store.loading)
    await flushPromises()
    return wrapper
  }

  function rows(wrapper: VueWrapper) {
    return wrapper.findAll('[data-testid="deck-row"]')
  }

  it('shows the folder in a breadcrumb under Folders', async () => {
    const folder = await repositories.folders.create('Spanish', 1000)

    const wrapper = await mountView(folder.id)

    expect(
      wrapper
        .get('[data-testid="breadcrumb"]')
        .findAll('li')
        .map((crumb) => crumb.text()),
    ).toEqual(['Folders', 'Spanish'])
  })

  it('renders one row per deck, with its card count', async () => {
    const folder = await repositories.folders.create('Spanish', 1000)
    const deck = await repositories.decks.create(folder.id, 'Verbs', 1000)
    await repositories.cards.create(deck.id, { front: 'ser', back: 'to be' }, 1000)
    await repositories.cards.create(deck.id, { front: 'ir', back: 'to go' }, 1000)

    const wrapper = await mountView(folder.id)

    expect(rows(wrapper)).toHaveLength(1)
    expect(rows(wrapper)[0].text()).toContain('Verbs')
    expect(rows(wrapper)[0].text()).toContain('2 cards')
  })

  it('links each row to its deck', async () => {
    const folder = await repositories.folders.create('Spanish', 1000)
    const deck = await repositories.decks.create(folder.id, 'Verbs', 1000)

    const wrapper = await mountView(folder.id)

    expect(rows(wrapper)[0].getComponent(RouterLinkStub).props('to')).toEqual({
      name: 'deck',
      params: { deckId: deck.id },
    })
  })

  it('says so, rather than crashing, when the folder does not exist', async () => {
    const wrapper = await mountView('missing')

    expect(wrapper.get('[data-testid="folder-missing"]').text()).toContain('folder')
    expect(rows(wrapper)).toHaveLength(0)
  })

  it('invites a first deck when the folder is empty', async () => {
    const wrapper = await mountView(UNSORTED_FOLDER_ID)

    expect(rows(wrapper)).toHaveLength(0)
    expect(wrapper.get('[data-testid="decks-empty"]').text()).toContain('deck')
  })

  it('adds a deck through the new-deck dialog', async () => {
    const wrapper = await mountView(UNSORTED_FOLDER_ID)

    await wrapper.get('[data-testid="new-deck"]').trigger('click')
    await wrapper.get('[data-testid="name-input"]').setValue('Verbs')
    await wrapper.get('[data-testid="name-save"]').trigger('click')

    await vi.waitFor(() => expect(rows(wrapper)[0].text()).toContain('Verbs'))
  })

  it('renames a deck through the rename dialog', async () => {
    await repositories.decks.create(UNSORTED_FOLDER_ID, 'Verbz', 1000)
    const wrapper = await mountView(UNSORTED_FOLDER_ID)

    await rows(wrapper)[0].get('[data-testid="deck-rename"]').trigger('click')
    await wrapper.get('[data-testid="name-input"]').setValue('Verbs')
    await wrapper.get('[data-testid="name-save"]').trigger('click')

    await vi.waitFor(() => expect(rows(wrapper)[0].text()).toContain('Verbs'))
  })

  it('moves a deck out of the folder through the move dialog', async () => {
    const other = await repositories.folders.create('Spanish', 1000)
    await repositories.decks.create(UNSORTED_FOLDER_ID, 'Verbs', 1000)
    const wrapper = await mountView(UNSORTED_FOLDER_ID)

    await rows(wrapper)[0].get('[data-testid="deck-move"]').trigger('click')
    await wrapper.get('[data-testid="move-select"]').setValue(other.id)
    await wrapper.get('[data-testid="move-save"]').trigger('click')

    await vi.waitFor(() => expect(rows(wrapper)).toHaveLength(0))
  })

  it('keeps the move dialog open, with the reason, when the move fails', async () => {
    await repositories.folders.create('Spanish', 1000)
    await repositories.decks.create(UNSORTED_FOLDER_ID, 'Verbs', 1000)
    const wrapper = await mountView(UNSORTED_FOLDER_ID)
    vi.spyOn(repositories.decks, 'move').mockRejectedValueOnce(
      new Error('That folder no longer exists.'),
    )

    await rows(wrapper)[0].get('[data-testid="deck-move"]').trigger('click')
    await wrapper.get('[data-testid="move-save"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="move-dialog"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="move-error"]').text()).toBe('That folder no longer exists.')
  })

  it('names the card count before deleting a deck', async () => {
    const deck = await repositories.decks.create(UNSORTED_FOLDER_ID, 'Verbs', 1000)
    await repositories.cards.create(deck.id, { front: 'ser', back: 'to be' }, 1000)
    const wrapper = await mountView(UNSORTED_FOLDER_ID)

    await rows(wrapper)[0].get('[data-testid="deck-delete"]').trigger('click')

    expect(wrapper.get('[data-testid="confirm-message"]').text()).toBe(
      'Delete “Verbs”? This removes 1 card. This cannot be undone.',
    )
  })

  it('deletes the deck once the confirmation is accepted', async () => {
    await repositories.decks.create(UNSORTED_FOLDER_ID, 'Verbs', 1000)
    const wrapper = await mountView(UNSORTED_FOLDER_ID)

    await rows(wrapper)[0].get('[data-testid="deck-delete"]').trigger('click')
    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')

    await vi.waitFor(() => expect(rows(wrapper)).toHaveLength(0))
  })
})
