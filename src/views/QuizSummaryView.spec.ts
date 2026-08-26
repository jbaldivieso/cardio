import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Router } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { seedDefaults, UNSORTED_FOLDER_ID } from '@/db'
import type { Card } from '@/domain/models'
import type { QuizConfig } from '@/domain/quiz'
import { useQuizStore } from '@/stores/quiz'
import { repositories } from '@/stores/repositories'
import { useTestDatabase } from '@/test/repositories'
import { routes } from '@/router'

describe('QuizSummaryView', () => {
  const test = useTestDatabase()
  let router: Router
  let deckId: string
  let pool: Card[]

  const config: QuizConfig = { deckIds: [], direction: 'front', tier: 4, size: 20 }

  beforeEach(async () => {
    setActivePinia(createPinia())
    router = createRouter({ history: createMemoryHistory(), routes })
    await seedDefaults(test.db, 1000)
    deckId = (await repositories.decks.create(UNSORTED_FOLDER_ID, 'Verbs', 1000)).id
    for (const face of ['uno', 'dos', 'tres']) {
      await repositories.cards.create(deckId, { front: `**${face}**`, back: `${face} back` }, 1000)
    }
    pool = await repositories.cards.listByDecks([deckId])
  })

  async function mountSummary(): Promise<VueWrapper> {
    await router.push({ name: 'quiz-summary' })
    await router.isReady()
    const wrapper = mount(
      { template: '<RouterView />' },
      { global: { plugins: [router] }, attachTo: document.body },
    )
    await flushPromises()
    return wrapper
  }

  /**
   * Waits for a click's navigation to land. The route components are lazy, so
   * the router is still resolving one when the click handler returns.
   */
  async function navigatedAway(): Promise<void> {
    await vi.waitUntil(() => router.currentRoute.value.name !== 'quiz-summary')
    await flushPromises()
  }

  /** A finished session: two got, one missed, in that order. */
  async function completeQuiz(): Promise<Card> {
    const store = useQuizStore()
    store.start(pool, { ...config, deckIds: [deckId] }, { name: 'deck', params: { deckId } })
    await store.flip()
    await store.answer(true)
    store.flip()
    await store.answer(true)
    const missed = store.current as Card
    store.flip()
    await store.answer(false)
    return missed
  }

  it('reports what was answered', async () => {
    await completeQuiz()

    const wrapper = await mountSummary()

    expect(wrapper.get('[data-testid="summary-answered"]').text()).toContain('3')
    expect(wrapper.get('[data-testid="summary-got"]').text()).toContain('2')
    expect(wrapper.get('[data-testid="summary-missed"]').text()).toContain('1')
    expect(wrapper.get('[data-testid="summary-accuracy"]').text()).toContain('67')
  })

  it('lists the missed cards with their fronts rendered', async () => {
    const missed = await completeQuiz()

    const wrapper = await mountSummary()

    const rows = wrapper.findAll('[data-testid="summary-missed-card"]')
    expect(rows).toHaveLength(1)
    expect(rows[0].html()).toContain(`<strong>${missed.front.replaceAll('*', '')}</strong>`)
  })

  it('says so when nothing was missed', async () => {
    const store = useQuizStore()
    store.start(pool, { ...config, deckIds: [deckId] }, { name: 'deck', params: { deckId } })
    for (let i = 0; i < 3; i++) {
      store.flip()
      await store.answer(true)
    }

    const wrapper = await mountSummary()

    expect(wrapper.findAll('[data-testid="summary-missed-card"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="summary-quiz-missed"]').exists()).toBe(false)
  })

  it('quizzes exactly the missed cards again', async () => {
    const missed = await completeQuiz()

    const wrapper = await mountSummary()
    await wrapper.get('[data-testid="summary-quiz-missed"]').trigger('click')
    await navigatedAway()

    const store = useQuizStore()
    expect(store.cards.map((card) => card.id)).toEqual([missed.id])
    expect(store.phase).toBe('running')
    expect(router.currentRoute.value.name).toBe('quiz-run')
  })

  it('returns to where the quiz started when done', async () => {
    await completeQuiz()

    const wrapper = await mountSummary()
    await wrapper.get('[data-testid="summary-done"]').trigger('click')
    await navigatedAway()

    expect(router.currentRoute.value.name).toBe('deck')
    expect(useQuizStore().phase).toBe('configuring')
  })

  it('explains itself when there is no finished quiz to report', async () => {
    const wrapper = await mountSummary()

    expect(wrapper.get('[data-testid="summary-none"]').text()).toContain('quiz')
  })
})
