import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MoveDialog from '@/components/MoveDialog.vue'
import type { Folder } from '@/domain/models'

describe('MoveDialog', () => {
  const folders: Folder[] = [
    { id: 'f1', name: 'Spanish', createdAt: 1, updatedAt: 1 },
    { id: 'f2', name: 'French', createdAt: 1, updatedAt: 1 },
    { id: 'f3', name: 'Anatomy', createdAt: 1, updatedAt: 1 },
  ]

  function mountDialog(currentFolderId = 'f1', all: Folder[] = folders) {
    return mount(MoveDialog, {
      props: { deckName: 'Verbs', folders: all, currentFolderId },
      attachTo: document.body,
    })
  }

  it('lists every folder except the one the deck is already in', () => {
    const wrapper = mountDialog()

    expect(wrapper.findAll('option').map((option) => option.text())).toEqual(['French', 'Anatomy'])
  })

  it('emits the chosen folder id', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="move-select"]').setValue('f3')
    await wrapper.get('[data-testid="move-save"]').trigger('click')

    expect(wrapper.emitted('submit')).toEqual([['f3']])
  })

  it('defaults to the first other folder', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="move-save"]').trigger('click')

    expect(wrapper.emitted('submit')).toEqual([['f2']])
  })

  it('says so, and offers no move, when there is nowhere else to go', () => {
    const wrapper = mountDialog('f1', [folders[0]])

    expect(wrapper.text()).toContain('another folder')
    expect(wrapper.get('[data-testid="move-save"]').attributes('disabled')).toBeDefined()
  })

  it('shows why a move was refused', () => {
    const wrapper = mount(MoveDialog, {
      props: {
        deckName: 'Verbs',
        folders,
        currentFolderId: 'f1',
        error: 'That folder no longer exists.',
      },
      attachTo: document.body,
    })

    expect(wrapper.get('[data-testid="move-error"]').text()).toBe('That folder no longer exists.')
  })

  it('shows nothing where the failure would be when there is none', () => {
    const wrapper = mountDialog()

    expect(wrapper.find('[data-testid="move-error"]').exists()).toBe(false)
  })

  it('emits cancel on Escape', async () => {
    const wrapper = mountDialog()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })
})
