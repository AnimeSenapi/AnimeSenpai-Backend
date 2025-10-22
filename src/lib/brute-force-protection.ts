/**
 * Brute Force Protection
 * Prevents password guessing and automated attacks with account lockout
 */

import { TRPCError } from '@trpc/server'
import { db } from './db'

// Configuration
const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes
const ATTEMPT_WINDOW = 15 * 60 * 1000 // 15 minutes
const MAX_IP_ATTEMPTS = 20 // Max attempts per IP across all accounts

// In-memory stores (use Redis in production for multi-server)
const loginAttempts = new Map<string, { count: number; firstAttempt: number; lastAttempt: number }>()
const lockedAccounts = new Map<string, number>() // identifier -> unlock time
const ipAttempts = new Map<string, { count: number; firstAttempt: number }>()

/**
 * Check if account is locked
 */
export async function isAccountLocked(identifier: string): Promise<boolean> {
  const unlockTime = lockedAccounts.get(identifier)
  
  if (unlockTime) {
    if (Date.now() < unlockTime) {
      return true
    } else {
      // Lockout expired, remove it
      lockedAccounts.delete(identifier)
      loginAttempts.delete(identifier)
      return false
    }
  }
  
  return false
}

/**
 * Get remaining lockout time in seconds
 */
export function getRemainingLockoutTime(identifier: string): number {
  const unlockTime = lockedAccounts.get(identifier)
  
  if (!unlockTime) {
    return 0
  }
  
  const remaining = Math.ceil((unlockTime - Date.now()) / 1000)
  return Math.max(0, remaining)
}

/**
 * Record failed login attempt
 */
export async function recordFailedLogin(identifier: string, ipAddress: string): Promise<void> {
  const now = Date.now()
  
  // Update account attempts
  let attempts = loginAttempts.get(identifier)
  
  if (!attempts) {
    attempts = { count: 1, firstAttempt: now, lastAttempt: now }
  } else {
    // Reset counter if window expired
    if (now - attempts.firstAttempt > ATTEMPT_WINDOW) {
      attempts = { count: 1, firstAttempt: now, lastAttempt: now }
    } else {
      attempts.count++
      attempts.lastAttempt = now
    }
  }
  
  loginAttempts.set(identifier, attempts)
  
  // Check if account should be locked
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    const unlockTime = now + LOCKOUT_DURATION
    lockedAccounts.set(identifier, unlockTime)
    
    console.log(`[Security] Account locked: ${identifier} (${attempts.count} failed attempts)`)
    
    // Log to database for audit
    try {
      await db.securityLog.create({
        data: {
          event: 'ACCOUNT_LOCKED',
          identifier,
          ipAddress,
          metadata: {
            attempts: attempts.count,
            unlockTime: new Date(unlockTime).toISOString(),
          },
        },
      }).catch(() => {
        // SecurityLog table might not exist yet, that's okay
      })
    } catch {
      // Silent fail if audit log fails
    }
  }
  
  // Update IP attempts
  let ipAttempt = ipAttempts.get(ipAddress)
  
  if (!ipAttempt) {
    ipAttempt = { count: 1, firstAttempt: now }
  } else {
    if (now - ipAttempt.firstAttempt > ATTEMPT_WINDOW) {
      ipAttempt = { count: 1, firstAttempt: now }
    } else {
      ipAttempt.count++
    }
  }
  
  ipAttempts.set(ipAddress, ipAttempt)
}

/**
 * Record successful login
 */
export function recordSuccessfulLogin(identifier: string): void {
  // Clear failed attempts
  loginAttempts.delete(identifier)
  lockedAccounts.delete(identifier)
}

/**
 * Check if IP is being rate limited
 */
export function isIPRateLimited(ipAddress: string): boolean {
  const attempts = ipAttempts.get(ipAddress)
  
  if (!attempts) {
    return false
  }
  
  const now = Date.now()
  
  // Reset if window expired
  if (now - attempts.firstAttempt > ATTEMPT_WINDOW) {
    ipAttempts.delete(ipAddress)
    return false
  }
  
  return attempts.count >= MAX_IP_ATTEMPTS
}

/**
 * Middleware to check brute force protection
 */
export async function checkBruteForceProtection(
  identifier: string,
  ipAddress: string
): Promise<void> {
  // Check if account is locked
  const locked = await isAccountLocked(identifier)
  
  if (locked) {
    const remaining = getRemainingLockoutTime(identifier)
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `Account temporarily locked. Try again in ${Math.ceil(remaining / 60)} minutes.`,
      cause: {
        retryAfter: remaining,
        reason: 'ACCOUNT_LOCKED',
      },
    })
  }
  
  // Check if IP is rate limited
  if (isIPRateLimited(ipAddress)) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many login attempts from this IP. Please try again later.',
      cause: {
        retryAfter: ATTEMPT_WINDOW / 1000,
        reason: 'IP_RATE_LIMITED',
      },
    })
  }
}

/**
 * Get login attempts for an identifier
 */
export function getLoginAttempts(identifier: string): number {
  const attempts = loginAttempts.get(identifier)
  return attempts ? attempts.count : 0
}

/**
 * Get remaining attempts before lockout
 */
export function getRemainingAttempts(identifier: string): number {
  const current = getLoginAttempts(identifier)
  return Math.max(0, MAX_LOGIN_ATTEMPTS - current)
}

/**
 * Manually unlock account (admin function)
 */
export function unlockAccount(identifier: string): void {
  lockedAccounts.delete(identifier)
  loginAttempts.delete(identifier)
  console.log(`[Security] Account manually unlocked: ${identifier}`)
}

/**
 * Clean up old entries
 */
export function cleanupOldAttempts(): void {
  const now = Date.now()
  let cleaned = 0
  
  // Clean login attempts
  for (const [identifier, attempts] of loginAttempts.entries()) {
    if (now - attempts.lastAttempt > ATTEMPT_WINDOW) {
      loginAttempts.delete(identifier)
      cleaned++
    }
  }
  
  // Clean locked accounts
  for (const [identifier, unlockTime] of lockedAccounts.entries()) {
    if (now > unlockTime) {
      lockedAccounts.delete(identifier)
      cleaned++
    }
  }
  
  // Clean IP attempts
  for (const [ip, attempts] of ipAttempts.entries()) {
    if (now - attempts.firstAttempt > ATTEMPT_WINDOW) {
      ipAttempts.delete(ip)
      cleaned++
    }
  }
  
  if (cleaned > 0) {
    console.log(`[Security] Cleaned up ${cleaned} old brute force entries`)
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupOldAttempts, 5 * 60 * 1000)

/**
 * Get brute force protection stats
 */
export function getBruteForceStats() {
  return {
    activeAttempts: loginAttempts.size,
    lockedAccounts: lockedAccounts.size,
    blockedIPs: ipAttempts.size,
    maxAttempts: MAX_LOGIN_ATTEMPTS,
    lockoutDuration: LOCKOUT_DURATION / 1000 / 60, // in minutes
  }
}

/**
 * Progressive delay based on failed attempts
 * Implements exponential backoff
 */
export function getProgressiveDelay(identifier: string): number {
  const attempts = getLoginAttempts(identifier)
  
  if (attempts === 0) {
    return 0
  }
  
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s
  const delay = Math.min(Math.pow(2, attempts - 1) * 1000, 16000)
  return delay
}

/**
 * Apply progressive delay
 */
export async function applyProgressiveDelay(identifier: string): Promise<void> {
  const delay = getProgressiveDelay(identifier)
  
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay))
  }
}

