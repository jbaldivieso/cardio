/**
 * A bounded least-recently-used cache around a pure function.
 *
 * `Map` iterates in insertion order, so the oldest key is always the first one
 * — deleting and re-setting a key on read is what makes "recently used" mean
 * anything.
 */
export interface Memoised<K, V> {
  (key: K): V
  /** How many entries are held. Never more than the limit. */
  readonly size: number
}

export function memoise<K, V>(compute: (key: K) => V, limit: number): Memoised<K, V> {
  const cache = new Map<K, V>()

  const cached = (key: K): V => {
    if (cache.has(key)) {
      const hit = cache.get(key) as V
      cache.delete(key)
      cache.set(key, hit)
      return hit
    }
    const value = compute(key)
    cache.set(key, value)
    if (cache.size > limit) {
      cache.delete(cache.keys().next().value as K)
    }
    return value
  }

  return Object.defineProperty(cached, 'size', {
    get: () => cache.size,
  }) as Memoised<K, V>
}
