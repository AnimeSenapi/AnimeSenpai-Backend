import { TRPCError } from '@trpc/server'

/**
 * In-memory rate limiter (no Redis needed for now)
 * Uses sliding window algorithm
 */

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  message?: string
}

interface RateLimitEntry {
  count: number
  resetTime: number
  requests: number[] // Timestamps of requests
}

// Store rate limit data in memory
// In production with multiple servers, use Redis
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Rate limiter middleware for tRPC
 */
export function createRateLimiter(config: RateLimitConfig) {
  const { windowMs, maxRequests, message = 'Too many requests, please try again later.' } = config

  return function rateLimitMiddleware(opts: { ctx: any; path: string; type: string }) {
    const { ctx, path } = opts
    
    // Get identifier (IP or user ID)
    const identifier = ctx.user?.id || ctx.req.headers.get('x-forwarded-for') || ctx.req.headers.get('x-real-ip') || 'anonymous'
    const key = `${identifier}:${path}`
    
    const now = Date.now()
    let entry = rateLimitStore.get(key)
    
    // Initialize or reset if window expired
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
        requests: [],
      }
      rateLimitStore.set(key, entry)
    }
    
    // Use sliding window: remove requests outside the window
    entry.requests = entry.requests.filter(timestamp => timestamp > now - windowMs)
    
    // Check if limit exceeded
    if (entry.requests.length >= maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
      
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message,
        cause: {
          retryAfter,
          limit: maxRequests,
          window: windowMs / 1000,
        },
      })
    }
    
    // Add current request
    entry.requests.push(now)
    entry.count = entry.requests.length
    
    return
  }
}

/**
 * Per-IP rate limiters for different endpoint types
 */

// Strict rate limit for auth endpoints (prevent brute force)
export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per 15 minutes
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
})

// Medium rate limit for mutations (prevent abuse)
export const mutationRateLimit = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 30, // 30 requests per minute
  message: 'Too many requests. Please slow down.',
})

// Relaxed rate limit for queries (normal browsing)
export const queryRateLimit = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  message: 'Rate limit exceeded. Please try again soon.',
})

// Very strict for admin actions
export const adminRateLimit = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 20, // 20 admin actions per minute
  message: 'Admin rate limit exceeded.',
})

/**
 * Get rate limit stats (for monitoring)
 */
export function getRateLimitStats() {
  const stats = {
    totalKeys: rateLimitStore.size,
    activeUsers: new Set<string>(),
    topUsers: [] as Array<{ identifier: string; requests: number; resetTime: string }>,
  }
  
  const now = Date.now()
  const userRequests = new Map<string, number>()
  
  for (const [key, entry] of rateLimitStore.entries()) {
    const identifier = key.split(':')[0]
    if (identifier) {
      stats.activeUsers.add(identifier)
      
      const currentCount = userRequests.get(identifier) || 0
      userRequests.set(identifier, currentCount + entry.requests.length)
    }
  }
  
  stats.topUsers = Array.from(userRequests.entries())
    .map(([identifier, requests]) => ({
      identifier: identifier.substring(0, 20) + '...', // Truncate for privacy
      requests,
      resetTime: new Date(now + 60000).toISOString(),
    }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 10)
  
  return stats
}

/**
 * Clear rate limit for a specific identifier (admin function)
 */
export function clearRateLimit(identifier: string) {
  let cleared = 0
  for (const key of rateLimitStore.keys()) {
    if (key.startsWith(identifier + ':')) {
      rateLimitStore.delete(key)
      cleared++
    }
  }
  return cleared
}

/**
 * Clear all rate limits (admin function)
 */
export function clearAllRateLimits() {
  const size = rateLimitStore.size
  rateLimitStore.clear()
  return size
}

