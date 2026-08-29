import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import LibrarySplash from '@/components/LibrarySplash.vue'

/** The order the screen reads in, which is what the layout assertions are about. */
function readingOrder(wrapper: VueWrapper): string[] {
  return [...wrapper.element.querySelectorAll('[data-testid]')].map(
    (element) => element.getAttribute('data-testid') ?? '',
  )
}

describe('LibrarySplash', () => {
  it('names the app', () => {
    expect(mount(LibrarySplash).get('[data-testid="splash-title"]').text()).toBe('Cardio')
  })

  it('says what the app is for', () => {
    expect(mount(LibrarySplash).get('[data-testid="splash-tagline"]').text()).toBe(
      'Flashcards for faster learning.',
    )
  })

  it('says a folder is the next step, and what one holds', () => {
    expect(mount(LibrarySplash).get('[data-testid="splash-hint"]').text()).toBe(
      'Start with a folder. Folders hold decks. Decks hold flashcards.',
    )
  })

  it('leads with the app icon, above the name', () => {
    const order = readingOrder(mount(LibrarySplash))

    expect(order.indexOf('splash-logo')).toBe(0)
    expect(order.indexOf('splash-title')).toBe(1)
  })

  it('keeps the icon out of the reading order, since the title says the same thing', () => {
    expect(mount(LibrarySplash).get('[data-testid="splash-logo"]').attributes('aria-hidden')).toBe(
      'true',
    )
  })

  it('puts the hint after the button it explains', () => {
    const order = readingOrder(mount(LibrarySplash))

    expect(order.indexOf('splash-hint')).toBeGreaterThan(order.indexOf('splash-create'))
  })

  it('asks for a first folder', async () => {
    const wrapper = mount(LibrarySplash)
    const button = wrapper.get('[data-testid="splash-create"]')

    expect(button.text()).toBe('Create a folder')

    await button.trigger('click')

    expect(wrapper.emitted('create')).toHaveLength(1)
  })
})
