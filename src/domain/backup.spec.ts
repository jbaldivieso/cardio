import { describe, expect, it } from 'vitest'
import {
  BACKUP_APP,
  BACKUP_SCHEMA_VERSION,
  backupFilename,
  serialise,
  validateBackup,
} from '@/domain/backup'
import type { LibraryData } from '@/domain/backup'
import { emptyStats, MASTERY_HISTORY_LIMIT } from '@/domain/models'
import type { Card } from '@/domain/models'

/** Noon UTC on the day of the spec's own example (§10). */
const EXPORTED_AT = Date.UTC(2026, 7, 26, 12, 0, 0)

function card(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    deckId: 'deck-1',
    front: 'hablar',
    back: 'to speak',
    createdAt: 10,
    updatedAt: 20,
    stats: {
      gets: 4,
      misses: 1,
      history: [
        { at: 100, got: false },
        { at: 200, got: true },
      ],
      lastSeenAt: 200,
    },
    ...overrides,
  }
}

const library: LibraryData = {
  folders: [{ id: 'folder-1', name: 'Spanish', createdAt: 1, updatedAt: 2 }],
  decks: [{ id: 'deck-1', folderId: 'folder-1', name: 'Verbs', createdAt: 3, updatedAt: 4 }],
  cards: [card()],
}

/** What an export of `data` reads back as, which is what an import is given. */
function roundTrip(data: LibraryData = library): ReturnType<typeof validateBackup> {
  return validateBackup(serialise(data, EXPORTED_AT))
}

/** A backup document with one field replaced, as the text an import receives. */
function fileWith(overrides: Record<string, unknown>): string {
  return JSON.stringify({ ...JSON.parse(serialise(library, EXPORTED_AT)), ...overrides })
}

describe('serialise', () => {
  it('stamps the envelope §10 requires', () => {
    const file = JSON.parse(serialise(library, EXPORTED_AT))

    expect(file.app).toBe(BACKUP_APP)
    expect(file.schemaVersion).toBe(BACKUP_SCHEMA_VERSION)
    expect(file.exportedAt).toBe('2026-08-26T12:00:00.000Z')
  })

  it('carries every folder, deck and card', () => {
    const file = JSON.parse(serialise(library, EXPORTED_AT))

    expect(file.folders).toEqual(library.folders)
    expect(file.decks).toEqual(library.decks)
    expect(file.cards).toEqual(library.cards)
  })
})

describe('backupFilename', () => {
  it('names the file for the day it was taken', () => {
    // Built from local parts so the expectation holds in any time zone.
    expect(backupFilename(new Date(2026, 7, 26, 13, 30).getTime())).toBe(
      'cardio-backup-2026-08-26.json',
    )
  })

  it('pads a single-digit month and day', () => {
    expect(backupFilename(new Date(2026, 0, 5, 9, 0).getTime())).toBe(
      'cardio-backup-2026-01-05.json',
    )
  })
})

describe('validateBackup', () => {
  describe('a round trip', () => {
    it('reproduces every folder, deck and card exactly', () => {
      const result = roundTrip()

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data).toEqual(library)
    })

    it('reproduces a card’s statistics exactly', () => {
      const result = roundTrip()

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.cards[0].stats).toEqual(library.cards[0].stats)
    })

    it('repairs nothing in a library that was consistent to begin with', () => {
      const result = roundTrip()

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.repairs).toEqual({ rejectedDecks: 0, rejectedCards: 0 })
    })

    it('accepts an empty library', () => {
      const result = roundTrip({ folders: [], decks: [], cards: [] })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data).toEqual({ folders: [], decks: [], cards: [] })
    })
  })

  describe('rejection', () => {
    it('rejects a file that is not JSON at all', () => {
      const result = validateBackup('not a backup')

      expect(result).toEqual({ ok: false, errors: ['That file is not valid JSON.'] })
    })

    it('rejects another app’s export', () => {
      const result = validateBackup(fileWith({ app: 'flashy' }))

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors).toEqual(['That file is not a Cardio backup.'])
    })

    it('rejects a schema version this app cannot read', () => {
      const result = validateBackup(fileWith({ schemaVersion: 2 }))

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors).toEqual(['That backup is version 2; this app reads version 1.'])
    })

    it('rejects a missing array', () => {
      const result = validateBackup(fileWith({ decks: undefined }))

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors).toEqual(['"decks" is missing or is not a list.'])
    })

    it('names every missing array at once', () => {
      const result = validateBackup(JSON.stringify({ app: 'cardio', schemaVersion: 1 }))

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors).toHaveLength(3)
    })

    it('rejects a card with an empty face', () => {
      const result = validateBackup(fileWith({ cards: [card({ back: '   ' })] }))

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors).toEqual(['Card 1: Back cannot be empty.'])
    })

    it('rejects a card whose face is longer than §4.2 allows', () => {
      const result = validateBackup(fileWith({ cards: [card({ front: 'a'.repeat(4001) })] }))

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors[0]).toContain('Card 1: Front cannot be longer')
    })

    it('rejects a folder with an empty name', () => {
      const result = validateBackup(
        fileWith({ folders: [{ id: 'folder-1', name: '', createdAt: 1, updatedAt: 2 }] }),
      )

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors).toEqual(['Folder 1: Name cannot be empty.'])
    })

    it('rejects a row that is missing its id', () => {
      const result = validateBackup(
        fileWith({ decks: [{ folderId: 'folder-1', name: 'Verbs', createdAt: 3, updatedAt: 4 }] }),
      )

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors).toEqual(['Deck 1: id is missing.'])
    })

    it('rejects a row whose timestamps are not numbers', () => {
      const result = validateBackup(fileWith({ cards: [card({ createdAt: 'today' as never })] }))

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors).toEqual(['Card 1: createdAt is not a number.'])
    })

    it('rejects a card whose statistics are not statistics', () => {
      const result = validateBackup(fileWith({ cards: [card({ stats: undefined as never })] }))

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors).toEqual(['Card 1: statistics are missing or unreadable.'])
    })

    it('names the statistic it could not read', () => {
      const result = validateBackup(
        fileWith({ cards: [card({ stats: { ...emptyStats(), gets: -1 } })] }),
      )

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors).toEqual(['Card 1: stats.gets is not a count.'])
    })

    it('rejects a face that is not text rather than stringifying it', () => {
      const result = validateBackup(fileWith({ cards: [card({ front: { a: 1 } as never })] }))

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors).toEqual(['Card 1: front is not text.'])
    })

    it('rejects a name that is not text rather than stringifying it', () => {
      const result = validateBackup(
        fileWith({ folders: [{ id: 'folder-1', name: 12, createdAt: 1, updatedAt: 2 }] }),
      )

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors).toEqual(['Folder 1: name is not text.'])
    })

    it('says a face is missing when it is absent altogether', () => {
      const result = validateBackup(fileWith({ cards: [card({ back: undefined as never })] }))

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors).toEqual(['Card 1: back is missing.'])
    })

    it('rejects two rows that claim the same id', () => {
      const result = validateBackup(fileWith({ cards: [card(), card()] }))

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors).toEqual(['Card 2: another card already uses the id "card-1".'])
    })

    it('reports every bad row rather than stopping at the first', () => {
      const result = validateBackup(
        fileWith({ cards: [card({ id: 'a', front: '' }), card({ id: 'b', back: '' })] }),
      )

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors).toEqual([
        'Card 1: Front cannot be empty.',
        'Card 2: Back cannot be empty.',
      ])
    })

    it('carries no data to write when it rejects', () => {
      const result = validateBackup(fileWith({ app: 'flashy' }))

      expect(result.ok).toBe(false)
      expect('data' in result).toBe(false)
    })
  })

  describe('repairs', () => {
    it('drops a deck whose folder is not in the file, and counts it', () => {
      const result = validateBackup(fileWith({ folders: [] }))

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.decks).toEqual([])
      expect(result.repairs.rejectedDecks).toBe(1)
    })

    it('drops the cards of a deck it had to drop', () => {
      const result = validateBackup(fileWith({ folders: [] }))

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.cards).toEqual([])
      expect(result.repairs.rejectedCards).toBe(1)
    })

    it('drops a card whose deck is not in the file, and counts it', () => {
      const result = validateBackup(
        fileWith({ cards: [card(), card({ id: 'card-2', deckId: 'gone' })] }),
      )

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.cards.map((entry) => entry.id)).toEqual(['card-1'])
      expect(result.repairs.rejectedCards).toBe(1)
    })
  })

  describe('normalisation', () => {
    it('reads a card with no lastSeenAt as one that has never been seen', () => {
      const result = validateBackup(
        fileWith({ cards: [card({ stats: { gets: 0, misses: 0, history: [] } as never })] }),
      )

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.cards[0].stats.lastSeenAt).toBeNull()
    })

    it('trims the whitespace around names and faces', () => {
      const result = validateBackup(fileWith({ cards: [card({ front: '  hablar  ' })] }))

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.cards[0].front).toBe('hablar')
    })

    it('keeps only the most recent attempts §4.2 allows', () => {
      const history = Array.from({ length: MASTERY_HISTORY_LIMIT + 5 }, (_, index) => ({
        at: index,
        got: true,
      }))
      const result = validateBackup(
        fileWith({ cards: [card({ stats: { ...emptyStats(), history } })] }),
      )

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.cards[0].stats.history).toHaveLength(MASTERY_HISTORY_LIMIT)
      expect(result.data.cards[0].stats.history[0].at).toBe(5)
    })

    it('drops fields the backup format does not define', () => {
      const result = validateBackup(fileWith({ cards: [{ ...card(), colour: 'red' }] }))

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.cards[0]).toEqual(card())
    })
  })
})
