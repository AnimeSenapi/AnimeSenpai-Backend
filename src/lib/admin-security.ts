/**
 * Enhanced Security for Admin Operations
 * 
 * This module provides additional security layers for admin operations:
 * - Rate limiting specifically for admin actions
 * - Action audit logging
 * - IP whitelisting (optional)
 * - Suspicious activity detection
 */

import { logger } from './logger'
import { TRPCError } from '@trpc/server'

// In-memory rate limiter for admin actions
const adminActionLimiter = new Map<string, {
  count: number
  resetAt: number
}>()

// Configuration
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_ADMIN_ACTIONS = 50 // Max actions per minute per admin

/**
 * Check rate limit for admin actions
 */
export function checkAdminRateLimit(userId: string): void {
  const now = Date.now()
  const limiter = adminActionLimiter.get(userId)

  if (limiter && limiter.resetAt > now) {
    // Within rate limit window
    if (limiter.count >= MAX_ADMIN_ACTIONS) {
      logger.warn('Admin rate limit exceeded', { userId }, {
        userId,
        count: limiter.count,
        maxAllowed: MAX_ADMIN_ACTIONS
      })
      
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Too many admin actions. Please wait ${Math.ceil((limiter.resetAt - now) / 1000)} seconds.`
      })
    }
    
    limiter.count++
  } else {
    // Create or reset limiter
    adminActionLimiter.set(userId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW
    })
  }

  // Cleanup old entries periodically
  if (adminActionLimiter.size > 1000) {
    for (const [key, value] of adminActionLimiter.entries()) {
      if (value.resetAt <= now) {
        adminActionLimiter.delete(key)
      }
    }
  }
}

/**
 * Log admin action for audit trail
 */
export async function logAdminAction(
  userId: string,
  action: string,
  details: Record<string, any>,
  ipAddress?: string
): Promise<void> {
  try {
    logger.security(`Admin action: ${action}`, { userId }, {
      action,
      details,
      ipAddress,
      timestamp: new Date().toISOString()
    })

    // You could also save to database for permanent audit trail
    // await db.adminAuditLog.create({
    //   data: {
    //     userId,
    //     action,
    //     details: JSON.stringify(details),
    //     ipAddress,
    //   }
    // })
  } catch (error) {
    logger.error('Failed to log admin action', error as Error, { userId }, {
      action,
      details
    })
    // Don't throw - logging failure shouldn't break admin operations
  }
}

/**
 * Detect suspicious admin activity patterns
 */
export async function detectSuspiciousActivity(
  userId: string,
  action: string
): Promise<void> {
  // Check for rapid user deletions
  if (action === 'delete_user') {
    const limiter = adminActionLimiter.get(userId)
    if (limiter && limiter.count > 10) {
      logger.warn('Suspicious activity detected: Rapid user deletions', { userId }, {
        userId,
        action,
        count: limiter.count
      })
      
      // You could add additional actions here like:
      // - Send alert email
      // - Require additional confirmation
      // - Temporarily suspend admin privileges
    }
  }

  // Check for bulk role changes
  if (action === 'update_role') {
    const limiter = adminActionLimiter.get(userId)
    if (limiter && limiter.count > 20) {
      logger.warn('Suspicious activity detected: Bulk role changes', { userId }, {
        userId,
        action,
        count: limiter.count
      })
    }
  }
}

/**
 * Validate IP whitelist (optional - disable by default)
 * Set ADMIN_IP_WHITELIST environment variable with comma-separated IPs to enable
 */
export function checkIPWhitelist(ipAddress: string): boolean {
  const whitelistEnv = process.env.ADMIN_IP_WHITELIST
  if (!whitelistEnv || whitelistEnv.trim() === '') {
    // No whitelist configured - allow all IPs
    return true
  }
  
  const whitelist = whitelistEnv.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0)
  if (whitelist.length === 0) {
    return true
  }
  
  // Check if IP is in whitelist
  const isAllowed = whitelist.includes(ipAddress)
  
  if (!isAllowed) {
    logger.warn('IP address not in admin whitelist', { ipAddress }, {
    ipAddress,
      whitelist: whitelist.length > 0 ? 'configured' : 'none'
    })
  }

  return isAllowed
}

/**
 * Enhanced admin operation wrapper
 */
export async function secureAdminOperation<T>(
  userId: string,
  action: string,
  operation: () => Promise<T>,
  details?: Record<string, any>,
  ipAddress?: string
): Promise<T> {
  // Check rate limit
  checkAdminRateLimit(userId)

  // Log the action
  await logAdminAction(userId, action, details || {}, ipAddress)

  // Detect suspicious patterns
  await detectSuspiciousActivity(userId, action)

  // Execute the operation
  try {
    const result = await operation()
    
    // Log success
    logger.info(`Admin operation successful: ${action}`, { userId }, {
      action,
      details
    })
    
    return result
  } catch (error) {
    // Log failure
    logger.error(`Admin operation failed: ${action}`, error as Error, { userId }, {
      action,
      details
    })
    throw error
  }
}

/**
 * Clear rate limiter for a specific user (useful for testing or admin override)
 */
export function clearAdminRateLimit(userId: string): void {
  adminActionLimiter.delete(userId)
}

/**
 * Get current rate limit status for a user
 */
export function getAdminRateLimitStatus(userId: string): {
  count: number
  remaining: number
  resetIn: number
} | null {
  const limiter = adminActionLimiter.get(userId)
  if (!limiter) {
    return null
  }

  const now = Date.now()
  if (limiter.resetAt <= now) {
    adminActionLimiter.delete(userId)
    return null
  }

  return {
    count: limiter.count,
    remaining: Math.max(0, MAX_ADMIN_ACTIONS - limiter.count),
    resetIn: Math.ceil((limiter.resetAt - now) / 1000)
  }
}

