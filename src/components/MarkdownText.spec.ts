import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MarkdownText from '@/components/MarkdownText.vue'

describe('MarkdownText', () => {
  it('renders its source as markdown', () => {
    const wrapper = mount(MarkdownText, { props: { source: '**hola**' } })

    expect(wrapper.html()).toContain('<strong>hola</strong>')
  })

  it('shows raw HTML in a card face as text rather than running it', () => {
    const wrapper = mount(MarkdownText, { props: { source: '<script>alert(1)</script>' } })

    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.text()).toContain('alert(1)')
  })

  it('renders nothing for an empty source', () => {
    const wrapper = mount(MarkdownText, { props: { source: '' } })

    expect(wrapper.text()).toBe('')
  })
})
