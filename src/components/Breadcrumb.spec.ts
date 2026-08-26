import { describe, expect, it } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import Breadcrumb from '@/components/Breadcrumb.vue'

describe('Breadcrumb', () => {
  function mountCrumbs(trail: { label: string; to?: object }[]) {
    return mount(Breadcrumb, {
      props: { trail },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
  }

  it('renders Folders followed by the trail', () => {
    const wrapper = mountCrumbs([{ label: 'Spanish' }])

    // The separators are Bulma's CSS, so only the labels are in the text.
    expect(wrapper.findAll('li').map((crumb) => crumb.text())).toEqual(['Folders', 'Spanish'])
  })

  it('links the root crumb back to home', () => {
    const wrapper = mountCrumbs([{ label: 'Spanish' }])

    expect(wrapper.getComponent(RouterLinkStub).props('to')).toEqual({ name: 'home' })
  })

  it('links every crumb that was given a destination', () => {
    const to = { name: 'folder', params: { folderId: 'f1' } }

    const wrapper = mountCrumbs([{ label: 'Spanish', to }, { label: 'Verbs' }])

    expect(wrapper.findAllComponents(RouterLinkStub).map((link) => link.props('to'))).toEqual([
      { name: 'home' },
      to,
    ])
  })

  it('marks the last crumb as the current page', () => {
    const wrapper = mountCrumbs([{ label: 'Spanish' }])

    const current = wrapper.get('[aria-current="page"]')
    expect(current.text()).toBe('Spanish')
  })
})
