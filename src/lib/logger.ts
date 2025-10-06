import { AppError, ErrorCode } from './errors'

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

export interface LogContext {
  requestId?: string
  userId?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  method?: string
  url?: string
  duration?: number
  [key: string]: any
}

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: LogContext
  error?: {
    code: ErrorCode
    message: string
    stack?: string
    details?: any
  }
  metadata?: any
}

class Logger {
  private isDevelopment: boolean
  private logLevel: LogLevel

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development'
    this.logLevel = this.getLogLevel()
  }

  private getLogLevel(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase()
    switch (envLevel) {
      case 'error':
        return LogLevel.ERROR
      case 'warn':
        return LogLevel.WARN
      case 'info':
        return LogLevel.INFO
      case 'debug':
        return LogLevel.DEBUG
      default:
        return this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG]
    const currentLevelIndex = levels.indexOf(this.logLevel)
    const messageLevelIndex = levels.indexOf(level)
    return messageLevelIndex <= currentLevelIndex
  }

  private formatLogEntry(level: LogLevel, message: string, context?: LogContext, error?: any, metadata?: any): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error: error ? {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'Unknown error',
        stack: error.stack,
        details: error.details,
      } : undefined,
      metadata,
    }
  }

  private output(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return
    }

    if (this.isDevelopment) {
      // Pretty print for development
      const color = this.getColorForLevel(entry.level)
      const prefix = `[${entry.timestamp}] ${entry.level.toUpperCase()}`
      
      console.log(`\x1b[${color}m${prefix}\x1b[0m ${entry.message}`)
      
      if (entry.context) {
        console.log('  Context:', JSON.stringify(entry.context, null, 2))
      }
      
      if (entry.error) {
        console.log('  Error:', JSON.stringify(entry.error, null, 2))
      }
      
      if (entry.metadata) {
        console.log('  Metadata:', JSON.stringify(entry.metadata, null, 2))
      }
    } else {
      // JSON format for production
      console.log(JSON.stringify(entry))
    }
  }

  private getColorForLevel(level: LogLevel): number {
    switch (level) {
      case LogLevel.ERROR:
        return 31 // Red
      case LogLevel.WARN:
        return 33 // Yellow
      case LogLevel.INFO:
        return 36 // Cyan
      case LogLevel.DEBUG:
        return 37 // White
      default:
        return 37
    }
  }

  // Public logging methods
  error(message: string, error?: AppError | Error, context?: LogContext, metadata?: any): void {
    this.output(this.formatLogEntry(LogLevel.ERROR, message, context, error, metadata))
  }

  warn(message: string, context?: LogContext, metadata?: any): void {
    this.output(this.formatLogEntry(LogLevel.WARN, message, context, undefined, metadata))
  }

  info(message: string, context?: LogContext, metadata?: any): void {
    this.output(this.formatLogEntry(LogLevel.INFO, message, context, undefined, metadata))
  }

  debug(message: string, context?: LogContext, metadata?: any): void {
    this.output(this.formatLogEntry(LogLevel.DEBUG, message, context, undefined, metadata))
  }

  // Specialized logging methods
  auth(message: string, context?: LogContext, metadata?: any): void {
    this.info(`[AUTH] ${message}`, { ...context, category: 'auth' }, metadata)
  }

  security(message: string, context?: LogContext, metadata?: any): void {
    this.warn(`[SECURITY] ${message}`, { ...context, category: 'security' }, metadata)
  }

  database(message: string, context?: LogContext, metadata?: any): void {
    this.debug(`[DATABASE] ${message}`, { ...context, category: 'database' }, metadata)
  }

  email(message: string, context?: LogContext, metadata?: any): void {
    this.info(`[EMAIL] ${message}`, { ...context, category: 'email' }, metadata)
  }

  api(message: string, context?: LogContext, metadata?: any): void {
    this.info(`[API] ${message}`, { ...context, category: 'api' }, metadata)
  }

  // Performance logging
  performance(message: string, duration: number, context?: LogContext, metadata?: any): void {
    this.info(`[PERFORMANCE] ${message}`, { ...context, duration, category: 'performance' }, metadata)
  }

  // Request logging
  request(method: string, url: string, context?: LogContext, metadata?: any): void {
    this.info(`[REQUEST] ${method} ${url}`, { ...context, method, url, category: 'request' }, metadata)
  }

  // Response logging
  response(method: string, url: string, statusCode: number, duration: number, context?: LogContext, metadata?: any): void {
    const level = statusCode >= 400 ? LogLevel.ERROR : LogLevel.INFO
    this.output(this.formatLogEntry(level, `[RESPONSE] ${method} ${url} ${statusCode}`, { ...context, method, url, statusCode, duration, category: 'response' }, undefined, metadata))
  }
}

// Create singleton instance
export const logger = new Logger()

// Utility functions for common logging scenarios
export const logAuth = {
  login: (email: string, success: boolean, context?: LogContext) => {
    logger.auth(`Login ${success ? 'successful' : 'failed'} for ${email}`, context, { email, success })
  },
  
  logout: (userId: string, context?: LogContext) => {
    logger.auth(`User ${userId} logged out`, context, { userId })
  },
  
  registration: (email: string, success: boolean, context?: LogContext) => {
    logger.auth(`Registration ${success ? 'successful' : 'failed'} for ${email}`, context, { email, success })
  },
  
  passwordReset: (email: string, success: boolean, context?: LogContext) => {
    logger.auth(`Password reset ${success ? 'requested' : 'failed'} for ${email}`, context, { email, success })
  },
  
  emailVerification: (email: string, success: boolean, context?: LogContext) => {
    logger.auth(`Email verification ${success ? 'successful' : 'failed'} for ${email}`, context, { email, success })
  },
  
  accountLocked: (userId: string, reason: string, context?: LogContext) => {
    logger.security(`Account locked for user ${userId}: ${reason}`, context, { userId, reason })
  },
  
  suspiciousActivity: (userId: string, activity: string, context?: LogContext) => {
    logger.security(`Suspicious activity detected for user ${userId}: ${activity}`, context, { userId, activity })
  },
}

export const logError = {
  validation: (field: string, message: string, context?: LogContext) => {
    logger.error(`Validation error in field '${field}': ${message}`, undefined, context, { field, message })
  },
  
  database: (operation: string, error: Error, context?: LogContext) => {
    logger.error(`Database error during ${operation}`, error, context, { operation })
  },
  
  email: (operation: string, error: Error, context?: LogContext) => {
    logger.error(`Email error during ${operation}`, error, context, { operation })
  },
  
  external: (service: string, error: Error, context?: LogContext) => {
    logger.error(`External service error: ${service}`, error, context, { service })
  },
  
  unexpected: (error: Error, context?: LogContext) => {
    logger.error('Unexpected error occurred', error, context)
  },
}

export const logPerformance = {
  slowQuery: (query: string, duration: number, context?: LogContext) => {
    if (duration > 1000) { // Log queries slower than 1 second
      logger.performance(`Slow database query: ${duration}ms`, duration, context, { query })
    }
  },
  
  slowRequest: (method: string, url: string, duration: number, context?: LogContext) => {
    if (duration > 2000) { // Log requests slower than 2 seconds
      logger.performance(`Slow request: ${method} ${url}`, duration, context, { method, url })
    }
  },
  
  memoryUsage: (usage: NodeJS.MemoryUsage, context?: LogContext) => {
    logger.performance('Memory usage', 0, context, usage)
  },
}

// Request ID generator
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Context extractor from request
export function extractLogContext(req: Request, userId?: string): LogContext {
  return {
    requestId: req.headers.get('x-request-id') || generateRequestId(),
    userId,
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
    userAgent: req.headers.get('user-agent') || 'unknown',
    method: req.method,
    url: req.url,
  }
}
