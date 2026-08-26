import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

describe('ConfirmDialog', () => {
  const message = 'Delete “Spanish”? This removes 4 decks and 212 cards. This cannot be undone.'

  function mountDialog() {
    return mount(ConfirmDialog, {
      props: { title: 'Delete folder', message, confirmLabel: 'Delete' },
      attachTo: document.body,
    })
  }

  it('renders the counts message it was given', () => {
    const wrapper = mountDialog()

    expect(wrapper.get('[data-testid="confirm-message"]').text()).toBe(message)
  })

  it('emits nothing until something is clicked', () => {
    const wrapper = mountDialog()

    expect(wrapper.emitted('confirm')).toBeUndefined()
    expect(wrapper.emitted('cancel')).toBeUndefined()
  })

  it('emits confirm only when the confirm button is clicked', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toBeUndefined()
  })

  it('labels the confirm button as asked', () => {
    const wrapper = mountDialog()

    expect(wrapper.get('[data-testid="confirm-accept"]').text()).toBe('Delete')
  })

  it('emits cancel when the cancel button is clicked', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="confirm-cancel"]').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('emits cancel on Escape', async () => {
    const wrapper = mountDialog()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })
})
