import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import MasteryBar from '@/components/MasteryBar.vue'
import type { MasterySummary } from '@/domain/aggregates'

describe('MasteryBar', () => {
  /** The summary a deck of these three band counts would produce (§5.5). */
  function summary(mastered: number, learning: number, fresh: number): MasterySummary {
    const total = mastered + learning + fresh
    return {
      total,
      new: fresh,
      learning,
      mastered,
      masteredPct: total === 0 ? 0 : Math.round((100 * mastered) / total),
    }
  }

  function mountBar(mastered: number, learning: number, fresh: number) {
    return mount(MasteryBar, { props: { summary: summary(mastered, learning, fresh) } })
  }

  function width(wrapper: VueWrapper, band: string): string {
    return wrapper.get(`[data-testid="mastery-${band}"]`).attributes('style') ?? ''
  }

  it('sizes the three segments by their share of the deck', () => {
    const wrapper = mountBar(5, 3, 2)

    expect(width(wrapper, 'mastered')).toContain('width: 50%')
    expect(width(wrapper, 'learning')).toContain('width: 30%')
    expect(width(wrapper, 'new')).toContain('width: 20%')
  })

  it('shows the mastered percentage beside the bar', () => {
    const wrapper = mountBar(5, 3, 2)

    expect(wrapper.get('[data-testid="mastery-headline"]').text()).toBe('50% mastered')
  })

  it('reads 0% mastered for a deck of nothing but new cards', () => {
    const wrapper = mountBar(0, 0, 4)

    expect(wrapper.get('[data-testid="mastery-headline"]').text()).toBe('0% mastered')
    expect(width(wrapper, 'new')).toContain('width: 100%')
  })

  it('says a deck with no cards has none, instead of a percentage of nothing', () => {
    const wrapper = mountBar(0, 0, 0)

    expect(wrapper.text()).toContain('No cards yet')
    expect(wrapper.text()).not.toContain('NaN')
    expect(wrapper.text()).not.toContain('%')
  })

  it('leaves the track empty for a deck with no cards', () => {
    const wrapper = mountBar(0, 0, 0)

    expect(width(wrapper, 'mastered')).toContain('width: 0%')
    expect(width(wrapper, 'learning')).toContain('width: 0%')
    expect(width(wrapper, 'new')).toContain('width: 0%')
  })

  it('labels the bar for a screen reader in the wording of spec §7.9', () => {
    const wrapper = mount(MasteryBar, {
      props: { summary: { total: 50, new: 4, learning: 12, mastered: 34, masteredPct: 68 } },
    })

    expect(wrapper.get('[data-testid="mastery-track"]').attributes('aria-label')).toBe(
      '68% mastered, 12 learning, 4 new',
    )
  })

  it('labels an empty bar as a deck with no cards', () => {
    const wrapper = mountBar(0, 0, 0)

    expect(wrapper.get('[data-testid="mastery-track"]').attributes('aria-label')).toBe(
      'No cards yet',
    )
  })

  it('is one image to a screen reader, not three anonymous boxes', () => {
    const wrapper = mountBar(5, 3, 2)

    expect(wrapper.get('[data-testid="mastery-track"]').attributes('role')).toBe('img')
  })

  // Bulma's colours are CSS variables that its own data-theme swaps, so a
  // segment coloured by class keeps its contrast in light and dark (ADR-011).
  it('colours the mastered segment with the Bulma success background', () => {
    const wrapper = mountBar(5, 3, 2)

    expect(wrapper.get('[data-testid="mastery-mastered"]').classes()).toContain(
      'has-background-success',
    )
  })

  it('colours the learning segment with the Bulma warning background', () => {
    const wrapper = mountBar(5, 3, 2)

    expect(wrapper.get('[data-testid="mastery-learning"]').classes()).toContain(
      'has-background-warning',
    )
  })

  it('leaves the new segment the theme neutral, the same as the empty track', () => {
    const wrapper = mountBar(5, 3, 2)

    expect(wrapper.get('[data-testid="mastery-new"]').classes()).toContain('has-background')
    expect(wrapper.get('[data-testid="mastery-track"]').classes()).toContain('has-background')
  })
})
