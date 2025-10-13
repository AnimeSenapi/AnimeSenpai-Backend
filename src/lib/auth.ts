/**
 * 🔐 AnimeSenpai Authentication Library
 * 
 * Handles everything auth-related: passwords, tokens, sessions, and email verification.
 * Built with security in mind — your users' data is safe with Senpai.
 */

import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { db } from './db'
import { emailService } from './email'

// JWT Configuration
// Access tokens are short-lived (1 hour), refresh tokens last longer (30 days)
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key'
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-key'
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '1h'
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d'
// 12 rounds of bcrypt = secure but still fast enough
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12')

export interface JWTPayload {
  userId: string
  email: string
  sessionId?: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

export interface SessionInfo {
  userAgent?: string
  ipAddress?: string
  deviceInfo?: string
}

// Password Management
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

// Token Management
export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRES_IN } as jwt.SignOptions)
}

export function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions)
}

export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch {
    return null
  }
}

export function verifyRefreshToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload
  } catch {
    return null
  }
}

// Session Management
export async function createSession(
  userId: string, 
  sessionInfo: SessionInfo = {}
): Promise<TokenPair> {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  // Get user email for token payload
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new Error('User not found')
  }

  // Store session in database first
  let session
  try {
    session = await db.userSession.create({
      data: {
        userId,
        refreshToken: 'temp', // Will be updated after token generation
        accessToken: 'temp',  // Will be updated after token generation
        expiresAt,
        userAgent: sessionInfo.userAgent,
        ipAddress: sessionInfo.ipAddress,
        deviceInfo: sessionInfo.deviceInfo,
      }
    })
  } catch (error) {
    console.error('❌ Failed to create session:', error)
    throw error
  }

  // Now generate tokens with the actual session ID
  const payload: JWTPayload = {
    userId,
    email: user.email,
    sessionId: session.id
  }

  const accessToken = generateAccessToken(payload)
  const refreshToken = generateRefreshToken(payload)

  // Update the session with the actual tokens
  await db.userSession.update({
    where: { id: session.id },
    data: {
      refreshToken,
      accessToken
    }
  })

  return {
    accessToken,
    refreshToken,
    expiresAt
  }
}

export async function refreshSession(refreshToken: string): Promise<TokenPair | null> {
  const payload = verifyRefreshToken(refreshToken)
  if (!payload) return null

  // Find and validate session
  const session = await db.userSession.findUnique({
    where: { refreshToken },
    include: { user: true }
  })

  if (!session || !session.isActive || session.expiresAt < new Date()) {
    return null
  }

  // Create new session
  const newSessionInfo: SessionInfo = {
    userAgent: session.userAgent ?? undefined,
    ipAddress: session.ipAddress ?? undefined,
    deviceInfo: session.deviceInfo ?? undefined
  }

  // Deactivate old session
  await db.userSession.update({
    where: { id: session.id },
    data: { isActive: false }
  })

  return createSession(payload.userId, newSessionInfo)
}

export async function revokeSession(sessionId: string): Promise<boolean> {
  try {
    await db.userSession.update({
      where: { id: sessionId },
      data: { isActive: false }
    })
    return true
  } catch {
    return false
  }
}

export async function revokeAllUserSessions(userId: string): Promise<boolean> {
  try {
    await db.userSession.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false }
    })
    return true
  } catch {
    return false
  }
}

// User Management
export async function getUserFromToken(token: string) {
  const payload = verifyAccessToken(token)
  if (!payload) return null

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: { preferences: true }
  })

  return user
}

// Email Verification
export async function generateEmailVerificationToken(): Promise<string> {
  return uuidv4()
}

export async function sendEmailVerification(email: string, name?: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { email } })
  if (!user) return false

  const token = await generateEmailVerificationToken()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  await db.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken: token,
      emailVerificationExpires: expiresAt
    }
  })

  return emailService.sendEmailVerification(email, token, name)
}

export async function verifyEmailToken(token: string): Promise<boolean> {
  const user = await db.user.findFirst({
    where: {
      emailVerificationToken: token,
      emailVerificationExpires: { gt: new Date() }
    }
  })

  if (!user) return false

  await db.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
      emailVerificationToken: null,
      emailVerificationExpires: null
    }
  })

  // Send welcome email
  emailService.sendWelcomeEmail(user.email, user.name ?? undefined)

  return true
}

// Password Reset
export async function generatePasswordResetToken(): Promise<string> {
  return uuidv4()
}

export async function sendPasswordReset(email: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { email } })
  if (!user) return false

  const token = await generatePasswordResetToken()
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: token,
      passwordResetExpires: expiresAt
    }
  })

  return emailService.sendPasswordReset(email, token, user.name ?? undefined)
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const user = await db.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpires: { gt: new Date() }
    }
  })

  if (!user) return false

  const hashedPassword = await hashPassword(newPassword)

  await db.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
      loginAttempts: 0,
      lockedUntil: null
    }
  })

  // Revoke all sessions for security
  await revokeAllUserSessions(user.id)

  return true
}

// Account Security
export async function incrementLoginAttempts(userId: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return

  const attempts = user.loginAttempts + 1
  const lockUntil = attempts >= 5 ? new Date(Date.now() + 2 * 60 * 60 * 1000) : null // Lock for 2 hours

  await db.user.update({
    where: { id: userId },
    data: {
      loginAttempts: attempts,
      lockedUntil: lockUntil
    }
  })
}

export async function resetLoginAttempts(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: {
      loginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date()
    }
  })
}

export async function isAccountLocked(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user || !user.lockedUntil) return false

  if (user.lockedUntil > new Date()) {
    return true
  }

  // Unlock account if lock period has expired
  await resetLoginAttempts(userId)
  return false
}

// Security Event Logging
export async function logSecurityEvent(
  userId: string | null,
  eventType: string,
  eventData: any = null,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await db.securityEvent.create({
      data: {
        userId,
        eventType,
        eventData: eventData ? JSON.stringify(eventData) : '',
        ipAddress: ipAddress ?? '',
        userAgent: userAgent ?? ''
      }
    })
  } catch (error) {
    console.error('Failed to log security event:', error)
  }
}

// GDPR Compliance
export async function deleteUserData(userId: string): Promise<boolean> {
  try {
    // Delete user and all related data (cascade will handle most)
    await db.user.delete({ where: { id: userId } })
    return true
  } catch (error) {
    console.error('Failed to delete user data:', error)
    return false
  }
}

export async function exportUserData(userId: string): Promise<any> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      preferences: true,
      sessions: true,
      securityEvents: true
    }
  })

  return user
}
