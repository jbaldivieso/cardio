import { afterEach, describe, expect, it, vi } from 'vitest'
import { CardioDb } from '@/db'
import { durableWrite, isStoragePersistent, requestPersistentStorage } from '@/db/persistence'

function stubStorage(persist: () => Promise<boolean>): { persist: ReturnType<typeof vi.fn> } {
  const storage = { persist: vi.fn(persist) }
  vi.stubGlobal('navigator', { storage })
  return storage
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requestPersistentStorage', () => {
  it('reports the grant when the browser makes storage persistent', async () => {
    await expect(requestPersistentStorage({ persist: async () => true })).resolves.toBe(true)
  })

  it('reports the refusal when the browser declines', async () => {
    await expect(requestPersistentStorage({ persist: async () => false })).resolves.toBe(false)
  })

  it('reports false when the browser has no Storage API', async () => {
    await expect(requestPersistentStorage(undefined)).resolves.toBe(false)
  })

  it('swallows a rejection rather than failing the write that triggered it', async () => {
    const persist = async (): Promise<boolean> => {
      throw new Error('not allowed')
    }

    await expect(requestPersistentStorage({ persist })).resolves.toBe(false)
  })
})

describe('isStoragePersistent', () => {
  it('reports that the browser has already made this origin persistent', async () => {
    await expect(isStoragePersistent({ persisted: async () => true })).resolves.toBe(true)
  })

  it('reports storage the browser may still evict', async () => {
    await expect(isStoragePersistent({ persisted: async () => false })).resolves.toBe(false)
  })

  it('reports false when the browser has no Storage API to ask', async () => {
    await expect(isStoragePersistent(undefined)).resolves.toBe(false)
  })

  it('reports false rather than throwing when the query is refused', async () => {
    const persisted = async (): Promise<boolean> => {
      throw new Error('not allowed')
    }

    await expect(isStoragePersistent({ persisted })).resolves.toBe(false)
  })
})

describe('durableWrite', () => {
  it('returns whatever the write returned', async () => {
    stubStorage(async () => true)

    await expect(
      durableWrite(new CardioDb('cardio-test-durable'), async () => 'written'),
    ).resolves.toBe('written')
  })

  it('asks for persistent storage after the first successful write', async () => {
    const storage = stubStorage(async () => true)

    await durableWrite(new CardioDb('cardio-test-durable'), async () => undefined)

    expect(storage.persist).toHaveBeenCalledTimes(1)
  })

  it('asks only once however many writes follow', async () => {
    const storage = stubStorage(async () => true)
    const db = new CardioDb('cardio-test-durable')

    await durableWrite(db, async () => undefined)
    await durableWrite(db, async () => undefined)
    await durableWrite(db, async () => undefined)

    expect(storage.persist).toHaveBeenCalledTimes(1)
  })

  it('does not ask when the write failed', async () => {
    const storage = stubStorage(async () => true)

    await expect(
      durableWrite(new CardioDb('cardio-test-durable'), async () => {
        throw new Error('rejected')
      }),
    ).rejects.toThrow('rejected')
    expect(storage.persist).not.toHaveBeenCalled()
  })
})
