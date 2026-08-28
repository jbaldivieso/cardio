import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import ActionMenu from '@/components/ActionMenu.vue'

describe('ActionMenu', () => {
  /** The menu with two actions in it, one of them gated. */
  function mountMenu(): VueWrapper {
    return mount(ActionMenu, {
      props: { label: 'More actions for “Verbs”', testid: 'deck-menu' },
      slots: {
        default: `
          <button type="button" class="dropdown-item" data-testid="rename">Rename</button>
          <button type="button" class="dropdown-item" aria-disabled="true" data-testid="move">
            Move
          </button>
        `,
      },
      attachTo: document.body,
    })
  }

  async function open(wrapper: VueWrapper): Promise<void> {
    await wrapper.get('[data-testid="deck-menu"]').trigger('click')
  }

  it('keeps its actions out of the way until it is opened', async () => {
    const wrapper = mountMenu()

    expect(wrapper.find('[data-testid="rename"]').exists()).toBe(false)

    await open(wrapper)

    expect(wrapper.get('[data-testid="rename"]').text()).toBe('Rename')
  })

  it('names itself for the row it belongs to', () => {
    const wrapper = mountMenu()

    expect(wrapper.get('[data-testid="deck-menu"]').attributes('aria-label')).toBe(
      'More actions for “Verbs”',
    )
  })

  it('says whether it is open', async () => {
    const wrapper = mountMenu()
    const trigger = wrapper.get('[data-testid="deck-menu"]')

    expect(trigger.attributes('aria-expanded')).toBe('false')

    await open(wrapper)

    expect(trigger.attributes('aria-expanded')).toBe('true')
  })

  it('closes again on a second press of the trigger', async () => {
    const wrapper = mountMenu()

    await open(wrapper)
    await open(wrapper)

    expect(wrapper.find('[data-testid="rename"]').exists()).toBe(false)
  })

  it('closes once an action has been chosen', async () => {
    const wrapper = mountMenu()
    await open(wrapper)

    await wrapper.get('[data-testid="rename"]').trigger('click')

    expect(wrapper.find('[data-testid="rename"]').exists()).toBe(false)
  })

  it('stays open when a gated action is pressed, so its reason stays on screen', async () => {
    const wrapper = mountMenu()
    await open(wrapper)

    await wrapper.get('[data-testid="move"]').trigger('click')

    expect(wrapper.find('[data-testid="move"]').exists()).toBe(true)
  })

  it('closes on Escape, and hands the focus back to the trigger', async () => {
    const wrapper = mountMenu()
    await open(wrapper)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="rename"]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('[data-testid="deck-menu"]').element)
  })

  it('closes when the next press lands somewhere else on the screen', async () => {
    const wrapper = mountMenu()
    await open(wrapper)
    const elsewhere = document.createElement('button')
    document.body.appendChild(elsewhere)

    elsewhere.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="rename"]').exists()).toBe(false)
    elsewhere.remove()
  })

  it('leaves no listener behind when it is unmounted while open', async () => {
    const wrapper = mountMenu()
    await open(wrapper)

    wrapper.unmount()

    // Nothing to close any more: an Escape that still reached the component
    // would throw on the trigger it no longer has.
    expect(() =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
    ).not.toThrow()
  })
})
