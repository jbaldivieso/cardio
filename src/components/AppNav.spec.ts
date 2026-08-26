import { describe, expect, it } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import AppNav from '@/components/AppNav.vue'

describe('AppNav', () => {
  it('renders the brand and links to home and settings', () => {
    const wrapper = mount(AppNav, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    })

    expect(wrapper.get('[data-testid="brand"]').text()).toBe('Cardio')
    expect(wrapper.findAllComponents(RouterLinkStub).map((link) => link.props('to'))).toEqual([
      { name: 'home' },
      { name: 'settings' },
    ])
  })
})
