import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import TierSlider from '@/components/TierSlider.vue'
import { QUIZ_TIERS, tierLabel } from '@/domain/quiz'
import type { QuizTier } from '@/domain/quiz'

describe('TierSlider', () => {
  function mountSlider(tier: QuizTier = 4): VueWrapper {
    return mount(TierSlider, { props: { modelValue: tier } })
  }

  function slider(wrapper: VueWrapper) {
    return wrapper.get('[data-testid="tier-slider"]')
  }

  /** The tier the component last asked to move to. */
  function moved(wrapper: VueWrapper): number | undefined {
    const events = wrapper.emitted('update:modelValue')
    return events?.at(-1)?.[0] as number | undefined
  }

  it('runs over the seven tiers of spec §6.2', () => {
    const wrapper = mountSlider()

    expect(slider(wrapper).attributes('min')).toBe('1')
    expect(slider(wrapper).attributes('max')).toBe('7')
    expect(slider(wrapper).attributes('step')).toBe('1')
  })

  it.each(QUIZ_TIERS)('shows tier %i by its label', (tier) => {
    const wrapper = mountSlider(tier)

    expect(wrapper.get('[data-testid="tier-label"]').text()).toBe(tierLabel(tier))
  })

  it.each(QUIZ_TIERS)('announces tier %i by its label rather than its number', (tier) => {
    const wrapper = mountSlider(tier)

    expect(slider(wrapper).attributes('aria-valuetext')).toBe(tierLabel(tier))
  })

  it.each(['ArrowRight', 'ArrowUp'])('moves one tier up on %s', async (key) => {
    const wrapper = mountSlider(4)

    await slider(wrapper).trigger('keydown', { key })

    expect(moved(wrapper)).toBe(5)
  })

  it.each(['ArrowLeft', 'ArrowDown'])('moves one tier down on %s', async (key) => {
    const wrapper = mountSlider(4)

    await slider(wrapper).trigger('keydown', { key })

    expect(moved(wrapper)).toBe(3)
  })

  it('goes no higher than tier 7', async () => {
    const wrapper = mountSlider(7)

    await slider(wrapper).trigger('keydown', { key: 'ArrowRight' })

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('goes no lower than tier 1', async () => {
    const wrapper = mountSlider(1)

    await slider(wrapper).trigger('keydown', { key: 'ArrowLeft' })

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('jumps to the first tier on Home', async () => {
    const wrapper = mountSlider(5)

    await slider(wrapper).trigger('keydown', { key: 'Home' })

    expect(moved(wrapper)).toBe(1)
  })

  it('jumps to the last tier on End', async () => {
    const wrapper = mountSlider(2)

    await slider(wrapper).trigger('keydown', { key: 'End' })

    expect(moved(wrapper)).toBe(7)
  })

  it('ignores keys that are not its own', async () => {
    const wrapper = mountSlider(4)

    await slider(wrapper).trigger('keydown', { key: 'a' })

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('follows a drag to another tier', async () => {
    const wrapper = mountSlider(4)

    await slider(wrapper).setValue('6')

    expect(moved(wrapper)).toBe(6)
  })

  it('clamps a drag past the end to the last tier', async () => {
    const wrapper = mountSlider(4)

    await slider(wrapper).setValue('99')

    expect(moved(wrapper)).toBe(7)
  })

  it('takes its name from the label beside it', () => {
    const wrapper = mountSlider()

    expect(wrapper.get('label').attributes('for')).toBe(slider(wrapper).attributes('id'))
    expect(wrapper.get('label').text()).toContain('Mastery')
  })
})
