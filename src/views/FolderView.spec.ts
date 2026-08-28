import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { routes } from '@/router'
import { useLibraryStore } from '@/stores/library'
import { useMasteryStore } from '@/stores/mastery'
import { useQuizStore } from '@/stores/quiz'
import { repositories } from '@/stores/repositories'
import { useTestDatabase } from '@/test/repositories'
import FolderView from '@/views/FolderView.vue'

describe('FolderView', () => {
  useTestDatabase()
  /** The folder under test, empty until a test puts a deck in it. */
  let homeId: string

  beforeEach(async () => {
    setActivePinia(createPinia())
    homeId = (await repositories.folders.create('German', 1000)).id
  })

  async function mountView(folderId: string): Promise<VueWrapper> {
    const store = useLibraryStore()
    // The screen navigates when a quiz starts, so it needs a real router even
    // though its links are stubbed for the assertions below.
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(FolderView, {
      props: { folderId },
      global: { plugins: [router], stubs: { RouterLink: RouterLinkStub } },
      attachTo: document.body,
    })
    await vi.waitUntil(() => !store.loading)
    await flushPromises()
    return wrapper
  }

  function rows(wrapper: VueWrapper) {
    return wrapper.findAll('[data-testid="deck-row"]')
  }

  /** Rename, move and delete live behind a row's overflow menu (§7.2). */
  async function openRowMenu(wrapper: VueWrapper, index = 0): Promise<void> {
    await rows(wrapper)[index].get('[data-testid="deck-menu"]').trigger('click')
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

  it('shows how much of each deck is mastered', async () => {
    const folder = await repositories.folders.create('Spanish', 1000)
    const deck = await repositories.decks.create(folder.id, 'Verbs', 1000)
    const card = await repositories.cards.create(deck.id, { front: 'ser', back: 'to be' }, 1000)
    await repositories.cards.create(deck.id, { front: 'ir', back: 'to go' }, 1000)
    // Five clean gets today: spec §5.4's mastery 100, so one of the two cards.
    for (let i = 0; i < 5; i += 1) {
      await repositories.cards.recordAttempt(card.id, true, Date.now())
    }

    const wrapper = await mountView(folder.id)
    // The bar arrives one read after the row it sits in.
    await vi.waitUntil(() => rows(wrapper)[0].text().includes('mastered'))

    expect(rows(wrapper)[0].get('[data-testid="mastery-headline"]').text()).toBe('50% mastered')
  })

  it('reads a deck again when a write drops its summary, without remounting', async () => {
    const folder = await repositories.folders.create('Spanish', 1000)
    const deck = await repositories.decks.create(folder.id, 'Verbs', 1000)
    const card = await repositories.cards.create(deck.id, { front: 'ser', back: 'to be' }, 1000)
    const wrapper = await mountView(folder.id)
    await vi.waitUntil(() => rows(wrapper)[0].text().includes('0% mastered'))

    // What the quiz store does with every answer it records (ADR-032).
    for (let i = 0; i < 5; i += 1) {
      await repositories.cards.recordAttempt(card.id, true, Date.now())
    }
    useMasteryStore().invalidate(deck.id)
    await vi.waitUntil(() => rows(wrapper)[0].text().includes('100% mastered'))

    expect(rows(wrapper)[0].get('[data-testid="mastery-headline"]').text()).toBe('100% mastered')
  })

  it('says a deck holding no cards has none, rather than 0%', async () => {
    const folder = await repositories.folders.create('Spanish', 1000)
    await repositories.decks.create(folder.id, 'Verbs', 1000)

    const wrapper = await mountView(folder.id)
    await vi.waitUntil(() => rows(wrapper)[0].text().includes('No cards yet'))

    expect(rows(wrapper)[0].get('[data-testid="mastery-bar"]').text()).toBe('No cards yet')
  })

  it('says so, rather than crashing, when the folder does not exist', async () => {
    const wrapper = await mountView('missing')

    expect(wrapper.get('[data-testid="folder-missing"]').text()).toContain('folder')
    expect(rows(wrapper)).toHaveLength(0)
  })

  it('invites a first deck when the folder is empty', async () => {
    const wrapper = await mountView(homeId)

    expect(rows(wrapper)).toHaveLength(0)
    expect(wrapper.get('[data-testid="decks-empty"]').text()).toContain('deck')
  })

  it('adds a deck through the new-deck dialog', async () => {
    const wrapper = await mountView(homeId)

    await wrapper.get('[data-testid="new-deck"]').trigger('click')
    await wrapper.get('[data-testid="name-input"]').setValue('Verbs')
    await wrapper.get('[data-testid="name-save"]').trigger('click')

    await vi.waitFor(() => expect(rows(wrapper)[0].text()).toContain('Verbs'))
  })

  it('renames a deck through the rename dialog', async () => {
    await repositories.decks.create(homeId, 'Verbz', 1000)
    const wrapper = await mountView(homeId)

    await openRowMenu(wrapper)
    await rows(wrapper)[0].get('[data-testid="deck-rename"]').trigger('click')
    await wrapper.get('[data-testid="name-input"]').setValue('Verbs')
    await wrapper.get('[data-testid="name-save"]').trigger('click')

    await vi.waitFor(() => expect(rows(wrapper)[0].text()).toContain('Verbs'))
  })

  it('will not move a deck when there is no other folder to move it to', async () => {
    await repositories.decks.create(homeId, 'Verbs', 1000)
    const wrapper = await mountView(homeId)

    await openRowMenu(wrapper)
    const button = rows(wrapper)[0].get('[data-testid="deck-move"]')
    await button.trigger('click')
    await flushPromises()

    expect(button.attributes('aria-disabled')).toBe('true')
    expect(wrapper.find('[data-testid="move-dialog"]').exists()).toBe(false)
  })

  it('says why a deck cannot be moved, where a screen reader will find it', async () => {
    await repositories.decks.create(homeId, 'Verbs', 1000)
    const wrapper = await mountView(homeId)

    await openRowMenu(wrapper)
    const button = rows(wrapper)[0].get('[data-testid="deck-move"]')
    const reason = wrapper.get(`#${button.attributes('aria-describedby')}`)
    expect(reason.text()).toContain('no other folder')
  })

  it('keeps rename, move and delete behind the row menu, leaving Quiz on the row', async () => {
    await repositories.decks.create(homeId, 'Verbs', 1000)
    const wrapper = await mountView(homeId)

    expect(rows(wrapper)[0].get('[data-testid="deck-quiz"]').isVisible()).toBe(true)
    for (const action of ['deck-rename', 'deck-move', 'deck-delete']) {
      expect(rows(wrapper)[0].find(`[data-testid="${action}"]`).exists()).toBe(false)
    }
  })

  it('moves a deck out of the folder through the move dialog', async () => {
    const other = await repositories.folders.create('Spanish', 1000)
    await repositories.decks.create(homeId, 'Verbs', 1000)
    const wrapper = await mountView(homeId)

    await openRowMenu(wrapper)
    await rows(wrapper)[0].get('[data-testid="deck-move"]').trigger('click')
    await wrapper.get('[data-testid="move-select"]').setValue(other.id)
    await wrapper.get('[data-testid="move-save"]').trigger('click')

    await vi.waitFor(() => expect(rows(wrapper)).toHaveLength(0))
  })

  it('keeps the move dialog open, with the reason, when the move fails', async () => {
    await repositories.folders.create('Spanish', 1000)
    await repositories.decks.create(homeId, 'Verbs', 1000)
    const wrapper = await mountView(homeId)
    vi.spyOn(repositories.decks, 'move').mockRejectedValueOnce(
      new Error('That folder no longer exists.'),
    )

    await openRowMenu(wrapper)
    await rows(wrapper)[0].get('[data-testid="deck-move"]').trigger('click')
    await wrapper.get('[data-testid="move-save"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="move-dialog"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="move-error"]').text()).toBe('That folder no longer exists.')
  })

  it('names the card count before deleting a deck', async () => {
    const deck = await repositories.decks.create(homeId, 'Verbs', 1000)
    await repositories.cards.create(deck.id, { front: 'ser', back: 'to be' }, 1000)
    const wrapper = await mountView(homeId)

    await openRowMenu(wrapper)
    await rows(wrapper)[0].get('[data-testid="deck-delete"]').trigger('click')

    expect(wrapper.get('[data-testid="confirm-message"]').text()).toBe(
      'Delete “Verbs”? This removes 1 card. This cannot be undone.',
    )
  })

  it('deletes the deck once the confirmation is accepted', async () => {
    await repositories.decks.create(homeId, 'Verbs', 1000)
    const wrapper = await mountView(homeId)

    await openRowMenu(wrapper)
    await rows(wrapper)[0].get('[data-testid="deck-delete"]').trigger('click')
    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')

    await vi.waitFor(() => expect(rows(wrapper)).toHaveLength(0))
  })

  describe('starting a quiz', () => {
    async function folderWithDeck(cards: number): Promise<{ folderId: string; deckId: string }> {
      const folder = await repositories.folders.create('Spanish', 1000)
      const deck = await repositories.decks.create(folder.id, 'Verbs', 1000)
      for (let i = 0; i < cards; i++) {
        await repositories.cards.create(deck.id, { front: `q${i}`, back: `a${i}` }, 1000)
      }
      return { folderId: folder.id, deckId: deck.id }
    }

    it('quickstarts a deck on the defaults of spec §6.1', async () => {
      localStorage.setItem(
        'cardio.quizConfig',
        JSON.stringify({ deckIds: [], direction: 'back', tier: 7, size: 50 }),
      )
      const { folderId } = await folderWithDeck(3)
      const wrapper = await mountView(folderId)
      const quiz = useQuizStore()

      await wrapper.get('[data-testid="deck-quiz"]').trigger('click')
      await vi.waitUntil(() => quiz.phase === 'running')

      expect(quiz.direction).toBe('front')
      expect(quiz.cards).toHaveLength(3)
      localStorage.clear()
    })

    it('sends a finished quiz back to this folder', async () => {
      const { folderId } = await folderWithDeck(1)
      const wrapper = await mountView(folderId)
      const quiz = useQuizStore()

      await wrapper.get('[data-testid="deck-quiz"]').trigger('click')
      await vi.waitUntil(() => quiz.phase === 'running')

      expect(quiz.origin).toEqual({ name: 'folder', params: { folderId } })
    })

    it('will not quickstart a deck with no cards', async () => {
      const { folderId } = await folderWithDeck(0)
      const wrapper = await mountView(folderId)

      const button = wrapper.get('[data-testid="deck-quiz"]')
      await button.trigger('click')
      await flushPromises()

      expect(button.attributes('aria-disabled')).toBe('true')
      expect(useQuizStore().phase).toBe('configuring')
    })

    it('says why an empty deck cannot be quizzed, where a screen reader will find it', async () => {
      const { folderId } = await folderWithDeck(0)
      const wrapper = await mountView(folderId)

      const button = wrapper.get('[data-testid="deck-quiz"]')
      const reason = wrapper.get(`#${button.attributes('aria-describedby')}`)
      expect(reason.text()).toContain('no cards')
    })

    it('offers a custom quiz over this folder', async () => {
      const { folderId } = await folderWithDeck(1)
      const wrapper = await mountView(folderId)

      const link = wrapper.getComponent<typeof RouterLinkStub>('[data-testid="folder-custom-quiz"]')
      expect(link.props('to')).toEqual({
        name: 'quiz-configure',
        query: { folder: folderId },
      })
    })

    it('offers no custom quiz over a folder with no cards in it', async () => {
      const { folderId } = await folderWithDeck(0)
      const wrapper = await mountView(folderId)

      const action = wrapper.get('[data-testid="folder-custom-quiz"]')
      expect(action.attributes('aria-disabled')).toBe('true')
      // Nothing to configure a quiz over, so it is not a link to anywhere either.
      const links = wrapper.findAllComponents(RouterLinkStub)
      expect(links.some((link) => link.attributes('data-testid') === 'folder-custom-quiz')).toBe(
        false,
      )
    })

    it('says why a folder with no cards has no custom quiz either', async () => {
      const { folderId } = await folderWithDeck(0)
      const wrapper = await mountView(folderId)

      const action = wrapper.get('[data-testid="folder-custom-quiz"]')
      const reason = wrapper.get(`#${action.attributes('aria-describedby')}`)
      expect(reason.text()).toContain('no cards')
    })
  })
})
