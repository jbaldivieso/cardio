import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LibrarySplash from '@/components/LibrarySplash.vue'

describe('LibrarySplash', () => {
  it('names the app', () => {
    expect(mount(LibrarySplash).get('[data-testid="splash-title"]').text()).toBe('Cardio')
  })

  it('says what the app is for', () => {
    expect(mount(LibrarySplash).get('[data-testid="splash-tagline"]').text()).toBe(
      'Flashcards for faster learning',
    )
  })

  it('says a folder is the next step, and what one holds', () => {
    expect(mount(LibrarySplash).get('[data-testid="splash-hint"]').text()).toBe(
      'Start with a folder. Folders hold decks, and decks hold your cards.',
    )
  })

  it('asks for a first folder', async () => {
    const wrapper = mount(LibrarySplash)
    const button = wrapper.get('[data-testid="splash-create"]')

    expect(button.text()).toBe('Create a folder')

    await button.trigger('click')

    expect(wrapper.emitted('create')).toHaveLength(1)
  })
})
