import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Table } from 'dexie'
import { CardioDb } from '@/db'

describe('the version 1 schema', () => {
  let db: CardioDb

  // A guard, not a specification: spec §4.3 forbids editing version(1). Changing
  // an index here without adding version(2) and an upgrade() breaks every
  // database already on a user's device, and this test says so out loud.
  beforeEach(async () => {
    db = new CardioDb(`cardio-test-${crypto.randomUUID()}`)
    await db.open()
  })

  afterEach(async () => {
    await db.delete()
  })

  function indexesOf(table: Table): string[] {
    return table.schema.indexes.map((index) => index.name)
  }

  it('is still at version 1', () => {
    expect(db.verno).toBe(1)
  })

  it('holds exactly the three tables, each keyed by id', () => {
    expect(db.tables.map((table) => [table.name, table.schema.primKey.name])).toEqual([
      ['folders', 'id'],
      ['decks', 'id'],
      ['cards', 'id'],
    ])
  })

  it('indexes folders for sorted listings', () => {
    expect(indexesOf(db.folders)).toEqual(['name', 'updatedAt'])
  })

  it('indexes decks by their folder as well', () => {
    expect(indexesOf(db.decks)).toEqual(['folderId', 'name', 'updatedAt'])
  })

  it('indexes cards by their deck, and not by their stats', () => {
    expect(indexesOf(db.cards)).toEqual(['deckId', 'updatedAt'])
  })
})
