import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import NameDialog from '@/components/NameDialog.vue'

describe('NameDialog', () => {
  function mountDialog(props: Partial<InstanceType<typeof NameDialog>['$props']> = {}) {
    return mount(NameDialog, {
      props: { title: 'New folder', ...props },
      attachTo: document.body,
    })
  }

  it('shows the title it was given', () => {
    const wrapper = mountDialog({ title: 'Rename folder' })

    expect(wrapper.text()).toContain('Rename folder')
  })

  it('disables Save while the name is empty', () => {
    const wrapper = mountDialog()

    expect(wrapper.get('[data-testid="name-save"]').attributes('disabled')).toBeDefined()
  })

  it('disables Save while the name is only whitespace', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="name-input"]').setValue('   ')

    expect(wrapper.get('[data-testid="name-save"]').attributes('disabled')).toBeDefined()
  })

  it('enables Save once the name has content', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="name-input"]').setValue('Spanish')

    expect(wrapper.get('[data-testid="name-save"]').attributes('disabled')).toBeUndefined()
  })

  it('emits submit with the trimmed name', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="name-input"]').setValue('  Spanish  ')
    await wrapper.get('[data-testid="name-save"]').trigger('click')

    expect(wrapper.emitted('submit')).toEqual([['Spanish']])
  })

  it('starts from the initial name when renaming', async () => {
    const wrapper = mountDialog({ initialName: 'Spanish' })

    await wrapper.get('[data-testid="name-save"]').trigger('click')

    expect(wrapper.emitted('submit')).toEqual([['Spanish']])
  })

  it('shows why a name was refused', () => {
    const wrapper = mountDialog({ error: 'Name cannot be empty.' })

    expect(wrapper.get('[data-testid="name-error"]').text()).toBe('Name cannot be empty.')
  })

  it('shows nothing where the failure would be when there is none', () => {
    const wrapper = mountDialog()

    expect(wrapper.find('[data-testid="name-error"]').exists()).toBe(false)
  })

  it('emits cancel on Escape', async () => {
    const wrapper = mountDialog()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('emits cancel when the cancel button is clicked', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="name-cancel"]').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('submits nothing when the form is submitted empty', async () => {
    const wrapper = mountDialog()

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
  })
})
