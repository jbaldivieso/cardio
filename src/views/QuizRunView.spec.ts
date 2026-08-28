import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Router } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import type { Card } from '@/domain/models'
import type { QuizConfig } from '@/domain/quiz'
import { useQuizStore } from '@/stores/quiz'
import { repositories } from '@/stores/repositories'
import { useTestDatabase } from '@/test/repositories'
import { routes } from '@/router'

describe('QuizRunView', () => {
  useTestDatabase()
  let router: Router
  let deckId: string
  let pool: Card[]
  /**
   * Unmounted between tests: `QuizCard` listens on the document (ADR-030), so a
   * wrapper left attached would keep grading cards in the tests that follow.
   */
  let mounted: VueWrapper | null = null

  const config: QuizConfig = { deckIds: [], direction: 'front', tier: 4, size: 20 }

  beforeEach(async () => {
    setActivePinia(createPinia())
    router = createRouter({ history: createMemoryHistory(), routes })
    const folder = await repositories.folders.create('Spanish', 1000)
    deckId = (await repositories.decks.create(folder.id, 'Verbs', 1000)).id
    for (const face of ['uno', 'dos', 'tres']) {
      await repositories.cards.create(deckId, { front: `**${face}**`, back: `${face} back` }, 1000)
    }
    pool = await repositories.cards.listByDecks([deckId])
  })

  afterEach(() => {
    mounted?.unmount()
    mounted = null
  })

  /** Renders the real route, so the leave guard of §6.5 is the one under test. */
  async function mountRun(): Promise<VueWrapper> {
    await router.push({ name: 'quiz-run' })
    await router.isReady()
    const wrapper = mount(
      { template: '<RouterView />' },
      { global: { plugins: [router] }, attachTo: document.body },
    )
    await flushPromises()
    mounted = wrapper
    return wrapper
  }

  async function startAndMount(overrides: Partial<QuizConfig> = {}): Promise<VueWrapper> {
    useQuizStore().start(
      pool,
      { ...config, deckIds: [deckId], ...overrides },
      { name: 'deck', params: { deckId } },
    )
    return mountRun()
  }

  async function press(key: string): Promise<void> {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    await flushPromises()
  }

  /**
   * Waits for the answer to land. Grading writes through IndexedDB, which
   * settles on a task rather than a microtask, so flushing promises alone can
   * read the session before the write comes back.
   */
  async function settle(answered: number): Promise<void> {
    const store = useQuizStore()
    await vi.waitUntil(() => store.answers.length === answered || store.error !== null)
    await flushPromises()
  }

  /**
   * Waits for a click's navigation to land. The route components are lazy, so
   * the router is still resolving one when the click handler returns.
   */
  async function navigatedAwayFrom(name: string): Promise<void> {
    await vi.waitUntil(() => router.currentRoute.value.name !== name)
    await flushPromises()
  }

  /** Reveal, then grade, the way a pointer user would. */
  async function answerByClick(wrapper: VueWrapper, got: boolean): Promise<void> {
    const answered = useQuizStore().answers.length + 1
    await wrapper.get('[data-testid="quiz-card"]').trigger('click')
    await wrapper.get(`[data-testid="quiz-${got ? 'got' : 'missed'}"]`).trigger('click')
    await settle(answered)
  }

  /** The same, from the keyboard alone: reveal with Space, grade with 1 or 2. */
  async function answerByKey(key: string): Promise<void> {
    const answered = useQuizStore().answers.length + 1
    await press(' ')
    await press(key)
    await settle(answered)
  }

  it('counts the position in the session', async () => {
    const wrapper = await startAndMount()

    expect(wrapper.get('[data-testid="quiz-progress-count"]').text()).toBe('1 / 3')
  })

  it('advances the count as cards are answered', async () => {
    const wrapper = await startAndMount()

    await answerByClick(wrapper, true)

    expect(wrapper.get('[data-testid="quiz-progress-count"]').text()).toBe('2 / 3')
  })

  it('announces the progress politely', async () => {
    const wrapper = await startAndMount()

    expect(wrapper.get('[data-testid="quiz-progress-count"]').attributes('aria-live')).toBe(
      'polite',
    )
  })

  it('runs a whole quiz through to the summary', async () => {
    const wrapper = await startAndMount()

    await answerByClick(wrapper, true)
    await answerByClick(wrapper, false)
    await answerByClick(wrapper, true)

    expect(router.currentRoute.value.name).toBe('quiz-summary')
    expect(useQuizStore().summary).toMatchObject({ answered: 3, got: 2, missed: 1, accuracy: 67 })
  })

  it('runs a whole quiz from the keyboard alone', async () => {
    const wrapper = await startAndMount()

    for (const key of ['2', '1', '2']) {
      await answerByKey(key)
    }

    expect(wrapper.exists()).toBe(true)
    expect(router.currentRoute.value.name).toBe('quiz-summary')
    expect(useQuizStore().summary).toMatchObject({ answered: 3, got: 2, missed: 1 })
  })

  it('offers no undo until something has been answered', async () => {
    const wrapper = await startAndMount()

    expect(wrapper.find('[data-testid="quiz-undo"]').exists()).toBe(false)
  })

  it('steps back to the previous card when undo is used', async () => {
    const wrapper = await startAndMount()
    const first = useQuizStore().current as Card

    await answerByClick(wrapper, true)
    await wrapper.get('[data-testid="quiz-undo"]').trigger('click')
    await settle(0)

    const store = useQuizStore()
    expect(store.current?.id).toBe(first.id)
    expect(store.answers).toEqual([])
    expect((await repositories.cards.get(first.id))?.stats.gets).toBe(0)
  })

  /**
   * §7.6 wants the whole card to answer Space and Enter, and ADR-030 makes that
   * a document listener — which has to stand aside for the two buttons that sit
   * beside the card, or a keyboard-only user can neither exit nor undo.
   */
  it('asks before leaving when Exit is pressed with the keyboard', async () => {
    const wrapper = await startAndMount()
    const exit = wrapper.get('[data-testid="quiz-exit"]')

    await exit.trigger('keydown', { key: 'Enter' })
    await exit.trigger('click')
    await flushPromises()

    expect(useQuizStore().flipped).toBe(false)
    expect(wrapper.find('[data-testid="confirm-dialog"]').exists()).toBe(true)
  })

  it('leaves Space to Undo rather than flipping the card behind it', async () => {
    const wrapper = await startAndMount()

    await answerByClick(wrapper, true)
    await wrapper.get('[data-testid="quiz-undo"]').trigger('keydown', { key: ' ' })

    // A flip here means the card swallowed the key, and the browser cancelled
    // the press that would have undone the answer.
    expect(useQuizStore().flipped).toBe(false)
  })

  it('asks before leaving a running quiz', async () => {
    const wrapper = await startAndMount()

    await wrapper.get('[data-testid="quiz-exit"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="confirm-dialog"]').exists()).toBe(true)
    expect(router.currentRoute.value.name).toBe('quiz-run')
    expect(useQuizStore().phase).toBe('running')
  })

  it('stays in the quiz when the exit is cancelled', async () => {
    const wrapper = await startAndMount()

    await wrapper.get('[data-testid="quiz-exit"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="confirm-cancel"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="confirm-dialog"]').exists()).toBe(false)
    expect(router.currentRoute.value.name).toBe('quiz-run')
    expect(useQuizStore().phase).toBe('running')
  })

  it('leaves the quiz when the exit is confirmed', async () => {
    const wrapper = await startAndMount()

    await wrapper.get('[data-testid="quiz-exit"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')
    await navigatedAwayFrom('quiz-run')

    expect(useQuizStore().phase).toBe('configuring')
    expect(router.currentRoute.value.name).toBe('deck')
  })

  it('keeps the answers already given when the quiz is abandoned', async () => {
    const wrapper = await startAndMount()
    const first = useQuizStore().current as Card

    await answerByClick(wrapper, true)
    await wrapper.get('[data-testid="quiz-exit"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')
    await flushPromises()

    expect((await repositories.cards.get(first.id))?.stats).toMatchObject({ gets: 1, misses: 0 })
  })

  it('does not grade the card behind the exit confirmation', async () => {
    const wrapper = await startAndMount()

    await wrapper.get('[data-testid="quiz-card"]').trigger('click')
    await wrapper.get('[data-testid="quiz-exit"]').trigger('click')
    await flushPromises()
    await press('2')

    expect(useQuizStore().answers).toEqual([])
  })

  it('explains itself when there is no session to run', async () => {
    const wrapper = await mountRun()

    expect(wrapper.get('[data-testid="quiz-none"]').text()).toContain('quiz')
    expect(wrapper.find('[data-testid="quiz-card"]').exists()).toBe(false)
  })

  it('shows the back first when the session asked for it', async () => {
    const wrapper = await startAndMount({ direction: 'back' })

    expect(wrapper.get('[data-testid="quiz-prompt"]').text()).toContain('back')
  })

  it('surfaces a write that failed instead of advancing', async () => {
    const wrapper = await startAndMount()
    vi.spyOn(repositories.cards, 'recordAttempt').mockRejectedValue(new Error('Disk is full.'))

    await answerByClick(wrapper, true)

    expect(wrapper.get('[data-testid="quiz-error"]').text()).toContain('Disk is full.')
    expect(useQuizStore().index).toBe(0)
  })
})
