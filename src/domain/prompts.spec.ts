import { describe, expect, it } from 'vitest'
import { countLabel, deleteDeckPrompt, deleteFolderPrompt } from '@/domain/prompts'

describe('countLabel', () => {
  it('pluralises a count of more than one', () => {
    expect(countLabel(4, 'deck')).toBe('4 decks')
  })

  it('keeps the singular for exactly one', () => {
    expect(countLabel(1, 'deck')).toBe('1 deck')
  })

  it('pluralises zero', () => {
    expect(countLabel(0, 'card')).toBe('0 cards')
  })
})

describe('deleteFolderPrompt', () => {
  it('names the folder and both counts, in the wording of spec §4.4', () => {
    expect(deleteFolderPrompt('Spanish', { decks: 4, cards: 212 })).toBe(
      'Delete “Spanish”? This removes 4 decks and 212 cards. This cannot be undone.',
    )
  })

  it('uses singulars for a folder holding one of each', () => {
    expect(deleteFolderPrompt('Spanish', { decks: 1, cards: 1 })).toBe(
      'Delete “Spanish”? This removes 1 deck and 1 card. This cannot be undone.',
    )
  })

  it('leaves out the counts when the folder is empty', () => {
    expect(deleteFolderPrompt('Spanish', { decks: 0, cards: 0 })).toBe(
      'Delete “Spanish”? This cannot be undone.',
    )
  })
})

describe('deleteDeckPrompt', () => {
  it('names the deck and its card count', () => {
    expect(deleteDeckPrompt('Verbs', 12)).toBe(
      'Delete “Verbs”? This removes 12 cards. This cannot be undone.',
    )
  })

  it('uses the singular for a deck holding one card', () => {
    expect(deleteDeckPrompt('Verbs', 1)).toBe(
      'Delete “Verbs”? This removes 1 card. This cannot be undone.',
    )
  })

  it('leaves out the count when the deck is empty', () => {
    expect(deleteDeckPrompt('Verbs', 0)).toBe('Delete “Verbs”? This cannot be undone.')
  })
})
