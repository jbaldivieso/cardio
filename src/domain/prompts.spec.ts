import { describe, expect, it } from 'vitest'
import {
  countLabel,
  deleteCardPrompt,
  deleteDeckPrompt,
  deleteFolderPrompt,
  masteryHeadline,
  masteryLabel,
} from '@/domain/prompts'

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

describe('deleteCardPrompt', () => {
  it('warns that a card deletion cannot be undone', () => {
    expect(deleteCardPrompt()).toBe('Delete this card? This cannot be undone.')
  })
})

describe('masteryHeadline', () => {
  it('leads with the mastered percentage', () => {
    expect(
      masteryHeadline({ total: 50, new: 4, learning: 12, mastered: 34, masteredPct: 68 }),
    ).toBe('68% mastered')
  })

  it('reads 0% for a deck nobody has quizzed yet', () => {
    expect(masteryHeadline({ total: 3, new: 3, learning: 0, mastered: 0, masteredPct: 0 })).toBe(
      '0% mastered',
    )
  })

  it('says there are no cards rather than a percentage of nothing', () => {
    expect(masteryHeadline({ total: 0, new: 0, learning: 0, mastered: 0, masteredPct: 0 })).toBe(
      'No cards yet',
    )
  })
})

describe('masteryLabel', () => {
  it('reads the bar out in the wording of spec §7.9', () => {
    expect(masteryLabel({ total: 50, new: 4, learning: 12, mastered: 34, masteredPct: 68 })).toBe(
      '68% mastered, 12 learning, 4 new',
    )
  })

  it('says there are no cards rather than reading out three zeros', () => {
    expect(masteryLabel({ total: 0, new: 0, learning: 0, mastered: 0, masteredPct: 0 })).toBe(
      'No cards yet',
    )
  })
})
