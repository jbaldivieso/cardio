import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CardRow from '@/components/CardRow.vue'
import { emptyStats } from '@/domain/models'
import type { Card, CardStats } from '@/domain/models'

describe('CardRow', () => {
  const NOW = Date.parse('2026-06-01T12:00:00.000Z')

  function card(front: string, stats: CardStats): Card {
    return {
      id: 'c1',
      deckId: 'd1',
      front,
      back: 'to be',
      createdAt: 1,
      updatedAt: 1,
      stats,
    }
  }

  function mountRow(front = '**ser**', stats: CardStats = emptyStats()) {
    return mount(CardRow, {
      props: { card: card(front, stats), now: NOW },
      attachTo: document.body,
    })
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

  it('badges the card with its mastery', () => {
    // Five clean gets today: spec §5.4's mastery 100.
    const stats = {
      gets: 5,
      misses: 0,
      history: [...Array(5)].map(() => ({ at: NOW, got: true })),
      lastSeenAt: NOW,
    }

    const wrapper = mountRow('ser', stats)

    expect(wrapper.get('[data-testid="mastery-badge"]').text()).toBe('100%')
  })

  it('advertises the row as tappable', () => {
    const wrapper = mountRow()

    expect(wrapper.get('[data-testid="card-row"]').classes()).toContain('cardio-tappable')
  })

  it('leaves a link inside the front to do its own job', async () => {
    const wrapper = mountRow('[docs](http://example.com)')

    await wrapper.get('a[href="http://example.com"]').trigger('click')

    expect(wrapper.emitted('open')).toBeUndefined()
  })
})
