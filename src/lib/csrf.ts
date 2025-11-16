/**
 * CSRF (Cross-Site Request Forgery) Protection
 * Prevents unauthorized commands from being transmitted from a user that the web application trusts
 */

import { TRPCError } from '@trpc/server'
import { randomBytes, createHmac } from 'crypto'

// Secret for HMAC signing (should be in environment variable in production)
const CSRF_SECRET = process.env.CSRF_SECRET || 'your-secret-key-change-in-production'

// Token expiry time (15 minutes)
const TOKEN_EXPIRY = 15 * 60 * 1000

// Store tokens in memory (use Redis in production for multiple servers)
const tokenStore = new Map<string, { expires: number; userId?: string }>()

/**
 * Generate a CSRF token
 */
export function generateCSRFToken(userId?: string): string {
  const randomPart = randomBytes(32).toString('hex')
  const timestamp = Date.now()
  const payload = `${randomPart}:${timestamp}:${userId || 'anonymous'}`
  
  // Sign with HMAC
  const signature = createHmac('sha256', CSRF_SECRET)
    .update(payload)
    .digest('hex')
  
  const token = `${payload}:${signature}`
  
  // Store token
  tokenStore.set(token, {
    expires: timestamp + TOKEN_EXPIRY,
    ...(userId !== undefined && { userId }),
  })
  
  return token
}

/**
 * Verify a CSRF token
 */
export function verifyCSRFToken(token: string, userId?: string): boolean {
  if (!token || typeof token !== 'string') {
    return false
  }
  
  try {
    const parts = token.split(':')
    if (parts.length !== 4) {
      return false
    }
    
    const [randomPart, timestamp, tokenUserId, signature] = parts
    
    // Check if token exists in store
    const stored = tokenStore.get(token)
    if (!stored) {
      return false
    }
    
    // Check expiry
    if (Date.now() > stored.expires) {
      tokenStore.delete(token)
      return false
    }
    
    // Verify user ID matches
    if (userId && stored.userId !== userId) {
      return false
    }
    
    // Verify signature
    const payload = `${randomPart}:${timestamp}:${tokenUserId}`
    const expectedSignature = createHmac('sha256', CSRF_SECRET)
      .update(payload)
      .digest('hex')
    
    if (signature !== expectedSignature) {
      return false
    }
    
    // Token is valid - remove it (one-time use)
    tokenStore.delete(token)
    
    return true
  } catch {
    return false
  }
}

/**
 * CSRF middleware for tRPC
 */
export function csrfMiddleware(opts: { ctx: any }) {
  const { ctx } = opts
  
  // Only check CSRF for state-changing operations
  const isStateMutation = ctx.req.method === 'POST' || ctx.req.method === 'PUT' || ctx.req.method === 'DELETE'
  
  if (!isStateMutation) {
    return
  }
  
  // Get CSRF token from header
  const csrfToken = ctx.req.headers.get('x-csrf-token')
  
  if (!csrfToken) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'CSRF token missing',
    })
  }
  
  // Verify token
  const isValid = verifyCSRFToken(csrfToken, ctx.user?.id)
  
  if (!isValid) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Invalid or expired CSRF token',
    })
  }
}

/**
 * Clean up expired tokens (run periodically)
 */
export function cleanupExpiredTokens(): void {
  const now = Date.now()
  let cleaned = 0
  
  for (const [token, data] of tokenStore.entries()) {
    if (data.expires < now) {
      tokenStore.delete(token)
      cleaned++
    }
  }
  
  if (cleaned > 0) {
    console.log(`[CSRF] Cleaned up ${cleaned} expired tokens`)
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredTokens, 5 * 60 * 1000)

/**
 * Get CSRF token stats (for monitoring)
 */
export function getCSRFStats() {
  return {
    activeTokens: tokenStore.size,
    expiryTime: TOKEN_EXPIRY / 1000, // in seconds
  }
}

/**
 * Double Submit Cookie pattern
 * Alternative CSRF protection method
 */
export function generateDoubleSubmitToken(): string {
  return randomBytes(32).toString('hex')
}

export function verifyDoubleSubmitToken(cookieToken: string, headerToken: string): boolean {
  return Boolean(cookieToken && headerToken && cookieToken === headerToken)
}

