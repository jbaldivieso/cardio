import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import QuizCard from '@/components/QuizCard.vue'
import { emptyStats } from '@/domain/models'
import type { Card, QuizDirection } from '@/domain/models'

describe('QuizCard', () => {
  const card: Card = {
    id: 'card-1',
    deckId: 'deck-1',
    front: '**ser**',
    back: '_to be_',
    createdAt: 1000,
    updatedAt: 1000,
    stats: emptyStats(),
  }

  let wrapper: VueWrapper | null = null

  function mountCard(props: { flipped?: boolean; direction?: QuizDirection } = {}): VueWrapper {
    wrapper = mount(QuizCard, {
      props: { card, direction: 'front', flipped: false, ...props },
      attachTo: document.body,
    })
    return wrapper
  }

  /** The document-level shortcuts of §7.6 only exist while a card is mounted. */
  async function press(key: string): Promise<void> {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    await wrapper?.vm.$nextTick()
  }

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  describe('before the flip', () => {
    it('shows the front when the quiz asks front first', () => {
      const shown = mountCard({ direction: 'front' })

      expect(shown.get('[data-testid="quiz-prompt"]').html()).toContain('<strong>ser</strong>')
      expect(shown.get('[data-testid="quiz-prompt"]').text()).not.toContain('to be')
    })

    it('shows the back when the quiz asks back first', () => {
      const shown = mountCard({ direction: 'back' })

      expect(shown.get('[data-testid="quiz-prompt"]').html()).toContain('<em>to be</em>')
      expect(shown.get('[data-testid="quiz-prompt"]').text()).not.toContain('ser')
    })

    it('invites a reveal', () => {
      const shown = mountCard()

      expect(shown.get('[data-testid="quiz-reveal-hint"]').text()).toContain('reveal')
    })

    it('has no grading buttons at all', () => {
      const shown = mountCard()

      expect(shown.find('[data-testid="quiz-got"]').exists()).toBe(false)
      expect(shown.find('[data-testid="quiz-missed"]').exists()).toBe(false)
    })

    it('announces nothing yet', () => {
      const shown = mountCard()

      expect(shown.get('[data-testid="quiz-announcement"]').text()).toBe('')
    })
  })

  describe('flipping', () => {
    it('flips when the card is clicked', async () => {
      const shown = mountCard()

      await shown.get('[data-testid="quiz-card"]').trigger('click')

      expect(shown.emitted('flip')).toHaveLength(1)
    })

    it('flips on Space', async () => {
      const shown = mountCard()

      await press(' ')

      expect(shown.emitted('flip')).toHaveLength(1)
    })

    it('flips on Enter', async () => {
      const shown = mountCard()

      await press('Enter')

      expect(shown.emitted('flip')).toHaveLength(1)
    })

    it('does not flip a card that is already revealed', async () => {
      const shown = mountCard({ flipped: true })

      await shown.get('[data-testid="quiz-card"]').trigger('click')
      await press(' ')

      expect(shown.emitted('flip')).toBeUndefined()
    })

    it('ignores the shortcuts while something else is on top', async () => {
      wrapper = mount(QuizCard, {
        props: { card, direction: 'front', flipped: false, keyboardActive: false },
        attachTo: document.body,
      })

      await press(' ')

      expect(wrapper.emitted('flip')).toBeUndefined()
    })
  })

  describe('after the flip', () => {
    it('renders both faces as markdown', () => {
      const shown = mountCard({ flipped: true })

      expect(shown.get('[data-testid="quiz-face-front"]').html()).toContain('<strong>ser</strong>')
      expect(shown.get('[data-testid="quiz-face-back"]').html()).toContain('<em>to be</em>')
    })

    it('labels which face is which', () => {
      const shown = mountCard({ flipped: true })

      expect(shown.get('[data-testid="quiz-label-front"]').text()).toBe('Front')
      expect(shown.get('[data-testid="quiz-label-back"]').text()).toBe('Back')
    })

    it('announces the face it revealed', () => {
      const shown = mountCard({ flipped: true, direction: 'front' })

      expect(shown.get('[data-testid="quiz-announcement"]').text()).toContain('to be')
    })

    it('announces the front when the quiz asked the back', () => {
      const shown = mountCard({ flipped: true, direction: 'back' })

      expect(shown.get('[data-testid="quiz-announcement"]').text()).toContain('ser')
    })

    it('announces politely rather than interrupting', () => {
      const shown = mountCard({ flipped: true })

      expect(shown.get('[data-testid="quiz-announcement"]').attributes('aria-live')).toBe('polite')
    })

    it('grades a miss when the Missed it button is clicked', async () => {
      const shown = mountCard({ flipped: true })

      await shown.get('[data-testid="quiz-missed"]').trigger('click')

      expect(shown.emitted('grade')).toEqual([[false]])
    })

    it('grades a get when the Got it button is clicked', async () => {
      const shown = mountCard({ flipped: true })

      await shown.get('[data-testid="quiz-got"]').trigger('click')

      expect(shown.emitted('grade')).toEqual([[true]])
    })

    it.each([' ', 'Enter'])('does not grade on %s', async (key) => {
      const shown = mountCard({ flipped: true })

      await press(key)

      expect(shown.emitted('grade')).toBeUndefined()
    })

    it.each(['1', 'ArrowLeft'])('grades a miss on %s', async (key) => {
      const shown = mountCard({ flipped: true })

      await press(key)

      expect(shown.emitted('grade')).toEqual([[false]])
    })

    it.each(['2', 'ArrowRight'])('grades a get on %s', async (key) => {
      const shown = mountCard({ flipped: true })

      await press(key)

      expect(shown.emitted('grade')).toEqual([[true]])
    })

    it('ignores the grading shortcuts before the flip', async () => {
      const shown = mountCard({ flipped: false })

      await press('1')
      await press('2')

      expect(shown.emitted('grade')).toBeUndefined()
    })
  })
})
