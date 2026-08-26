import MarkdownIt from 'markdown-it'
import { memoise } from '@/domain/memoise'

/**
 * Card faces are markdown (spec §8). One shared instance, one exported
 * function, and exactly one component allowed to render its output
 * (`MarkdownText.vue`).
 */
const md = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: false })

// `![alt](url)` would emit an <img> and reach the network, which §13 forbids.
// Disabled rather than stripped afterwards, so it renders as its source text.
md.disable('image')

// Links leave the app, so they leave it severed from this page.
const renderLink =
  md.renderer.rules.link_open ??
  ((tokens, i, options, _env, self) => self.renderToken(tokens, i, options))

md.renderer.rules.link_open = (tokens, index, options, env, self) => {
  tokens[index].attrSet('target', '_blank')
  tokens[index].attrSet('rel', 'noopener noreferrer')
  return renderLink(tokens, index, options, env, self)
}

/** Quiz screens re-render the same two faces on every flip (§8). */
export const MARKDOWN_CACHE_LIMIT = 500

export const renderMarkdown = memoise((source: string) => md.render(source), MARKDOWN_CACHE_LIMIT)
