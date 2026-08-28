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

  it('names the settings link for screen readers, since it shows only an icon', () => {
    const wrapper = mount(AppNav, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    })

    const settings = wrapper.get('[data-testid="nav-settings"]')
    expect(settings.attributes('aria-label')).toBe('Settings')
    expect(settings.text()).toBe('')
    expect(settings.find('svg').exists()).toBe(true)
  })

  it('keeps the settings link in the brand, so it shares the logo line on mobile', () => {
    const wrapper = mount(AppNav, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    })

    expect(wrapper.find('.navbar-brand [data-testid="nav-settings"]').exists()).toBe(true)
  })
})
