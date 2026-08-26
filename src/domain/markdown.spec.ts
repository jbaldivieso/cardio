import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '@/domain/markdown'

describe('renderMarkdown', () => {
  it('renders emphasis', () => {
    expect(renderMarkdown('*hola*')).toContain('<em>hola</em>')
  })

  it('renders a list', () => {
    const html = renderMarkdown('- ser\n- estar')

    expect(html).toContain('<ul>')
    expect(html).toContain('<li>ser</li>')
  })

  it('renders inline code', () => {
    expect(renderMarkdown('use `git log`')).toContain('<code>git log</code>')
  })

  it('renders a fenced code block', () => {
    const html = renderMarkdown('```\nconst x = 1\n```')

    expect(html).toContain('<pre>')
    expect(html).toContain('<code>')
  })

  it('renders a table', () => {
    const html = renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |')

    expect(html).toContain('<table>')
    expect(html).toContain('<td>1</td>')
  })

  it('renders a blockquote', () => {
    expect(renderMarkdown('> dicho')).toContain('<blockquote>')
  })

  it('escapes raw HTML so a script in a card face is only ever text', () => {
    const html = renderMarkdown('<script>alert(1)</script>')

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('never emits an image, which would reach the network', () => {
    const html = renderMarkdown('![x](http://example.com/x.png)')

    expect(html).not.toContain('<img')
  })

  it('leaves image syntax as a bang and an ordinary link, fetching nothing', () => {
    const html = renderMarkdown('![x](http://example.com/x.png)')

    expect(html).toBe(
      '<p>!<a href="http://example.com/x.png" target="_blank" rel="noopener noreferrer">x</a></p>\n',
    )
  })

  it('opens links in a new tab, severed from this page', () => {
    const html = renderMarkdown('[docs](http://example.com)')

    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('gives an autolinked url the same treatment', () => {
    const html = renderMarkdown('see http://example.com for more')

    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('turns a single newline into a line break', () => {
    expect(renderMarkdown('one\ntwo')).toContain('<br>')
  })

  it('returns the same output for the same input', () => {
    expect(renderMarkdown('**hola**')).toBe(renderMarkdown('**hola**'))
  })

  it('renders an empty source as nothing', () => {
    expect(renderMarkdown('')).toBe('')
  })
})
