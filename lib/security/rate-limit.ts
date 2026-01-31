/**
 * In-memory rate limiter for API endpoints
 *
 * For production with multiple instances, replace with Redis-based solution
 * (e.g., @upstash/ratelimit)
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store (per-process, cleared on restart)
const store = new Map<string, RateLimitEntry>()

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key)
    }
  }
}, 60000) // Cleanup every minute

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

/**
 * Check rate limit for a given identifier
 *
 * @param identifier - Unique identifier (e.g., IP address, user ID)
 * @param config - Rate limit configuration
 * @returns Rate limit result with success status and headers info
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const key = identifier
  const entry = store.get(key)

  // If no entry or window expired, create new entry
  if (!entry || entry.resetAt < now) {
    store.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    })

    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      reset: now + config.windowMs,
    }
  }

  // Increment count
  entry.count++
  store.set(key, entry)

  // Check if over limit
  if (entry.count > config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      reset: entry.resetAt,
    }
  }

  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - entry.count,
    reset: entry.resetAt,
  }
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.reset / 1000)),
  }
}

// Preset configurations for different endpoint types
export const RATE_LIMITS = {
  // Authentication endpoints - strict limits
  login: { limit: 5, windowMs: 60 * 1000 }, // 5 per minute
  signup: { limit: 3, windowMs: 60 * 1000 }, // 3 per minute
  passwordChange: { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour

  // Invitation endpoints - moderate limits
  invitations: { limit: 20, windowMs: 60 * 60 * 1000 }, // 20 per hour

  // Data ingestion endpoints - higher limits for batch operations
  ingest: { limit: 100, windowMs: 60 * 1000 }, // 100 per minute

  // Pairing code attempts - prevent brute force
  pairing: { limit: 10, windowMs: 15 * 60 * 1000 }, // 10 per 15 minutes

  // General API endpoints
  api: { limit: 100, windowMs: 60 * 1000 }, // 100 per minute

  // Admin endpoints
  admin: { limit: 60, windowMs: 60 * 1000 }, // 60 per minute
} as const
