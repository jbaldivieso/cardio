import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Router } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'
import type { RouterLinkStub } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { UNSORTED_FOLDER_ID, seedDefaults } from '@/db'
import { routes } from '@/router'
import { useCardsStore } from '@/stores/cards'
import { useLibraryStore } from '@/stores/library'
import { useQuizStore } from '@/stores/quiz'
import { repositories } from '@/stores/repositories'
import { useTestDatabase } from '@/test/repositories'
import DeckView from '@/views/DeckView.vue'

describe('DeckView', () => {
  const test = useTestDatabase()
  let router: Router
  let deckId: string

  beforeEach(async () => {
    setActivePinia(createPinia())
    router = createRouter({ history: createMemoryHistory(), routes })
    await seedDefaults(test.db, 1000)
    deckId = (await repositories.decks.create(UNSORTED_FOLDER_ID, 'Verbs', 1000)).id
  })

  async function mountView(id = deckId): Promise<VueWrapper> {
    const cards = useCardsStore()
    const library = useLibraryStore()
    router.push('/')
    await router.isReady()
    const wrapper = mount(DeckView, {
      props: { deckId: id },
      global: { plugins: [router] },
      attachTo: document.body,
    })
    await vi.waitUntil(() => !cards.loading && !library.loading)
    await flushPromises()
    return wrapper
  }

  function rows(wrapper: VueWrapper) {
    return wrapper.findAll('[data-testid="card-row"]')
  }

  it('shows the deck under its folder in the breadcrumb', async () => {
    const wrapper = await mountView()

    expect(
      wrapper
        .get('[data-testid="breadcrumb"]')
        .findAll('li')
        .map((crumb) => crumb.text()),
    ).toEqual(['Folders', 'Unsorted', 'Verbs'])
  })

  it('renders each card front as markdown', async () => {
    await repositories.cards.create(deckId, { front: '**ser**', back: 'to be' }, 1000)

    const wrapper = await mountView()

    expect(rows(wrapper)).toHaveLength(1)
    expect(rows(wrapper)[0].html()).toContain('<strong>ser</strong>')
  })

  it('badges each card row with its mastery', async () => {
    const card = await repositories.cards.create(deckId, { front: 'ser', back: 'to be' }, 1000)
    // Five clean gets today: spec §5.4's mastery 100.
    for (let i = 0; i < 5; i += 1) {
      await repositories.cards.recordAttempt(card.id, true, Date.now())
    }

    const wrapper = await mountView()

    expect(rows(wrapper)[0].get('[data-testid="mastery-badge"]').text()).toBe('100%')
  })

  it('badges a card nobody has answered as new', async () => {
    await repositories.cards.create(deckId, { front: 'ser', back: 'to be' }, 1000)

    const wrapper = await mountView()

    expect(rows(wrapper)[0].get('[data-testid="mastery-badge"]').text()).toBe('new')
  })

  it('invites a first card when the deck is empty', async () => {
    const wrapper = await mountView()

    expect(rows(wrapper)).toHaveLength(0)
    expect(wrapper.get('[data-testid="cards-empty"]').text()).toContain('card')
  })

  it('says so, rather than crashing, when the deck does not exist', async () => {
    const wrapper = await mountView('missing')

    expect(wrapper.get('[data-testid="deck-missing"]').text()).toContain('deck')
  })

  it('goes to the editor when a row is tapped', async () => {
    const card = await repositories.cards.create(deckId, { front: 'ser', back: 'to be' }, 1000)
    const wrapper = await mountView()

    await rows(wrapper)[0].trigger('click')

    // The editor route is lazy, so the navigation settles over several ticks.
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('card-edit'))
    expect(router.currentRoute.value.params.cardId).toBe(card.id)
  })

  it('links the new-card action to the editor for this deck', async () => {
    const wrapper = await mountView()

    expect(wrapper.get('[data-testid="new-card"]').attributes('href')).toContain(
      `/decks/${deckId}/cards/new`,
    )
  })

  it('confirms before deleting a card, naming what it is about to do', async () => {
    await repositories.cards.create(deckId, { front: 'ser', back: 'to be' }, 1000)
    const wrapper = await mountView()

    await rows(wrapper)[0].get('[data-testid="card-delete"]').trigger('click')

    expect(wrapper.get('[data-testid="confirm-message"]').text()).toBe(
      'Delete this card? This cannot be undone.',
    )
  })

  it('deletes the card once the confirmation is accepted', async () => {
    await repositories.cards.create(deckId, { front: 'ser', back: 'to be' }, 1000)
    const wrapper = await mountView()

    await rows(wrapper)[0].get('[data-testid="card-delete"]').trigger('click')
    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')

    await vi.waitFor(() => expect(rows(wrapper)).toHaveLength(0))
  })

  it('imports a batch through the bulk-add dialog', async () => {
    const wrapper = await mountView()

    await wrapper.get('[data-testid="bulk-add"]').trigger('click')
    await wrapper.get('[data-testid="bulk-text"]').setValue('ser|to be\nir|to go')
    await wrapper.get('[data-testid="bulk-import"]').trigger('click')

    await vi.waitFor(() => expect(rows(wrapper)).toHaveLength(2))
    expect(wrapper.find('[data-testid="bulk-dialog"]').exists()).toBe(false)
  })

  it('keeps the bulk dialog open, with the paste and the reason, when the write fails', async () => {
    const wrapper = await mountView()
    vi.spyOn(repositories.cards, 'createMany').mockRejectedValueOnce(
      new Error('That deck no longer exists.'),
    )

    await wrapper.get('[data-testid="bulk-add"]').trigger('click')
    await wrapper.get('[data-testid="bulk-text"]').setValue('ser|to be')
    await wrapper.get('[data-testid="bulk-import"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="bulk-dialog"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="bulk-error"]').text()).toBe('That deck no longer exists.')
    expect(wrapper.get<HTMLTextAreaElement>('[data-testid="bulk-text"]').element.value).toBe(
      'ser|to be',
    )
  })

  describe('starting a quiz', () => {
    it('quickstarts this deck on the defaults of spec §6.1', async () => {
      await repositories.cards.create(deckId, { front: 'ser', back: 'to be' }, 1000)
      const wrapper = await mountView()
      const quiz = useQuizStore()

      await wrapper.get('[data-testid="deck-quiz"]').trigger('click')
      await vi.waitUntil(() => quiz.phase === 'running')

      expect(quiz.direction).toBe('front')
      expect(quiz.cards).toHaveLength(1)
      expect(quiz.origin).toEqual({ name: 'deck', params: { deckId } })
    })

    it('will not quickstart a deck with no cards', async () => {
      const wrapper = await mountView()

      const button = wrapper.get('[data-testid="deck-quiz"]')
      await button.trigger('click')
      await flushPromises()

      expect(button.attributes('aria-disabled')).toBe('true')
      expect(useQuizStore().phase).toBe('configuring')
    })

    it('offers a custom quiz over this deck', async () => {
      const wrapper = await mountView()

      const link = wrapper.getComponent<typeof RouterLinkStub>('[data-testid="deck-custom-quiz"]')
      expect(link.props('to')).toEqual({
        name: 'quiz-configure',
        query: { deck: deckId },
      })
    })
  })
})
