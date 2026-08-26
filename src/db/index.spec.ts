import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Table } from 'dexie'
import { CardioDb, seedDefaults, UNSORTED_FOLDER_ID, UNSORTED_FOLDER_NAME } from '@/db'

describe('seedDefaults', () => {
  let db: CardioDb

  beforeEach(() => {
    db = new CardioDb(`cardio-test-${crypto.randomUUID()}`)
  })

  afterEach(async () => {
    await db.delete()
  })

  it('creates the Unsorted folder on a fresh database', async () => {
    await seedDefaults(db, 1000)

    const folder = await db.folders.get(UNSORTED_FOLDER_ID)
    expect(folder).toEqual({
      id: UNSORTED_FOLDER_ID,
      name: UNSORTED_FOLDER_NAME,
      createdAt: 1000,
      updatedAt: 1000,
    })
  })

  it('leaves an existing Unsorted folder untouched when called again', async () => {
    await seedDefaults(db, 1000)
    await db.folders.update(UNSORTED_FOLDER_ID, { name: 'Inbox', updatedAt: 2000 })

    await seedDefaults(db, 3000)

    expect(await db.folders.count()).toBe(1)
    expect((await db.folders.get(UNSORTED_FOLDER_ID))?.name).toBe('Inbox')
  })
})

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
