import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CardRow from '@/components/CardRow.vue'
import { emptyStats } from '@/domain/models'
import type { Card } from '@/domain/models'

describe('CardRow', () => {
  function card(front: string): Card {
    return {
      id: 'c1',
      deckId: 'd1',
      front,
      back: 'to be',
      createdAt: 1,
      updatedAt: 1,
      stats: emptyStats(),
    }
  }

  function mountRow(front = '**ser**') {
    return mount(CardRow, { props: { card: card(front) }, attachTo: document.body })
  }

  it('shows the front rendered as markdown', () => {
    const wrapper = mountRow()

    expect(wrapper.html()).toContain('<strong>ser</strong>')
  })

  it('opens the editor when the row is tapped', async () => {
    const wrapper = mountRow()

    await wrapper.get('[data-testid="card-row"]').trigger('click')

    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  it('opens the editor from the edit action', async () => {
    const wrapper = mountRow()

    await wrapper.get('[data-testid="card-edit"]').trigger('click')

    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  it('asks to delete without opening the editor', async () => {
    const wrapper = mountRow()

    await wrapper.get('[data-testid="card-delete"]').trigger('click')

    expect(wrapper.emitted('delete')).toHaveLength(1)
    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('leaves a link inside the front to do its own job', async () => {
    const wrapper = mountRow('[docs](http://example.com)')

    await wrapper.get('a[href="http://example.com"]').trigger('click')

    expect(wrapper.emitted('open')).toBeUndefined()
  })
})
