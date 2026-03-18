import { describe, it, expect, beforeEach, vi } from 'vitest'

// We can't import the singleton directly without triggering the setInterval,
// so we'll re-implement the MemoryCache class test by importing and testing it.
// The cache module exports a singleton. We'll test via that singleton.

describe('MemoryCache', () => {
  // We'll import fresh each time to avoid singleton pollution
  let cache: any

  beforeEach(async () => {
    // Dynamic import so we can clear between tests
    const mod = await import('../../lib/cache')
    cache = mod.cache
    cache.clear()
  })

  describe('set and get', () => {
    it('stores and retrieves data', () => {
      cache.set('key1', { name: 'test' })
      expect(cache.get('key1')).toEqual({ name: 'test' })
    })

    it('returns null for non-existent key', () => {
      expect(cache.get('nonexistent')).toBeNull()
    })

    it('stores different data types', () => {
      cache.set('string', 'hello')
      cache.set('number', 42)
      cache.set('array', [1, 2, 3])
      cache.set('boolean', true)

      expect(cache.get('string')).toBe('hello')
      expect(cache.get('number')).toBe(42)
      expect(cache.get('array')).toEqual([1, 2, 3])
      expect(cache.get('boolean')).toBe(true)
    })

    it('overwrites existing key', () => {
      cache.set('key', 'first')
      cache.set('key', 'second')
      expect(cache.get('key')).toBe('second')
    })
  })

  describe('TTL expiration', () => {
    it('returns null for expired entries', () => {
      vi.useFakeTimers()
      try {
        cache.set('expiring', 'data', 1000) // 1 second TTL
        expect(cache.get('expiring')).toBe('data')

        vi.advanceTimersByTime(1001) // Advance past TTL
        expect(cache.get('expiring')).toBeNull()
      } finally {
        vi.useRealTimers()
      }
    })

    it('keeps entries within TTL', () => {
      vi.useFakeTimers()
      try {
        cache.set('valid', 'data', 5000) // 5 second TTL

        vi.advanceTimersByTime(3000) // 3 seconds - still within TTL
        expect(cache.get('valid')).toBe('data')
      } finally {
        vi.useRealTimers()
      }
    })

    it('uses default 5-minute TTL', () => {
      vi.useFakeTimers()
      try {
        cache.set('default-ttl', 'data')

        vi.advanceTimersByTime(4 * 60 * 1000) // 4 minutes
        expect(cache.get('default-ttl')).toBe('data')

        vi.advanceTimersByTime(2 * 60 * 1000) // 6 minutes total (past 5 min TTL)
        expect(cache.get('default-ttl')).toBeNull()
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('invalidate', () => {
    it('removes specific key', () => {
      cache.set('a', 1)
      cache.set('b', 2)
      cache.invalidate('a')

      expect(cache.get('a')).toBeNull()
      expect(cache.get('b')).toBe(2)
    })

    it('does not throw for non-existent key', () => {
      expect(() => cache.invalidate('nonexistent')).not.toThrow()
    })
  })

  describe('clear', () => {
    it('removes all entries', () => {
      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)
      cache.clear()

      expect(cache.get('a')).toBeNull()
      expect(cache.get('b')).toBeNull()
      expect(cache.get('c')).toBeNull()
    })
  })

  describe('size', () => {
    it('returns 0 for empty cache', () => {
      expect(cache.size()).toBe(0)
    })

    it('returns correct count', () => {
      cache.set('a', 1)
      cache.set('b', 2)
      expect(cache.size()).toBe(2)
    })

    it('decreases after invalidation', () => {
      cache.set('a', 1)
      cache.set('b', 2)
      cache.invalidate('a')
      expect(cache.size()).toBe(1)
    })
  })

  describe('cleanup', () => {
    it('removes expired entries', () => {
      vi.useFakeTimers()
      try {
        cache.set('short', 'data', 1000)  // 1 second TTL
        cache.set('long', 'data', 10000)  // 10 second TTL

        vi.advanceTimersByTime(2000) // 2 seconds
        cache.cleanup()

        expect(cache.get('short')).toBeNull()
        expect(cache.get('long')).toBe('data')
      } finally {
        vi.useRealTimers()
      }
    })

    it('keeps non-expired entries', () => {
      vi.useFakeTimers()
      try {
        cache.set('a', 1, 10000)
        cache.set('b', 2, 10000)
        cache.cleanup()

        expect(cache.size()).toBe(2)
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
