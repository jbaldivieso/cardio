import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
