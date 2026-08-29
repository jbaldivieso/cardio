import { describe, expect, it } from 'vitest'
import {
  cardMasteryLabel,
  countLabel,
  deleteCardPrompt,
  deleteDeckPrompt,
  deleteEverythingPrompt,
  deleteFolderPrompt,
  importPreview,
  libraryLabel,
  masteryHeadline,
  masteryLabel,
  repairNotes,
  replaceEverythingPrompt,
  storedPrompt,
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

describe('libraryLabel', () => {
  it('names all three counts in one phrase', () => {
    expect(libraryLabel({ folders: 3, decks: 4, cards: 212 })).toBe(
      '3 folders, 4 decks and 212 cards',
    )
  })

  it('uses singulars for a library holding one of each', () => {
    expect(libraryLabel({ folders: 1, decks: 1, cards: 1 })).toBe('1 folder, 1 deck and 1 card')
  })
})

describe('storedPrompt', () => {
  it('says what the danger zone is about to act on', () => {
    expect(storedPrompt({ folders: 3, decks: 4, cards: 212 })).toBe(
      '3 folders, 4 decks and 212 cards stored in this browser. There is no undo and no trash.',
    )
  })

  it('quotes no counts when the library could not be read', () => {
    expect(storedPrompt(null)).toBe(
      'Everything you have is stored in this browser. There is no undo and no trash.',
    )
  })
})

describe('deleteEverythingPrompt', () => {
  it('names what goes and what comes back', () => {
    expect(deleteEverythingPrompt({ folders: 3, decks: 4, cards: 212 })).toBe(
      'This deletes every folder, deck and card you have — 3 folders, 4 decks and 212 cards. ' +
        'Nothing comes back.',
    )
  })

  it('claims nothing about the size of a library it could not read', () => {
    expect(deleteEverythingPrompt(null)).toBe(
      'This deletes every folder, deck and card you have. Nothing comes back.',
    )
  })
})

describe('replaceEverythingPrompt', () => {
  it('names what the backup is about to replace', () => {
    expect(replaceEverythingPrompt({ folders: 3, decks: 4, cards: 212 })).toBe(
      'This clears 3 folders, 4 decks and 212 cards and loads the backup in their place. ' +
        'There is no undo.',
    )
  })

  it('claims nothing about the size of a library it could not read', () => {
    expect(replaceEverythingPrompt(null)).toBe(
      'This clears everything in this browser and loads the backup in its place. There is no undo.',
    )
  })
})

describe('importPreview', () => {
  it('says what a chosen file holds before any of it is written', () => {
    expect(importPreview({ folders: 1, decks: 2, cards: 30 })).toBe(
      'That backup holds 1 folder, 2 decks and 30 cards.',
    )
  })
})

describe('repairNotes', () => {
  it('says nothing about a file that needs no repair', () => {
    expect(repairNotes({ rejectedDecks: 0, rejectedCards: 0 })).toEqual([])
  })

  it('warns that a deck with no folder will be left out', () => {
    expect(repairNotes({ rejectedDecks: 2, rejectedCards: 0 })).toEqual([
      '2 decks with no folder will be left out.',
    ])
  })

  it('warns that a card with no deck will be left out', () => {
    expect(repairNotes({ rejectedDecks: 0, rejectedCards: 1 })).toEqual([
      '1 card with no deck will be left out.',
    ])
  })
})

describe('cardMasteryLabel', () => {
  it('says what the percentage on a card badge is a percentage of', () => {
    expect(cardMasteryLabel('learning', 20)).toBe('20% mastered')
  })

  it('names a card nobody has answered rather than leaving `new` unexplained', () => {
    expect(cardMasteryLabel('new', 0)).toBe('Not attempted yet')
  })
})
