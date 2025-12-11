import { initTRPC, TRPCError } from '@trpc/server'
import { Prisma } from '@prisma/client'
import { verifyAccessToken } from './auth.js'
import { db } from './db.js'
import { appErrorToTRPCError, handleError, createError } from './errors.js'
import { logger, extractLogContext } from './logger.js'
import { validateInput } from './validation.js'

// Initialize tRPC with enhanced error formatting
const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error, path, input, ctx }) {
    // Log the error
    const logContext = ctx?.req ? extractLogContext(ctx.req, ctx?.user?.id) : { requestId: 'unknown', ipAddress: 'unknown', userAgent: 'unknown' }
    
    // Check for Prisma Accelerate API key errors (P6002)
    let errorMessage = error.message
    let errorCode = (error.cause as { code?: string })?.code || 'UNKNOWN_ERROR'
    
    // Check for Prisma Accelerate API key errors in various formats
    const errorString = JSON.stringify(error)
    const isAccelerateError = 
      errorString.includes('P6002') ||
      errorString.includes('API key is invalid') ||
      errorString.includes('API Key is invalid') ||
      error.message.includes('P6002') ||
      error.message.includes('API key is invalid') ||
      error.message.includes('API Key is invalid')
    
    if (isAccelerateError) {
      errorMessage = 'Database connection error: Invalid Prisma Accelerate API key. Please update your DATABASE_URL in the backend .env file to use a direct PostgreSQL connection (e.g., postgresql://user:password@host:5432/database) or provide a valid Accelerate API key.'
        errorCode = 'DATABASE_CONFIGURATION_ERROR'
      logger.error(`Prisma Accelerate API key error in ${path}`, error, logContext, {
          path,
        code: 'P6002',
        message: 'Invalid Accelerate API key - check DATABASE_URL in backend .env file',
        errorMessage: error.message,
        errorString: errorString.substring(0, 500)
        })
    } else if (error.cause instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error(`Prisma error in ${path}`, error.cause, logContext, { 
          path, 
          input: typeof input === 'object' ? input : { value: input },
          errorCode: error.cause.code,
          errorMessage: error.cause.message 
        })
    } else {
      logger.error(`tRPC Error in ${path}`, error.cause || error, logContext, { 
        path, 
        input: typeof input === 'object' ? input : { value: input },
        errorCode,
        errorMessage
      })
    }

    // Return formatted error response
    const errorField = (error.cause as { field?: string })?.field
    return {
      ...shape,
      data: {
        ...shape.data,
        code: errorCode,
        ...(errorField && { field: errorField }),
        timestamp: new Date().toISOString(),
        requestId: logContext.requestId,
        path,
      },
      message: errorMessage,
    }
  },
})

// Base router and procedure helpers
export const router = t.router
export const publicProcedure = t.procedure

// Input validation middleware - temporarily disabled to fix input parsing
const validateInputMiddleware = t.middleware(async ({ next, ctx }) => {
  return next({ ctx })
})

// Rate limiting middleware
const rateLimitMiddleware = t.middleware(async ({ next, ctx, path }) => {
  const logContext = extractLogContext(ctx.req, ctx.user?.id)
  const ipAddress = logContext.ipAddress || 'unknown'
  
  try {
    // Import rate limiter
    const { checkRateLimit } = await import('./rate-limiter.js')
    
    // Use IP address as identifier for unauthenticated requests
    const identifier = ctx.user?.id || ipAddress
    
    // Determine rate limit type based on authentication
    const rateLimitType = ctx.user ? 'authenticated' : 'public'
    
    // Check rate limit
    checkRateLimit(identifier, rateLimitType, path)
    
    logger.api(`Rate limit check passed for ${path}`, logContext, { 
      ipAddress,
      identifier,
      type: rateLimitType
    })
    
    return next({ ctx })
  } catch (error) {
    logger.error(`Rate limit exceeded for ${path}`, error as Error, logContext, { ipAddress })
    throw error // Re-throw the TRPCError from checkRateLimit
  }
})

// CSRF middleware for mutating requests
const csrfProtect = t.middleware(async ({ next, ctx }) => {
  const method = ctx.req.method || 'GET'
  const isMutation = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE'
  if (!isMutation) return next({ ctx })

  const origin = ctx.req.headers.get('origin') || ''
  const referer = ctx.req.headers.get('referer') || ''
  const allowedOrigins = new Set<string>([
    'https://animesenpai.app',
    'https://www.animesenpai.app',
    'http://localhost:3000',
  ])
  const isVercelPreview = origin.endsWith('.vercel.app')
  const isAllowedOrigin = allowedOrigins.has(origin) || isVercelPreview
  if (origin && !isAllowedOrigin) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Invalid request origin' })
  }
  if (referer && !(referer.startsWith('https://animesenpai.app') || referer.startsWith('https://www.animesenpai.app') || referer.startsWith('http://localhost:3000') || referer.includes('.vercel.app'))) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Invalid referrer' })
  }

  // Double submit cookie validation
  const cookie = ctx.req.headers.get('cookie') || ''
  const headerToken = ctx.req.headers.get('x-csrf-token') || ''
  const cookieToken = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('csrf_token='))?.split('=')[1] || ''
  const { verifyDoubleSubmitToken } = await import('./csrf.js')
  if (!verifyDoubleSubmitToken(cookieToken, headerToken)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'CSRF validation failed' })
  }

  return next({ ctx })
})

// Middleware for authentication
const isAuthed = t.middleware(async ({ next, ctx, path }) => {
  const logContext = extractLogContext(ctx.req)
  
  try {
    const authHeader = ctx.req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      // Don't log as error - this is expected when users aren't signed in
      throw createError.unauthorized('No authentication token provided')
    }

    // Verify access token
    const payload = verifyAccessToken(token)
    if (!payload) {
      logger.auth('Authentication failed: Invalid or expired token', logContext)
      throw createError.tokenInvalid()
    }

    // Get user from database
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      include: { 
        preferences: true,
        primaryRole: true
      }
    })

    if (!user) {
      logger.auth('Authentication failed: User not found', logContext, { userId: payload.userId })
      throw createError.userNotFound(payload.userId)
    }

    // Check if session is still active (if sessionId is provided)
    if (payload.sessionId) {
      const session = await db.userSession.findFirst({
        where: {
          id: payload.sessionId,
          userId: user.id,
          isActive: true,
          expiresAt: { gt: new Date() }
        }
      })

      if (!session) {
        logger.auth('Authentication failed: Session expired or invalid', logContext, { userId: user.id, sessionId: payload.sessionId })
        throw createError.sessionExpired()
      }

      // Update last activity
      await db.userSession.update({
        where: { id: payload.sessionId },
        data: { updatedAt: new Date() }
      })
    }

    logger.auth(`Authenticated request to ${path}`, { ...logContext, userId: user.id })

    // Add role property for backward compatibility
    const userWithRole = {
      ...user,
      role: user.primaryRole?.name || 'user'
    }

    return next({
      ctx: {
        ...ctx,
        user: userWithRole,
        sessionId: payload.sessionId
      }
    })
  } catch (error) {
    // Only log unexpected auth errors, not missing tokens (which are expected for public pages)
    if (error instanceof Error && !error.message.includes('No authentication token provided')) {
      logger.error(`Authentication failed for ${path}`, error as Error, logContext)
    }
    throw appErrorToTRPCError(handleError(error, logContext))
  }
})

// Protected procedure with validation, CSRF, and rate limiting
export const protectedProcedure = t.procedure
  .use(validateInputMiddleware)
  .use(csrfProtect)
  .use(rateLimitMiddleware)
  .use(isAuthed)

// Public procedure with validation and rate limiting
export const publicProcedureWithValidation = t.procedure
  .use(validateInputMiddleware)
  .use(rateLimitMiddleware)

// Utility function to validate input with schema
export function validateWithSchema<T>(schema: any, input: unknown, field?: string): T {
  try {
    return validateInput(schema, input, { ...(field !== undefined && { field }) })
  } catch (error) {
    throw appErrorToTRPCError(handleError(error))
  }
}

// Context type
export interface Context {
  req: Request
  user?: any
  sessionId?: string
}
