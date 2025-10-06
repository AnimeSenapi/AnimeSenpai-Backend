import { Request, Response } from 'express'
import { AppError, createError, handleError, formatErrorResponse } from './errors'
import { logger, extractLogContext, generateRequestId } from './logger'

// Request timing middleware
export function requestTimingMiddleware(req: Request, res: Response, next: Function) {
  const startTime = Date.now()
  const requestId = req.headers['x-request-id'] as string || generateRequestId()
  
  // Add request ID to headers
  req.headers['x-request-id'] = requestId
  res.setHeader('x-request-id', requestId)
  
  // Override res.end to log response time
  const originalEnd = res.end
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime
    const logContext = extractLogContext(req as any, (req as any).user?.id)
    
    logger.response(
      req.method,
      req.url,
      res.statusCode,
      duration,
      logContext,
      { 
        contentLength: res.getHeader('content-length'),
        userAgent: req.get('user-agent'),
      }
    )
    
    // Log slow requests
    if (duration > 2000) {
      logger.performance(`Slow request: ${req.method} ${req.url}`, duration, logContext, {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
      })
    }
    
    return originalEnd.call(this, chunk, encoding)
  }
  
  next()
}

// Error handling middleware
export function errorHandlingMiddleware(error: any, req: Request, res: Response, next: Function) {
  const logContext = extractLogContext(req as any, (req as any).user?.id)
  
  // Handle different types of errors
  let appError: AppError
  
  if (error instanceof AppError) {
    appError = error
  } else if (error.name === 'ValidationError') {
    appError = createError.validationError(
      error.message || 'Validation failed',
      error.field,
      { originalError: error.message }
    )
  } else if (error.name === 'CastError') {
    appError = createError.invalidInput(
      `Invalid ${error.path}: ${error.value}`,
      error.path
    )
  } else if (error.name === 'MongoError' || error.name === 'MongooseError') {
    appError = createError.databaseError(
      'Database operation failed',
      { originalError: error.message, code: error.code }
    )
  } else if (error.name === 'JsonWebTokenError') {
    appError = createError.tokenInvalid()
  } else if (error.name === 'TokenExpiredError') {
    appError = createError.tokenExpired()
  } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    appError = createError.externalServiceError(
      'External service unavailable',
      { originalError: error.message, code: error.code }
    )
  } else if (error.status === 429) {
    appError = createError.rateLimitExceeded(100, '15 minutes')
  } else {
    appError = handleError(error, logContext)
  }
  
  // Log the error
  logger.error(
    `Unhandled error in ${req.method} ${req.url}`,
    appError,
    logContext,
    {
      method: req.method,
      url: req.url,
      body: req.body,
      query: req.query,
      params: req.params,
      headers: {
        'user-agent': req.get('user-agent'),
        'content-type': req.get('content-type'),
        'authorization': req.get('authorization') ? '[REDACTED]' : undefined,
      }
    }
  )
  
  // Send error response
  const statusCode = getHttpStatusFromErrorCode(appError.code)
  const includeDetails = process.env.NODE_ENV === 'development'
  
  res.status(statusCode).json(formatErrorResponse(appError, includeDetails))
}

// CORS error handling
export function corsErrorHandler(error: any, req: Request, res: Response, next: Function) {
  if (error) {
    const logContext = extractLogContext(req as any)
    logger.error('CORS error', error, logContext, {
      origin: req.get('origin'),
      method: req.method,
      url: req.url,
    })
    
    res.status(403).json({
      error: {
        code: 'CORS_ERROR',
        message: 'CORS policy violation',
        timestamp: new Date().toISOString(),
      }
    })
  } else {
    next()
  }
}

// Rate limiting error handler
export function rateLimitErrorHandler(req: Request, res: Response) {
  const logContext = extractLogContext(req as any)
  const error = createError.rateLimitExceeded(100, '15 minutes')
  
  logger.security('Rate limit exceeded', logContext, {
    ipAddress: logContext.ipAddress,
    userAgent: logContext.userAgent,
    method: req.method,
    url: req.url,
  })
  
  res.status(429).json({
    error: {
      code: error.code,
      message: error.message,
      timestamp: error.timestamp,
      retryAfter: 900, // 15 minutes in seconds
    }
  })
}

// Security headers middleware
export function securityHeadersMiddleware(req: Request, res: Response, next: Function) {
  // Remove X-Powered-By header
  res.removeHeader('X-Powered-By')
  
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ')
  
  res.setHeader('Content-Security-Policy', csp)
  
  next()
}

// Request logging middleware
export function requestLoggingMiddleware(req: Request, res: Response, next: Function) {
  const logContext = extractLogContext(req as any)
  
  // Log the request
  logger.request(req.method, req.url, logContext, {
    body: req.method !== 'GET' ? req.body : undefined,
    query: req.query,
    params: req.params,
    contentLength: req.get('content-length'),
    contentType: req.get('content-type'),
  })
  
  next()
}

// Health check middleware
export function healthCheckMiddleware(req: Request, res: Response, next: Function) {
  if (req.path === '/health' || req.path === '/api/health') {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    }
    
    res.json(health)
    return
  }
  
  next()
}

// Maintenance mode middleware
export function maintenanceModeMiddleware(req: Request, res: Response, next: Function) {
  const isMaintenanceMode = process.env.MAINTENANCE_MODE === 'true'
  
  if (isMaintenanceMode && req.path !== '/health') {
    const error = createError.maintenanceMode()
    
    logger.warn('Request blocked due to maintenance mode', undefined, {
      ...extractLogContext(req as any),
      method: req.method,
      url: req.url,
      ipAddress: req.ip,
    })
    
    res.status(503).json(formatErrorResponse(error))
    return
  }
  
  next()
}

// Request size limiting middleware
export function requestSizeLimitMiddleware(maxSize: number = 10 * 1024 * 1024) { // 10MB default
  return (req: Request, res: Response, next: Function) => {
    const contentLength = parseInt(req.get('content-length') || '0')
    
    if (contentLength > maxSize) {
      const error = createError.validationError(
        `Request too large. Maximum size is ${maxSize} bytes`,
        'body',
        { maxSize, actualSize: contentLength }
      )
      
      logger.warn('Request size limit exceeded', undefined, {
        ...extractLogContext(req as any),
        maxSize,
        actualSize: contentLength,
        method: req.method,
        url: req.url,
      })
      
      res.status(413).json(formatErrorResponse(error))
      return
    }
    
    next()
  }
}

// Helper function to get HTTP status from error code
function getHttpStatusFromErrorCode(code: string): number {
  switch (code) {
    case 'VALIDATION_ERROR':
    case 'INVALID_INPUT':
    case 'MISSING_REQUIRED_FIELD':
    case 'INVALID_EMAIL_FORMAT':
    case 'PASSWORD_TOO_WEAK':
    case 'PASSWORD_TOO_LONG':
    case 'EMAIL_ALREADY_VERIFIED':
    case 'GDPR_CONSENT_REQUIRED':
    case 'DATA_PROCESSING_CONSENT_REQUIRED':
      return 400
    
    case 'INVALID_CREDENTIALS':
    case 'TOKEN_EXPIRED':
    case 'TOKEN_INVALID':
    case 'SESSION_EXPIRED':
    case 'SESSION_INVALID':
    case 'UNAUTHORIZED':
      return 401
    
    case 'ACCOUNT_LOCKED':
    case 'ACCOUNT_NOT_VERIFIED':
    case 'FORBIDDEN':
    case 'INSUFFICIENT_PERMISSIONS':
      return 403
    
    case 'USER_NOT_FOUND':
    case 'ANIME_NOT_FOUND':
    case 'RESOURCE_NOT_FOUND':
      return 404
    
    case 'USER_ALREADY_EXISTS':
    case 'RESOURCE_ALREADY_EXISTS':
      return 409
    
    case 'RATE_LIMIT_EXCEEDED':
    case 'TOO_MANY_REQUESTS':
      return 429
    
    case 'DATABASE_ERROR':
    case 'DATABASE_CONNECTION_ERROR':
    case 'DATABASE_CONSTRAINT_ERROR':
    case 'EMAIL_SEND_FAILED':
    case 'EMAIL_VERIFICATION_FAILED':
    case 'ACCOUNT_DELETION_FAILED':
    case 'INTERNAL_SERVER_ERROR':
    case 'EXTERNAL_SERVICE_ERROR':
    case 'EMAIL_SERVICE_ERROR':
    case 'PAYMENT_SERVICE_ERROR':
      return 500
    
    case 'SERVICE_UNAVAILABLE':
    case 'MAINTENANCE_MODE':
      return 503
    
    default:
      return 500
  }
}

// Export all middleware
export const middleware = {
  requestTiming: requestTimingMiddleware,
  errorHandling: errorHandlingMiddleware,
  corsError: corsErrorHandler,
  rateLimitError: rateLimitErrorHandler,
  securityHeaders: securityHeadersMiddleware,
  requestLogging: requestLoggingMiddleware,
  healthCheck: healthCheckMiddleware,
  maintenanceMode: maintenanceModeMiddleware,
  requestSizeLimit: requestSizeLimitMiddleware,
}
