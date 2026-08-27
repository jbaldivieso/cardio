import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import TypedConfirmDialog from '@/components/TypedConfirmDialog.vue'

describe('TypedConfirmDialog', () => {
  const mounted: VueWrapper[] = []

  // Every dialog listens on `document` for Escape; one left mounted would keep
  // answering the keydowns of the tests that come after it.
  afterEach(() => {
    for (const wrapper of mounted) wrapper.unmount()
    mounted.length = 0
  })

  function mountDialog(): VueWrapper {
    const wrapper = mount(TypedConfirmDialog, {
      props: {
        title: 'Delete all data',
        message: 'This removes 3 folders, 4 decks and 212 cards.',
        phrase: 'DELETE',
        confirmLabel: 'Delete everything',
      },
      attachTo: document.body,
    })
    mounted.push(wrapper)
    return wrapper
  }

  async function type(wrapper: VueWrapper, text: string): Promise<void> {
    await wrapper.get('[data-testid="typed-confirm-input"]').setValue(text)
  }

  function accept(wrapper: VueWrapper) {
    return wrapper.get('[data-testid="typed-confirm-accept"]')
  }

  it('names what is about to happen', () => {
    const wrapper = mountDialog()

    expect(wrapper.text()).toContain('This removes 3 folders, 4 decks and 212 cards.')
  })

  it('says which words have to be typed', () => {
    const wrapper = mountDialog()

    expect(wrapper.get('[data-testid="typed-confirm-phrase"]').text()).toBe('DELETE')
  })

  it('refuses to confirm until the phrase has been typed', async () => {
    const wrapper = mountDialog()

    await type(wrapper, 'DELE')

    expect(accept(wrapper).attributes('disabled')).toBeDefined()
    await accept(wrapper).trigger('click')
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('confirms once the phrase matches', async () => {
    const wrapper = mountDialog()

    await type(wrapper, 'DELETE')
    await accept(wrapper).trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('ignores whitespace around what was typed', async () => {
    const wrapper = mountDialog()

    await type(wrapper, '  DELETE ')

    expect(accept(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('holds out for the same case', async () => {
    const wrapper = mountDialog()

    await type(wrapper, 'delete')

    expect(accept(wrapper).attributes('disabled')).toBeDefined()
  })

  it('cancels on the cancel button', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="typed-confirm-cancel"]').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('cancels on Escape, wherever the focus went', async () => {
    const wrapper = mountDialog()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('confirms on Enter once the phrase matches', async () => {
    const wrapper = mountDialog()

    await type(wrapper, 'DELETE')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('stays put on Enter before the phrase matches', async () => {
    const wrapper = mountDialog()

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('confirm')).toBeUndefined()
  })
})
