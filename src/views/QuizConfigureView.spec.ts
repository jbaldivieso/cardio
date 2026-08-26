import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Router } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { seedDefaults, UNSORTED_FOLDER_ID } from '@/db'
import { defaultQuizConfig } from '@/domain/quiz'
import { routes } from '@/router'
import { useQuizStore } from '@/stores/quiz'
import { repositories } from '@/stores/repositories'
import { useTestDatabase } from '@/test/repositories'

describe('QuizConfigureView', () => {
  const test = useTestDatabase()
  let router: Router
  let spanishId: string
  let verbsId: string
  let nounsId: string
  let emptyId: string

  beforeEach(async () => {
    setActivePinia(createPinia())
    localStorage.clear()
    router = createRouter({ history: createMemoryHistory(), routes })
    await seedDefaults(test.db, 1000)
    spanishId = (await repositories.folders.create('Spanish', 1000)).id
    verbsId = (await repositories.decks.create(spanishId, 'Verbs', 1000)).id
    nounsId = (await repositories.decks.create(spanishId, 'Nouns', 1000)).id
    emptyId = (await repositories.decks.create(UNSORTED_FOLDER_ID, 'Empty', 1000)).id
    await repositories.cards.create(verbsId, { front: 'ser', back: 'to be' }, 1000)
    await repositories.cards.create(nounsId, { front: 'casa', back: 'house' }, 1000)
  })

  async function mountConfigure(query: Record<string, string> = {}): Promise<VueWrapper> {
    await router.push({ name: 'quiz-configure', query })
    await router.isReady()
    const wrapper = mount(
      { template: '<RouterView />' },
      { global: { plugins: [router] }, attachTo: document.body },
    )
    // The picker only appears once the library has loaded, which is also when
    // the launch context has been turned into a selection.
    await vi.waitUntil(() => wrapper.findAll('[data-testid="picker-folder"]').length > 0)
    await flushPromises()
    return wrapper
  }

  function checked(wrapper: VueWrapper, deckId: string): boolean {
    const box = wrapper.find(`[data-testid="deck-check-${deckId}"]`)
    return box.exists() && (box.element as HTMLInputElement).checked
  }

  async function start(wrapper: VueWrapper): Promise<void> {
    await wrapper.get('[data-testid="quiz-start"]').trigger('click')
    await vi.waitUntil(
      () =>
        useQuizStore().phase === 'running' || wrapper.find('[data-testid="quiz-empty"]').exists(),
    )
    await flushPromises()
  }

  it('opens on the defaults of spec §6.1 when nothing has been configured', async () => {
    const wrapper = await mountConfigure()

    expect(wrapper.get('[data-testid="tier-slider"]').attributes('value')).toBe('4')
    expect(wrapper.get('[data-testid="size-20"]').classes()).toContain('is-primary')
    expect(wrapper.get('[data-testid="direction-front"]').classes()).toContain('is-primary')
  })

  it('restores the config it last started with', async () => {
    localStorage.setItem(
      'cardio.quizConfig',
      JSON.stringify({ deckIds: [nounsId], direction: 'back', tier: 6, size: 50 }),
    )

    const wrapper = await mountConfigure()

    expect(wrapper.get('[data-testid="tier-slider"]').attributes('value')).toBe('6')
    expect(wrapper.get('[data-testid="size-50"]').classes()).toContain('is-primary')
    expect(wrapper.get('[data-testid="direction-back"]').classes()).toContain('is-primary')
    expect(checked(wrapper, nounsId)).toBe(true)
    expect(checked(wrapper, verbsId)).toBe(false)
  })

  it('ignores a remembered deck that has since been deleted', async () => {
    localStorage.setItem(
      'cardio.quizConfig',
      JSON.stringify({ ...defaultQuizConfig(['gone', verbsId]) }),
    )

    const wrapper = await mountConfigure()
    await start(wrapper)

    expect(useQuizStore().phase).toBe('running')
  })

  it('pre-checks the folder it was launched from', async () => {
    const wrapper = await mountConfigure({ folder: spanishId })

    expect(checked(wrapper, verbsId)).toBe(true)
    expect(checked(wrapper, nounsId)).toBe(true)
    expect(checked(wrapper, emptyId)).toBe(false)
  })

  it('pre-checks the deck it was launched from, over what was remembered', async () => {
    localStorage.setItem('cardio.quizConfig', JSON.stringify(defaultQuizConfig([nounsId])))

    const wrapper = await mountConfigure({ deck: verbsId })

    expect(checked(wrapper, verbsId)).toBe(true)
    expect(checked(wrapper, nounsId)).toBe(false)
  })

  it('refuses to start with nothing selected', async () => {
    const wrapper = await mountConfigure()

    expect(wrapper.get('[data-testid="quiz-start"]').attributes('aria-disabled')).toBe('true')
  })

  it('refuses to start on decks that hold no cards', async () => {
    const wrapper = await mountConfigure()

    await wrapper.get(`[data-testid="deck-check-${emptyId}"]`).setValue(true)

    expect(wrapper.get('[data-testid="quiz-start"]').attributes('aria-disabled')).toBe('true')
  })

  it('starts once a deck with cards is selected', async () => {
    const wrapper = await mountConfigure()

    await wrapper.get(`[data-testid="deck-check-${verbsId}"]`).setValue(true)

    expect(wrapper.get('[data-testid="quiz-start"]').attributes('aria-disabled')).toBe('false')
  })

  it('says why it cannot start yet', async () => {
    const wrapper = await mountConfigure()

    const start = wrapper.get('[data-testid="quiz-start"]')
    const reason = wrapper.get(`#${start.attributes('aria-describedby')}`)
    expect(reason.text()).toContain('card')
  })

  it('runs the quiz it was configured with', async () => {
    const wrapper = await mountConfigure({ folder: spanishId })
    await wrapper.get('[data-testid="direction-back"]').trigger('click')
    await wrapper.get('[data-testid="size-10"]').trigger('click')

    await start(wrapper)

    const store = useQuizStore()
    expect(store.phase).toBe('running')
    expect(store.direction).toBe('back')
    expect(router.currentRoute.value.name).toBe('quiz-run')
  })

  it('remembers the config it started', async () => {
    const wrapper = await mountConfigure({ folder: spanishId })
    await wrapper.get('[data-testid="direction-back"]').trigger('click')
    await wrapper.get('[data-testid="tier-slider"]').trigger('keydown', { key: 'ArrowRight' })

    await start(wrapper)

    const saved = JSON.parse(localStorage.getItem('cardio.quizConfig') ?? 'null')
    expect(saved).toMatchObject({ direction: 'back', tier: 5, size: 20 })
    // The picker lists a folder's decks by name, so the order is Nouns, Verbs.
    expect([...saved.deckIds].sort()).toEqual([verbsId, nounsId].sort())
  })

  it('reports a pool it could not read rather than blaming the decks', async () => {
    const wrapper = await mountConfigure({ folder: spanishId })
    vi.spyOn(repositories.cards, 'listByDecks').mockRejectedValue(new Error('Database is gone.'))

    await wrapper.get('[data-testid="quiz-start"]').trigger('click')
    await vi.waitUntil(() => wrapper.find('[data-testid="quiz-error"]').exists())
    await flushPromises()

    expect(wrapper.get('[data-testid="quiz-error"]').text()).toContain('Database is gone.')
    expect(wrapper.find('[data-testid="quiz-empty"]').exists()).toBe(false)
    expect(router.currentRoute.value.name).toBe('quiz-configure')
  })

  it('explains an empty pool instead of navigating', async () => {
    const wrapper = await mountConfigure({ folder: spanishId })
    vi.spyOn(repositories.cards, 'listByDecks').mockResolvedValue([])

    await start(wrapper)

    expect(wrapper.get('[data-testid="quiz-empty"]').text()).toContain('no cards')
    expect(router.currentRoute.value.name).toBe('quiz-configure')
    expect(useQuizStore().phase).toBe('configuring')
  })

  it('returns to the folder it was launched from when the quiz is done', async () => {
    const wrapper = await mountConfigure({ folder: spanishId })

    await start(wrapper)

    expect(useQuizStore().origin).toEqual({ name: 'folder', params: { folderId: spanishId } })
  })
})
