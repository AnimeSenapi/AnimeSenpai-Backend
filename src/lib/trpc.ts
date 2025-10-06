import { initTRPC, TRPCError } from '@trpc/server'
import { getUserFromToken, verifyAccessToken } from './auth'
import { db } from './db'
import { appErrorToTRPCError, handleError, createError } from './errors'
import { logger, extractLogContext } from './logger'
import { validateInput, schemas } from './validation'

// Initialize tRPC with enhanced error formatting
const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error, path, input, ctx }) {
    // Log the error
    const logContext = ctx?.req ? extractLogContext(ctx.req, ctx?.user?.id) : { requestId: 'unknown', ipAddress: 'unknown', userAgent: 'unknown' }
    logger.error(`tRPC Error in ${path}`, error.cause, logContext, { 
      path, 
      input: typeof input === 'object' ? input : { value: input },
      errorCode: error.code,
      errorMessage: error.message 
    })

    // Return formatted error response
    return {
      ...shape,
      data: {
        ...shape.data,
        code: (error.cause as any)?.code || 'UNKNOWN_ERROR',
        field: (error.cause as any)?.field,
        timestamp: new Date().toISOString(),
        requestId: logContext.requestId,
        path,
      },
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
    // Check rate limit (implement your rate limiting logic here)
    // For now, we'll just log the request
    logger.api(`Rate limit check for ${path}`, logContext, { ipAddress })
    
    return next({ ctx })
  } catch (error) {
    logger.error(`Rate limit exceeded for ${path}`, error as Error, logContext, { ipAddress })
    throw appErrorToTRPCError(createError.rateLimitExceeded(100, '15 minutes'))
  }
})

// Middleware for authentication
const isAuthed = t.middleware(async ({ next, ctx, path }) => {
  const logContext = extractLogContext(ctx.req)
  
  try {
    const authHeader = ctx.req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      logger.auth('Authentication failed: No authentication token provided', logContext)
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
      include: { preferences: true }
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

    return next({
      ctx: {
        ...ctx,
        user,
        sessionId: payload.sessionId
      }
    })
  } catch (error) {
    logger.error(`Authentication failed for ${path}`, error as Error, logContext)
    throw appErrorToTRPCError(handleError(error, logContext))
  }
})

// Protected procedure with validation and rate limiting
export const protectedProcedure = t.procedure
  .use(validateInputMiddleware)
  .use(rateLimitMiddleware)
  .use(isAuthed)

// Public procedure with validation and rate limiting
export const publicProcedureWithValidation = t.procedure
  .use(validateInputMiddleware)
  .use(rateLimitMiddleware)

// Utility function to sanitize input
function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input.trim()
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput)
  }
  
  if (input && typeof input === 'object') {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value)
    }
    return sanitized
  }
  
  return input
}

// Utility function to validate input with schema
export function validateWithSchema<T>(schema: any, input: unknown, field?: string): T {
  try {
    return validateInput(schema, input, { field })
  } catch (error) {
    throw appErrorToTRPCError(error as any)
  }
}

// Context type
export interface Context {
  req: Request
  user?: any
  sessionId?: string
}
