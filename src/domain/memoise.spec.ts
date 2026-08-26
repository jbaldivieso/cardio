import { describe, expect, it, vi } from 'vitest'
import { memoise } from '@/domain/memoise'

describe('memoise', () => {
  it('computes a value once and reuses it', () => {
    const compute = vi.fn((key: string) => key.toUpperCase())
    const cached = memoise(compute, 10)

    expect(cached('a')).toBe('A')
    expect(cached('a')).toBe('A')
    expect(compute).toHaveBeenCalledTimes(1)
  })

  it('keeps distinct keys apart', () => {
    const cached = memoise((key: string) => key.toUpperCase(), 10)

    expect(cached('a')).toBe('A')
    expect(cached('b')).toBe('B')
  })

  it('drops the least recently used entry once the limit is passed', () => {
    const compute = vi.fn((key: string) => key.toUpperCase())
    const cached = memoise(compute, 2)

    cached('a')
    cached('b')
    cached('c')
    cached('a')

    expect(compute).toHaveBeenCalledTimes(4)
  })

  it('a recent read keeps an entry alive', () => {
    const compute = vi.fn((key: string) => key.toUpperCase())
    const cached = memoise(compute, 2)

    cached('a')
    cached('b')
    cached('a')
    cached('c')
    cached('a')

    expect(compute).toHaveBeenCalledTimes(3)
  })

  it('never holds more than the limit', () => {
    const cached = memoise((key: string) => key.toUpperCase(), 3)

    for (let i = 0; i < 100; i += 1) cached(`key-${i}`)

    expect(cached.size).toBe(3)
  })
})
