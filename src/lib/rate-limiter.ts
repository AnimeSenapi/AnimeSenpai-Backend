/**
 * Rate Limiting Implementation
 * 
 * Provides configurable rate limiting for API endpoints to prevent abuse.
 * Uses in-memory storage (suitable for single-instance deployments).
 * For multi-instance deployments, use Redis-based rate limiting.
 */

import { TRPCError } from '@trpc/server'
import { logger } from './logger'

interface RateLimitEntry {
  count: number
  resetAt: number
  firstRequest: number
}

// In-memory storage for rate limit counters
const rateLimitStore = new Map<string, RateLimitEntry>()

// Rate limit configurations by endpoint type
export const RATE_LIMITS = {
  // Authentication endpoints (stricter limits)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 min
    message: 'Too many authentication attempts. Please try again in 15 minutes.'
  },
  
  // Public API endpoints
  public: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
    message: 'Too many requests. Please slow down.'
  },
  
  // Authenticated user endpoints
  authenticated: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 120, // 120 requests per minute
    message: 'Too many requests. Please slow down.'
  },
  
  // Admin endpoints (strict but higher limit)
  admin: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    message: 'Too many admin actions. Please slow down.'
  },
  
  // Email sending (very strict)
  email: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5, // 5 emails per hour
    message: 'Too many email requests. Please try again later.'
  },
  
  // Password reset (strict)
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 attempts per hour
    message: 'Too many password reset attempts. Please try again in 1 hour.'
  }
} as const

export type RateLimitType = keyof typeof RATE_LIMITS

/**
 * Check rate limit for a given identifier and endpoint type
 * 
 * @param identifier - Unique identifier (userId, IP address, email, etc.)
 * @param type - Rate limit type (auth, public, admin, etc.)
 * @param customKey - Optional custom key prefix for specific endpoints
 * @returns void - Throws TRPCError if rate limit exceeded
 */
export function checkRateLimit(
  identifier: string,
  type: RateLimitType,
  customKey?: string
): void {
  const config = RATE_LIMITS[type]
  const key = customKey ? `${customKey}:${identifier}` : `${type}:${identifier}`
  const now = Date.now()
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(key)
  
  if (!entry || entry.resetAt <= now) {
    // Create new entry or reset expired one
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
      firstRequest: now
    })
    return
  }
  
  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    
    logger.security('Rate limit exceeded', { identifier, type, customKey }, {
      key,
      count: entry.count,
      maxRequests: config.maxRequests,
      retryAfter
    })
    
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: config.message,
      cause: {
        retryAfter,
        limit: config.maxRequests,
        window: config.windowMs / 1000
      }
    })
  }
  
  // Increment counter
  entry.count++
  rateLimitStore.set(key, entry)
}

/**
 * Get rate limit status for an identifier
 * Useful for showing remaining requests to users
 */
export function getRateLimitStatus(
  identifier: string,
  type: RateLimitType,
  customKey?: string
): {
  requests: number
  limit: number
  remaining: number
  resetAt: number
  resetIn: number
} {
  const config = RATE_LIMITS[type]
  const key = customKey ? `${customKey}:${identifier}` : `${type}:${identifier}`
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  
  if (!entry || entry.resetAt <= now) {
    return {
      requests: 0,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetAt: now + config.windowMs,
      resetIn: config.windowMs / 1000
    }
  }
  
  return {
    requests: entry.count,
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: entry.resetAt,
    resetIn: Math.ceil((entry.resetAt - now) / 1000)
  }
}

/**
 * Reset rate limit for an identifier
 * Useful for testing or manual admin intervention
 */
export function resetRateLimit(
  identifier: string,
  type: RateLimitType,
  customKey?: string
): void {
  const key = customKey ? `${customKey}:${identifier}` : `${type}:${identifier}`
  rateLimitStore.delete(key)
  
  logger.info('Rate limit reset', { identifier, type, customKey }, { key })
}

/**
 * Cleanup expired rate limit entries
 * Should be called periodically (e.g., every 5 minutes)
 */
export function cleanupRateLimits(): void {
  const now = Date.now()
  let cleaned = 0
  
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key)
      cleaned++
    }
  }
  
  if (cleaned > 0) {
    logger.info('Rate limit cleanup completed', {}, { 
      cleaned, 
      remaining: rateLimitStore.size 
    })
  }
}

/**
 * Get rate limit statistics
 * Useful for monitoring and debugging
 */
export function getRateLimitStats(): {
  totalEntries: number
  byType: Record<string, number>
} {
  const byType: Record<string, number> = {}
  
  for (const key of rateLimitStore.keys()) {
    const type = key.split(':')[0]
    byType[type] = (byType[type] || 0) + 1
  }
  
  return {
    totalEntries: rateLimitStore.size,
    byType
  }
}

// Start cleanup interval (runs every 5 minutes)
setInterval(cleanupRateLimits, 5 * 60 * 1000)

// Export for testing
export const _test = {
  rateLimitStore,
  clearAll: () => rateLimitStore.clear()
}

