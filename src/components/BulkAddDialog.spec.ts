import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BulkAddDialog from '@/components/BulkAddDialog.vue'

describe('BulkAddDialog', () => {
  function mountDialog() {
    return mount(BulkAddDialog, { attachTo: document.body })
  }

  async function paste(wrapper: ReturnType<typeof mountDialog>, text: string) {
    await wrapper.get('[data-testid="bulk-text"]').setValue(text)
  }

  it('counts what it can read and what it had to skip', async () => {
    const wrapper = mountDialog()

    await paste(wrapper, 'ser|to be\nir|to go\nnonsense\n|empty front')

    expect(wrapper.get('[data-testid="bulk-summary"]').text()).toBe(
      '2 cards ready, 2 lines skipped',
    )
  })

  it('lists the lines it skipped, by number', async () => {
    const wrapper = mountDialog()

    await paste(wrapper, 'ser|to be\nnonsense')

    expect(wrapper.get('[data-testid="bulk-errors"]').text()).toContain('Line 2')
    expect(wrapper.get('[data-testid="bulk-errors"]').text()).toContain('No “|” on this line.')
  })

  it('emits the parsed cards on confirm', async () => {
    const wrapper = mountDialog()

    await paste(wrapper, 'ser|to be')
    await wrapper.get('[data-testid="bulk-import"]').trigger('click')

    expect(wrapper.emitted('submit')).toEqual([[[{ front: 'ser', back: 'to be' }]]])
  })

  it('emits nothing until the import is confirmed', async () => {
    const wrapper = mountDialog()

    await paste(wrapper, 'ser|to be')

    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('offers no import when nothing could be parsed', async () => {
    const wrapper = mountDialog()

    await paste(wrapper, 'nonsense')

    expect(wrapper.get('[data-testid="bulk-import"]').attributes('disabled')).toBeDefined()
  })

  it('offers no import for an empty paste', () => {
    const wrapper = mountDialog()

    expect(wrapper.get('[data-testid="bulk-import"]').attributes('disabled')).toBeDefined()
  })

  it('parses with the chosen separator', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="bulk-separator"]').setValue('::')
    await paste(wrapper, 'ser::to be')
    await wrapper.get('[data-testid="bulk-import"]').trigger('click')

    expect(wrapper.emitted('submit')).toEqual([[[{ front: 'ser', back: 'to be' }]]])
  })

  it('says that a card face cannot span lines', () => {
    const wrapper = mountDialog()

    expect(wrapper.text()).toContain('One card per line')
  })

  it('shows why an import was refused', async () => {
    const wrapper = mount(BulkAddDialog, {
      props: { error: 'That deck no longer exists.' },
      attachTo: document.body,
    })

    expect(wrapper.get('[data-testid="bulk-error"]').text()).toBe('That deck no longer exists.')
  })

  it('keeps the pasted text when an import was refused', async () => {
    const wrapper = mount(BulkAddDialog, {
      props: { error: 'That deck no longer exists.' },
      attachTo: document.body,
    })

    await paste(wrapper, 'ser|to be')

    expect(wrapper.get<HTMLTextAreaElement>('[data-testid="bulk-text"]').element.value).toBe(
      'ser|to be',
    )
  })

  it('shows nothing where the failure would be when there is none', () => {
    const wrapper = mountDialog()

    expect(wrapper.find('[data-testid="bulk-error"]').exists()).toBe(false)
  })

  it('emits cancel on Escape', async () => {
    const wrapper = mountDialog()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
