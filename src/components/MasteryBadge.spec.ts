import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MasteryBadge from '@/components/MasteryBadge.vue'
import { emptyStats } from '@/domain/models'
import type { Attempt, CardStats } from '@/domain/models'

describe('MasteryBadge', () => {
  const DAY = 86_400_000
  const NOW = Date.parse('2026-06-01T12:00:00.000Z')

  function attempts(count: number, got: boolean): Attempt[] {
    return [...Array(count)].map(() => ({ at: NOW, got }))
  }

  function answered(gets: number, misses: number, lastSeenAt = NOW): CardStats {
    return {
      gets,
      misses,
      history: [...attempts(misses, false), ...attempts(gets, true)],
      lastSeenAt,
    }
  }

  function mountBadge(stats: CardStats, now = NOW) {
    return mount(MasteryBadge, { props: { stats, now } })
  }

  function badge(stats: CardStats, now = NOW) {
    return mountBadge(stats, now).get('[data-testid="mastery-badge"]')
  }

  it('marks a card nobody has answered as new', () => {
    expect(badge(emptyStats()).text()).toBe('new')
  })

  it('shows the mastery of an answered card as a whole percentage', () => {
    // Spec §5.4: five clean gets today scores 100.
    expect(badge(answered(5, 0)).text()).toBe('100%')
  })

  it('shows a card that has only been seen once its low score, not new', () => {
    // Spec §5.4: one get today scores 20.
    expect(badge(answered(1, 0)).text()).toBe('20%')
  })

  it('scores a card at the moment it is asked about, not when it was last seen', () => {
    // Spec §5.4: a perfect card left alone for 60 days has decayed to 75.
    expect(badge(answered(5, 0, NOW - 60 * DAY)).text()).toBe('75%')
  })

  it('shows 0% for a card that has only ever been missed', () => {
    expect(badge(answered(0, 3)).text()).toBe('0%')
  })

  // Bulma's tag colours are CSS variables its own data-theme swaps (ADR-011).
  it('tells a screen reader what the percentage is a percentage of', () => {
    expect(badge(answered(5, 0)).attributes('aria-label')).toBe('100% mastered')
  })

  it('tells a screen reader that a new card has not been attempted', () => {
    expect(badge(emptyStats()).attributes('aria-label')).toBe('Not attempted yet')
  })

  it('marks a mastered card with the success tag', () => {
    expect(badge(answered(5, 0)).classes()).toContain('is-success')
  })

  it('marks a learning card with the warning tag', () => {
    expect(badge(answered(1, 0)).classes()).toContain('is-warning')
  })

  it('leaves a new card the neutral tag', () => {
    const classes = badge(emptyStats()).classes()

    expect(classes).toContain('tag')
    expect(classes).not.toContain('is-success')
    expect(classes).not.toContain('is-warning')
  })
})
