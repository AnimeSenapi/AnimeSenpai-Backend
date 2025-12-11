/**
 * Enhanced Error Handling Service
 * 
 * Provides comprehensive error handling, recovery strategies, and error reporting
 * for the AnimeSenpai backend system.
 */

import { AppError, ErrorCode } from './errors.js'
import { logger } from './logger.js'

// Error context interface
interface ErrorContext {
  userId?: string
  requestId?: string
  endpoint?: string
  method?: string
  userAgent?: string
  ipAddress?: string
  timestamp: number
  stack?: string
  metadata?: any
}

// Error recovery strategies
enum RecoveryStrategy {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  CIRCUIT_BREAKER = 'circuit_breaker',
  GRACEFUL_DEGRADATION = 'graceful_degradation',
  MANUAL_INTERVENTION = 'manual_intervention',
}

// Error severity levels
enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Error classification
interface ErrorClassification {
  category: 'validation' | 'authentication' | 'authorization' | 'database' | 'network' | 'business' | 'system'
  severity: ErrorSeverity
  recoverable: boolean
  strategy: RecoveryStrategy
  userFriendly: boolean
  shouldAlert: boolean
  retryable: boolean
}

class ErrorHandler {
  private errorCounts = new Map<string, number>()
  private circuitBreakers = new Map<string, { failures: number; lastFailure: number; state: 'closed' | 'open' | 'half-open' }>()
  private retryAttempts = new Map<string, number>()

  /**
   * Handle and process errors
   */
  async handleError(
    error: Error | AppError,
    context: Partial<ErrorContext> = {}
  ): Promise<{ error: AppError; shouldRetry: boolean; recoveryAction?: string }> {
    const fullContext: ErrorContext = {
      timestamp: Date.now(),
      ...context,
    }

    // Classify the error
    const classification = this.classifyError(error)
    
    // Create standardized error
    const appError = this.createAppError(error, classification, fullContext)
    
    // Log the error
    await this.logError(appError, fullContext, classification)
    
    // Update error counts
    this.updateErrorCounts(appError.code)
    
    // Check circuit breakers
    const circuitState = this.checkCircuitBreaker(appError.code)
    
    // Determine recovery strategy
    const { shouldRetry, recoveryAction } = this.determineRecoveryStrategy(
      appError,
      classification,
      circuitState
    )

    // Send alerts if needed
    if (classification.shouldAlert) {
      await this.sendAlert(appError, fullContext, classification)
    }

    return {
      error: appError,
      shouldRetry,
      ...(recoveryAction !== undefined && { recoveryAction }),
    }
  }

  /**
   * Classify error type and severity
   */
  private classifyError(error: Error | AppError): ErrorClassification {
    if (error instanceof AppError) {
      return this.classifyAppError(error)
    }

    // Classify generic errors
    const message = error.message.toLowerCase()

    // Database errors
    if (message.includes('database') || message.includes('connection') || message.includes('query')) {
      return {
        category: 'database',
        severity: ErrorSeverity.HIGH,
        recoverable: true,
        strategy: RecoveryStrategy.RETRY,
        userFriendly: false,
        shouldAlert: true,
        retryable: true,
      }
    }

    // Network errors
    if (message.includes('network') || message.includes('timeout') || message.includes('fetch')) {
      return {
        category: 'network',
        severity: ErrorSeverity.MEDIUM,
        recoverable: true,
        strategy: RecoveryStrategy.RETRY,
        userFriendly: false,
        shouldAlert: false,
        retryable: true,
      }
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return {
        category: 'validation',
        severity: ErrorSeverity.LOW,
        recoverable: false,
        strategy: RecoveryStrategy.MANUAL_INTERVENTION,
        userFriendly: true,
        shouldAlert: false,
        retryable: false,
      }
    }

    // Authentication errors
    if (message.includes('unauthorized') || message.includes('token') || message.includes('auth')) {
      return {
        category: 'authentication',
        severity: ErrorSeverity.MEDIUM,
        recoverable: false,
        strategy: RecoveryStrategy.MANUAL_INTERVENTION,
        userFriendly: true,
        shouldAlert: false,
        retryable: false,
      }
    }

    // Default classification
    return {
      category: 'system',
      severity: ErrorSeverity.HIGH,
      recoverable: true,
      strategy: RecoveryStrategy.MANUAL_INTERVENTION,
      userFriendly: false,
      shouldAlert: true,
      retryable: false,
    }
  }

  /**
   * Classify AppError instances
   */
  private classifyAppError(error: AppError): ErrorClassification {
    const code = error.code

    // Authentication errors
    if ([ErrorCode.INVALID_CREDENTIALS, ErrorCode.TOKEN_EXPIRED, ErrorCode.TOKEN_INVALID].includes(code)) {
      return {
        category: 'authentication',
        severity: ErrorSeverity.MEDIUM,
        recoverable: false,
        strategy: RecoveryStrategy.MANUAL_INTERVENTION,
        userFriendly: true,
        shouldAlert: false,
        retryable: false,
      }
    }

    // Authorization errors
    if ([ErrorCode.UNAUTHORIZED, ErrorCode.FORBIDDEN, ErrorCode.INSUFFICIENT_PERMISSIONS].includes(code)) {
      return {
        category: 'authorization',
        severity: ErrorSeverity.MEDIUM,
        recoverable: false,
        strategy: RecoveryStrategy.MANUAL_INTERVENTION,
        userFriendly: true,
        shouldAlert: false,
        retryable: false,
      }
    }

    // Validation errors
    if ([ErrorCode.VALIDATION_ERROR, ErrorCode.INVALID_INPUT, ErrorCode.MISSING_REQUIRED_FIELD].includes(code)) {
      return {
        category: 'validation',
        severity: ErrorSeverity.LOW,
        recoverable: false,
        strategy: RecoveryStrategy.MANUAL_INTERVENTION,
        userFriendly: true,
        shouldAlert: false,
        retryable: false,
      }
    }

    // Database errors
    if ([ErrorCode.DATABASE_ERROR, ErrorCode.DATABASE_CONNECTION_ERROR, ErrorCode.DATABASE_CONSTRAINT_ERROR].includes(code)) {
      return {
        category: 'database',
        severity: ErrorSeverity.HIGH,
        recoverable: true,
        strategy: RecoveryStrategy.RETRY,
        userFriendly: false,
        shouldAlert: true,
        retryable: true,
      }
    }

    // Rate limiting
    if ([ErrorCode.RATE_LIMIT_EXCEEDED, ErrorCode.TOO_MANY_REQUESTS].includes(code)) {
      return {
        category: 'business',
        severity: ErrorSeverity.LOW,
        recoverable: true,
        strategy: RecoveryStrategy.CIRCUIT_BREAKER,
        userFriendly: true,
        shouldAlert: false,
        retryable: true,
      }
    }

    // Resource not found
    if ([ErrorCode.USER_NOT_FOUND, ErrorCode.ANIME_NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND].includes(code)) {
      return {
        category: 'business',
        severity: ErrorSeverity.LOW,
        recoverable: false,
        strategy: RecoveryStrategy.MANUAL_INTERVENTION,
        userFriendly: true,
        shouldAlert: false,
        retryable: false,
      }
    }

    // Default for AppError
    return {
      category: 'system',
      severity: ErrorSeverity.MEDIUM,
      recoverable: true,
      strategy: RecoveryStrategy.MANUAL_INTERVENTION,
      userFriendly: false,
      shouldAlert: true,
      retryable: false,
    }
  }

  /**
   * Create standardized AppError
   */
  private createAppError(
    error: Error | AppError,
    classification: ErrorClassification,
    context: ErrorContext
  ): AppError {
    if (error instanceof AppError) {
      return error
    }

    // Convert generic error to AppError
    const errorCode = this.mapErrorToCode(error, classification)
    const message = classification.userFriendly 
      ? this.getUserFriendlyMessage(errorCode)
      : error.message

    return new AppError(
      errorCode,
      message,
      {
        originalError: error.message,
        stack: error.stack,
        classification,
        context,
      },
      undefined,
      context.requestId,
      context.userId
    )
  }

  /**
   * Map generic error to ErrorCode
   */
  private mapErrorToCode(_error: Error, classification: ErrorClassification): ErrorCode {
    switch (classification.category) {
      case 'database':
        return ErrorCode.DATABASE_ERROR
      case 'network':
        return ErrorCode.EXTERNAL_SERVICE_ERROR
      case 'validation':
        return ErrorCode.VALIDATION_ERROR
      case 'authentication':
        return ErrorCode.UNAUTHORIZED
      case 'authorization':
        return ErrorCode.FORBIDDEN
      default:
        return ErrorCode.INTERNAL_SERVER_ERROR
    }
  }

  /**
   * Get user-friendly error message
   */
  private getUserFriendlyMessage(code: ErrorCode): string {
    const messages: Record<ErrorCode, string> = {
      [ErrorCode.INVALID_CREDENTIALS]: 'Invalid email or password. Please try again.',
      [ErrorCode.ACCOUNT_LOCKED]: 'Your account has been temporarily locked. Please try again later.',
      [ErrorCode.ACCOUNT_NOT_VERIFIED]: 'Please verify your email address before continuing.',
      [ErrorCode.TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
      [ErrorCode.TOKEN_INVALID]: 'Invalid session. Please log in again.',
      [ErrorCode.UNAUTHORIZED]: 'You need to be logged in to access this resource.',
      [ErrorCode.FORBIDDEN]: 'You do not have permission to perform this action.',
      [ErrorCode.VALIDATION_ERROR]: 'Please check your input and try again.',
      [ErrorCode.INVALID_INPUT]: 'The provided data is invalid.',
      [ErrorCode.USER_NOT_FOUND]: 'User not found.',
      [ErrorCode.ANIME_NOT_FOUND]: 'Anime not found.',
      [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please slow down.',
      [ErrorCode.DATABASE_ERROR]: 'A temporary error occurred. Please try again.',
      [ErrorCode.EXTERNAL_SERVICE_ERROR]: 'External service is temporarily unavailable.',
      [ErrorCode.INTERNAL_SERVER_ERROR]: 'An unexpected error occurred. Please try again.',
      // Add more mappings as needed
    } as Record<ErrorCode, string>

    return messages[code] || 'An unexpected error occurred. Please try again.'
  }

  /**
   * Log error with appropriate level
   */
  private async logError(
    error: AppError,
    context: ErrorContext,
    classification: ErrorClassification
  ): Promise<void> {
    const logLevel = this.getLogLevel(classification.severity)
    const logContext = {
      ...(context.requestId !== undefined && { requestId: context.requestId }),
      ...(context.userId !== undefined && { userId: context.userId }),
      ...(context.endpoint !== undefined && { endpoint: context.endpoint }),
      ...(context.method !== undefined && { method: context.method }),
    }

    const metadata = {
      errorCode: error.code,
      severity: classification.severity,
      category: classification.category,
      recoverable: classification.recoverable,
      stack: context.stack,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
    }

    switch (logLevel) {
      case 'error':
        logger.error(error.message, error, logContext, metadata)
        break
      case 'warn':
        logger.warn(error.message, logContext, metadata)
        break
      case 'info':
        logger.info(error.message, logContext, metadata)
        break
      default:
        logger.debug(error.message, logContext, metadata)
    }
  }

  /**
   * Get log level based on severity
   */
  private getLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'info' | 'debug' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error'
      case ErrorSeverity.MEDIUM:
        return 'warn'
      case ErrorSeverity.LOW:
        return 'info'
      default:
        return 'debug'
    }
  }

  /**
   * Update error counts for monitoring
   */
  private updateErrorCounts(errorCode: ErrorCode): void {
    const count = this.errorCounts.get(errorCode) || 0
    this.errorCounts.set(errorCode, count + 1)
  }

  /**
   * Check circuit breaker state
   */
  private checkCircuitBreaker(errorCode: ErrorCode): 'closed' | 'open' | 'half-open' {
    const breaker = this.circuitBreakers.get(errorCode)
    if (!breaker) {
      this.circuitBreakers.set(errorCode, {
        failures: 0,
        lastFailure: 0,
        state: 'closed',
      })
      return 'closed'
    }

    const now = Date.now()
    const timeSinceLastFailure = now - breaker.lastFailure

    // Reset failures after 5 minutes
    if (timeSinceLastFailure > 5 * 60 * 1000) {
      breaker.failures = 0
      breaker.state = 'closed'
    }

    // Open circuit after 5 failures
    if (breaker.failures >= 5) {
      breaker.state = 'open'
    }

    return breaker.state
  }

  /**
   * Determine recovery strategy
   */
  private determineRecoveryStrategy(
    error: AppError,
    classification: ErrorClassification,
    circuitState: string
  ): { shouldRetry: boolean; recoveryAction?: string } {
    // Don't retry if circuit is open
    if (circuitState === 'open') {
      return {
        shouldRetry: false,
        recoveryAction: 'Circuit breaker is open. Manual intervention required.',
      }
    }

    // Don't retry if not retryable
    if (!classification.retryable) {
      return {
        shouldRetry: false,
        recoveryAction: 'Error is not retryable.',
      }
    }

    // Check retry attempts
    const retryKey = `${error.code}_${error.requestId || 'unknown'}`
    const attempts = this.retryAttempts.get(retryKey) || 0
    const maxAttempts = this.getMaxRetryAttempts(classification.category)

    if (attempts >= maxAttempts) {
      return {
        shouldRetry: false,
        recoveryAction: `Maximum retry attempts (${maxAttempts}) exceeded.`,
      }
    }

    // Increment retry attempts
    this.retryAttempts.set(retryKey, attempts + 1)

    return {
      shouldRetry: true,
      recoveryAction: `Retry attempt ${attempts + 1}/${maxAttempts}`,
    }
  }

  /**
   * Get maximum retry attempts by category
   */
  private getMaxRetryAttempts(category: string): number {
    switch (category) {
      case 'database':
        return 3
      case 'network':
        return 5
      case 'external':
        return 2
      default:
        return 1
    }
  }

  /**
   * Send alert for critical errors
   */
  private async sendAlert(
    error: AppError,
    context: ErrorContext,
    classification: ErrorClassification
  ): Promise<void> {
    try {
      // In a real implementation, you'd send alerts via email, Slack, etc.
      logger.error('ALERT: Critical error detected', error, {
        ...(context.requestId !== undefined && { requestId: context.requestId }),
        ...(context.userId !== undefined && { userId: context.userId }),
      }, {
        errorCode: error.code,
        severity: classification.severity,
        category: classification.category,
        endpoint: context.endpoint,
        method: context.method,
        timestamp: context.timestamp,
      })
    } catch (alertError) {
      logger.error('Failed to send alert', alertError as Error, undefined, {})
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number
    errorsByCode: Record<string, number>
    circuitBreakerStates: Record<string, string>
    retryAttempts: Record<string, number>
  } {
    return {
      totalErrors: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
      errorsByCode: Object.fromEntries(this.errorCounts),
      circuitBreakerStates: Object.fromEntries(
        Array.from(this.circuitBreakers.entries()).map(([key, value]) => [key, value.state])
      ),
      retryAttempts: Object.fromEntries(this.retryAttempts),
    }
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(errorCode: ErrorCode): void {
    this.circuitBreakers.delete(errorCode)
  }

  /**
   * Clear retry attempts
   */
  clearRetryAttempts(): void {
    this.retryAttempts.clear()
  }
}

// Singleton instance
export const errorHandler = new ErrorHandler()

export default errorHandler
