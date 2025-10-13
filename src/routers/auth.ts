import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure, validateWithSchema } from '../lib/trpc'
import { db } from '../lib/db'
import { 
  hashPassword, 
  verifyPassword, 
  createSession,
  refreshSession,
  revokeSession,
  revokeAllUserSessions,
  sendEmailVerification,
  verifyEmailToken,
  sendPasswordReset,
  resetPassword,
  incrementLoginAttempts,
  resetLoginAttempts,
  isAccountLocked,
  logSecurityEvent,
  deleteUserData,
  exportUserData,
  SessionInfo
} from '../lib/auth'
import { createError, handleError } from '../lib/errors'
import { logger, extractLogContext, logAuth, logError } from '../lib/logger'
import { schemas } from '../lib/validation'
import { checkRateLimit } from '../lib/rate-limiter'

export const authRouter = router({
  // Sign up
  signup: publicProcedure
    .input(schemas.signup)
    .mutation(async ({ input, ctx }) => {
      const logContext = extractLogContext(ctx.req)
      
      try {
        // Direct input validation
        const { email, username, password, gdprConsent, marketingConsent, dataProcessingConsent } = input

        // Rate limit: 5 signup attempts per 15 minutes per IP
        const ipAddress = logContext.ipAddress || 'unknown'
        checkRateLimit(ipAddress, 'auth', 'signup')

        logger.auth('Signup attempt started', logContext, { email, username })

        // Check if user already exists (email or username)
        const existingUser = await db.user.findFirst({
          where: {
            OR: [
              { email },
              { username }
            ]
          }
        })

        if (existingUser) {
          if (existingUser.email === email) {
            logAuth.registration(email, false, logContext)
            throw createError.userAlreadyExists(email)
          } else {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Username is already taken. Please choose a different username.'
            })
          }
        }

        // Hash password and create user
        const hashedPassword = await hashPassword(password)
        
        const user = await db.user.create({
          data: {
            email,
            username,
            password: hashedPassword,
            gdprConsent,
            gdprConsentAt: new Date(),
            marketingConsent,
            marketingConsentAt: marketingConsent ? new Date() : null,
            dataProcessingConsent,
            dataProcessingConsentAt: new Date(),
            preferences: {
              create: {} // Create default preferences
            }
          },
          include: {
            preferences: true
          }
        })

        // Create session
        const sessionInfo: SessionInfo = {
          userAgent: ctx.req?.headers.get('user-agent') || undefined,
          ipAddress: ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
          deviceInfo: ctx.req?.headers.get('user-agent') || undefined
        }

        const tokens = await createSession(user.id, sessionInfo)

        // Send email verification
        await sendEmailVerification(email, username)

        // Log security event
        await logSecurityEvent(
          user.id,
          'user_registration',
          { email, username },
          sessionInfo.ipAddress,
          sessionInfo.userAgent
        )

        logAuth.registration(email, true, logContext)

        return {
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            name: user.name,
            avatar: user.avatar,
            bio: user.bio,
            role: user.role,
            emailVerified: user.emailVerified,
            preferences: user.preferences
          },
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt
        }
      } catch (error) {
        logError.unexpected(error as Error, logContext)
        throw handleError(error, logContext)
      }
    }),

  // Sign in
  signin: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const { email, password } = input
      const logContext = extractLogContext(ctx.req)
      const ipAddress = logContext.ipAddress || 'unknown'

      // Rate limit: 5 signin attempts per 15 minutes per IP
      checkRateLimit(ipAddress, 'auth', 'signin')

      // Find user
      const user = await db.user.findUnique({
        where: { email },
        include: { preferences: true }
      })

      if (!user) {
        // Log failed login attempt
        await logSecurityEvent(
          null,
          'failed_login',
          { email, reason: 'user_not_found' },
          ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
          ctx.req?.headers.get('user-agent') || undefined
        )

        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password'
        })
      }

      // Check if account is locked
      if (await isAccountLocked(user.id)) {
        await logSecurityEvent(
          user.id,
          'failed_login',
          { email, reason: 'account_locked' },
          ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
          ctx.req?.headers.get('user-agent') || undefined
        )

        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Account is temporarily locked due to too many failed login attempts'
        })
      }

      // Verify password
      const isValidPassword = await verifyPassword(password, user.password)
      
      if (!isValidPassword) {
        // Increment login attempts
        await incrementLoginAttempts(user.id)

        await logSecurityEvent(
          user.id,
          'failed_login',
          { email, reason: 'invalid_password' },
          ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
          ctx.req?.headers.get('user-agent') || undefined
        )

        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password'
        })
      }

      // Reset login attempts on successful login
      await resetLoginAttempts(user.id)

      // Create session
      const sessionInfo: SessionInfo = {
        userAgent: ctx.req?.headers.get('user-agent') || undefined,
        ipAddress: ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        deviceInfo: ctx.req?.headers.get('user-agent') || undefined
      }

      const tokens = await createSession(user.id, sessionInfo)

      // Log successful login
      await logSecurityEvent(
        user.id,
        'successful_login',
        { email, sessionId: tokens.accessToken },
        sessionInfo.ipAddress,
        sessionInfo.userAgent
      )

      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          avatar: user.avatar,
          bio: user.bio,
          role: user.role,
          emailVerified: user.emailVerified,
          preferences: user.preferences
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt
      }
    }),

  // Get current user
  me: protectedProcedure
    .query(async ({ ctx }) => {
      return {
        id: ctx.user.id,
        email: ctx.user.email,
        username: ctx.user.username,
        name: ctx.user.name,
        avatar: ctx.user.avatar,
        bio: ctx.user.bio,
        role: ctx.user.role,
        emailVerified: ctx.user.emailVerified,
        preferences: ctx.user.preferences
      }
    }),

  // Update profile
  updateProfile: protectedProcedure
    .input(z.object({
      username: z.string().min(2).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens').optional(),
      name: z.string().min(2).optional(),
      bio: z.string().max(200).optional(),
      avatar: z.string().url().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      // If username is being changed, check if it's available
      if (input.username && input.username !== ctx.user.username) {
        const existingUser = await db.user.findUnique({
          where: { username: input.username },
          select: { id: true }
        })

        if (existingUser) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Username is already taken. Please choose a different username.'
          })
        }
      }

      const user = await db.user.update({
        where: { id: ctx.user.id },
        data: input,
        include: { preferences: true }
      })

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
        bio: user.bio,
        role: user.role,
        emailVerified: user.emailVerified,
        preferences: user.preferences
      }
    }),

  // Change password
  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8),
      confirmPassword: z.string().min(8)
    }))
    .mutation(async ({ input, ctx }) => {
      const { currentPassword, newPassword, confirmPassword } = input

      // Verify passwords match
      if (newPassword !== confirmPassword) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'New passwords do not match'
        })
      }

      // Verify current password
      const isValidPassword = await verifyPassword(currentPassword, ctx.user.password)
      
      if (!isValidPassword) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Current password is incorrect'
        })
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword)

      // Update password
      await db.user.update({
        where: { id: ctx.user.id },
        data: { password: hashedPassword }
      })

      // Log security event
      const logCtx = extractLogContext(ctx.req)
      await logSecurityEvent(
        ctx.user.id,
        'password_changed',
        { username: ctx.user.username },
        logCtx.ipAddress,
        logCtx.userAgent
      )

      return { success: true }
    }),

  // Refresh token
  refreshToken: publicProcedure
    .input(z.object({
      refreshToken: z.string()
    }))
    .mutation(async ({ input }) => {
      const { refreshToken } = input

      const tokens = await refreshSession(refreshToken)
      if (!tokens) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired refresh token'
        })
      }

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt
      }
    }),

  // Logout
  logout: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Revoke current session
      const session = await db.userSession.findFirst({
        where: {
          userId: ctx.user.id,
          isActive: true
        }
      })

      if (session) {
        await revokeSession(session.id)
      }

      // Log logout event
      await logSecurityEvent(
        ctx.user.id,
        'logout',
        { sessionId: session?.id },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return { success: true }
    }),

  // Logout from all devices
  logoutAll: protectedProcedure
    .mutation(async ({ ctx }) => {
      await revokeAllUserSessions(ctx.user.id)

      // Log logout all event
      await logSecurityEvent(
        ctx.user.id,
        'logout_all_devices',
        {},
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return { success: true }
    }),

  // Forgot password
  forgotPassword: publicProcedure
    .input(z.object({
      email: z.string().email()
    }))
    .mutation(async ({ input, ctx }) => {
      const { email } = input
      const logContext = extractLogContext(ctx.req)
      const ipAddress = logContext.ipAddress || 'unknown'

      // Rate limit: 3 password reset attempts per hour per IP
      checkRateLimit(ipAddress, 'passwordReset', 'forgot-password')

      const user = await db.user.findUnique({
        where: { email }
      })

      if (!user) {
        // Don't reveal if user exists or not for security
        return { success: true }
      }

      // Send password reset email
      await sendPasswordReset(email)

      // Log password reset request
      await logSecurityEvent(
        user.id,
        'password_reset_requested',
        { email },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return { success: true }
    }),

  // Reset password
  resetPassword: publicProcedure
    .input(z.object({
      token: z.string(),
      newPassword: z.string().min(8).max(128)
    }))
    .mutation(async ({ input, ctx }) => {
      const { token, newPassword } = input

      const success = await resetPassword(token, newPassword)
      if (!success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid or expired reset token'
        })
      }

      // Find user to log the event
      const user = await db.user.findFirst({
        where: { passwordResetToken: token }
      })

      if (user) {
        await logSecurityEvent(
          user.id,
          'password_reset_completed',
          {},
          ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
          ctx.req?.headers.get('user-agent') || undefined
        )
      }

      return { success: true }
    }),

  // Verify email
  verifyEmail: publicProcedure
    .input(z.object({
      token: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const { token } = input

      const success = await verifyEmailToken(token)
      if (!success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid or expired verification token'
        })
      }

      // Find user to log the event
      const user = await db.user.findFirst({
        where: { emailVerificationToken: token }
      })

      if (user) {
        await logSecurityEvent(
          user.id,
          'email_verified',
          {},
          ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
          ctx.req?.headers.get('user-agent') || undefined
        )
      }

      return { success: true }
    }),

  // Resend email verification
  resendVerification: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Rate limit: 5 email verifications per hour per user
      checkRateLimit(ctx.user.id, 'email', 'resend-verification')

      if (ctx.user.emailVerified) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Email is already verified'
        })
      }

      await sendEmailVerification(ctx.user.email, ctx.user.username)

      await logSecurityEvent(
        ctx.user.id,
        'verification_email_resent',
        {},
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return { success: true }
    }),

  // Get user sessions
  getSessions: protectedProcedure
    .query(async ({ ctx }) => {
      const sessions = await db.userSession.findMany({
        where: {
          userId: ctx.user.id,
          isActive: true
        },
        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
          deviceInfo: true,
          createdAt: true,
          expiresAt: true
        },
        orderBy: { createdAt: 'desc' }
      })

      return sessions
    }),

  // Revoke specific session
  revokeSession: protectedProcedure
    .input(z.object({
      sessionId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const { sessionId } = input

      const session = await db.userSession.findFirst({
        where: {
          id: sessionId,
          userId: ctx.user.id,
          isActive: true
        }
      })

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found'
        })
      }

      await revokeSession(sessionId)

      await logSecurityEvent(
        ctx.user.id,
        'session_revoked',
        { sessionId },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return { success: true }
    }),

  // GDPR: Export user data
  exportData: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userData = await exportUserData(ctx.user.id)
      
      await logSecurityEvent(
        ctx.user.id,
        'data_export_requested',
        {},
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return userData
    }),

  // GDPR: Delete user account
  deleteAccount: protectedProcedure
    .input(z.object({
      password: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const { password } = input

      // Verify password before deletion
      const isValidPassword = await verifyPassword(password, ctx.user.password)
      if (!isValidPassword) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid password'
        })
      }

      const success = await deleteUserData(ctx.user.id)
      if (!success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete account'
        })
      }

      await logSecurityEvent(
        ctx.user.id,
        'account_deleted',
        {},
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return { success: true }
    })
})
