/**
 * Simple in-memory cache for server-side data
 * Useful for caching expensive computations like admin insights
 * 
 * NOTE: This cache is designed for single-instance or long-running servers.
 * In serverless environments (like Vercel Functions), each function instance
 * has its own cache that is reset when the instance terminates.
 * For distributed caching in serverless, consider using Redis or similar.
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>()

  /**
   * Get cached data if still valid
   * @param key Cache key
   * @returns Cached data or null if expired/not found
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      // Expired, remove from cache
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set cache data with TTL
   * @param key Cache key
   * @param data Data to cache
   * @param ttl Time to live in milliseconds (default: 5 minutes)
   */
  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })
  }

  /**
   * Invalidate cache entry
   * @param key Cache key
   */
  invalidate(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }
}

// Singleton instance
export const cache = new MemoryCache()

// Run cleanup every 10 minutes (only in long-running server environments)
// In serverless, this may not run or may be unreliable
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    cache.cleanup()
  }, 10 * 60 * 1000)
}
