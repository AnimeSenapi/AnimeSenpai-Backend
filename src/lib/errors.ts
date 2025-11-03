import { TRPCError } from '@trpc/server'

// Custom Error Types
export enum ErrorCode {
  // Authentication Errors
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_NOT_VERIFIED = 'ACCOUNT_NOT_VERIFIED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_INVALID = 'SESSION_INVALID',
  
  // Authorization Errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Validation Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_EMAIL_FORMAT = 'INVALID_EMAIL_FORMAT',
  PASSWORD_TOO_WEAK = 'PASSWORD_TOO_WEAK',
  PASSWORD_TOO_LONG = 'PASSWORD_TOO_LONG',
  
  // Resource Errors
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  ANIME_NOT_FOUND = 'ANIME_NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  
  // Email Errors
  EMAIL_SEND_FAILED = 'EMAIL_SEND_FAILED',
  EMAIL_VERIFICATION_FAILED = 'EMAIL_VERIFICATION_FAILED',
  EMAIL_ALREADY_VERIFIED = 'EMAIL_ALREADY_VERIFIED',
  
  // Database Errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
  DATABASE_CONSTRAINT_ERROR = 'DATABASE_CONSTRAINT_ERROR',
  
  // GDPR/Privacy Errors
  GDPR_CONSENT_REQUIRED = 'GDPR_CONSENT_REQUIRED',
  DATA_PROCESSING_CONSENT_REQUIRED = 'DATA_PROCESSING_CONSENT_REQUIRED',
  ACCOUNT_DELETION_FAILED = 'ACCOUNT_DELETION_FAILED',
  
  // Server Errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  MAINTENANCE_MODE = 'MAINTENANCE_MODE',
  
  // External Service Errors
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  EMAIL_SERVICE_ERROR = 'EMAIL_SERVICE_ERROR',
  PAYMENT_SERVICE_ERROR = 'PAYMENT_SERVICE_ERROR',
}

export interface ErrorDetails {
  code: ErrorCode
  message: string
  details?: any
  field?: string
  timestamp?: string
  requestId?: string
  userId?: string
}

export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly details?: any
  public readonly field?: string
  public readonly timestamp: string
  public readonly requestId?: string
  public readonly userId?: string
  public readonly isOperational: boolean

  constructor(
    code: ErrorCode,
    message: string,
    details?: any,
    field?: string,
    requestId?: string,
    userId?: string,
    isOperational: boolean = true
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.details = details ?? undefined
    this.field = field ?? undefined
    this.timestamp = new Date().toISOString()
    this.requestId = requestId ?? undefined
    this.userId = userId ?? undefined
    this.isOperational = isOperational

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor)
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      field: this.field,
      timestamp: this.timestamp,
      requestId: this.requestId,
      userId: this.userId,
      isOperational: this.isOperational,
    }
  }
}

// Error Factory Functions
export const createError = {
  // Authentication Errors
  invalidCredentials: (details?: any) => 
    new AppError(ErrorCode.INVALID_CREDENTIALS, 'The email or password you entered is incorrect. Please try again.', details),
  
  accountLocked: (lockUntil?: Date) => 
    new AppError(
      ErrorCode.ACCOUNT_LOCKED, 
      'Your account has been temporarily locked for security reasons. Please try again in a few minutes or reset your password.',
      { lockUntil }
    ),
  
  accountNotVerified: () => 
    new AppError(ErrorCode.ACCOUNT_NOT_VERIFIED, 'Please verify your email address to continue. Check your inbox for the verification link.'),
  
  tokenExpired: () => 
    new AppError(ErrorCode.TOKEN_EXPIRED, 'Your session has expired. Please sign in again to continue.'),
  
  tokenInvalid: () => 
    new AppError(ErrorCode.TOKEN_INVALID, 'Your session is invalid. Please sign in again.'),
  
  sessionExpired: () => 
    new AppError(ErrorCode.SESSION_EXPIRED, 'Your session has expired. Please sign in again to continue.'),
  
  sessionInvalid: () => 
    new AppError(ErrorCode.SESSION_INVALID, 'Your session is invalid. Please sign in again.'),
  
  // Authorization Errors
  unauthorized: (message = 'Please sign in to access this feature') => 
    new AppError(ErrorCode.UNAUTHORIZED, message),
  
  forbidden: (message = 'You don\'t have permission to do that') => 
    new AppError(ErrorCode.FORBIDDEN, message),
  
  insufficientPermissions: (required: string) => 
    new AppError(ErrorCode.INSUFFICIENT_PERMISSIONS, 'You don\'t have the necessary permissions for this action'),
  
  // Validation Errors
  validationError: (message: string, field?: string, details?: any) => 
    new AppError(ErrorCode.VALIDATION_ERROR, message, details, field),
  
  invalidInput: (message: string, field?: string) => 
    new AppError(ErrorCode.INVALID_INPUT, message, undefined, field),
  
  missingRequiredField: (field: string) => 
    new AppError(ErrorCode.MISSING_REQUIRED_FIELD, `Please fill in your ${field}`, undefined, field),
  
  invalidEmailFormat: (email?: string) => 
    new AppError(ErrorCode.INVALID_EMAIL_FORMAT, 'Please enter a valid email address', { email }, 'email'),
  
  passwordTooWeak: (requirements?: string[]) => 
    new AppError(ErrorCode.PASSWORD_TOO_WEAK, 'Please choose a stronger password with at least 8 characters, including uppercase, lowercase, and numbers', { requirements }, 'password'),
  
  passwordTooLong: (maxLength: number) => 
    new AppError(ErrorCode.PASSWORD_TOO_LONG, `Your password is too long. Please use ${maxLength} characters or less`, { maxLength }, 'password'),
  
  // Resource Errors
  userNotFound: (identifier?: string) => 
    new AppError(ErrorCode.USER_NOT_FOUND, 'We couldn\'t find an account with that information', { identifier }),
  
  userAlreadyExists: (email?: string) => 
    new AppError(ErrorCode.USER_ALREADY_EXISTS, 'An account with this email already exists. Try signing in instead.', { email }, 'email'),
  
  animeNotFound: (identifier?: string) => 
    new AppError(ErrorCode.ANIME_NOT_FOUND, 'We couldn\'t find that anime', { identifier }),
  
  resourceNotFound: (resource: string, identifier?: string) => 
    new AppError(ErrorCode.RESOURCE_NOT_FOUND, `We couldn't find that ${resource}`, { resource, identifier }),
  
  resourceAlreadyExists: (resource: string, identifier?: string) => 
    new AppError(ErrorCode.RESOURCE_ALREADY_EXISTS, `That ${resource} already exists`, { resource, identifier }),
  
  // Rate Limiting
  rateLimitExceeded: (limit: number, window: string) => 
    new AppError(ErrorCode.RATE_LIMIT_EXCEEDED, `You're going too fast! Please wait a moment and try again.`),
  
  tooManyRequests: (retryAfter?: number) => 
    new AppError(ErrorCode.TOO_MANY_REQUESTS, 'Too many requests. Please wait a moment and try again.', { retryAfter }),
  
  // Email Errors
  emailSendFailed: (reason?: string) => 
    new AppError(ErrorCode.EMAIL_SEND_FAILED, 'We couldn\'t send the email. Please try again or contact support if this continues.', { reason }),
  
  emailVerificationFailed: (reason?: string) => 
    new AppError(ErrorCode.EMAIL_VERIFICATION_FAILED, 'Email verification failed. Please try again or request a new verification link.', { reason }),
  
  emailAlreadyVerified: () => 
    new AppError(ErrorCode.EMAIL_ALREADY_VERIFIED, 'Your email is already verified! You can sign in now.'),
  
  // Database Errors
  databaseError: (operation: string, details?: any) => 
    new AppError(ErrorCode.DATABASE_ERROR, 'We\'re having trouble saving your data. Please try again in a moment.', details),
  
  databaseConnectionError: () => 
    new AppError(ErrorCode.DATABASE_CONNECTION_ERROR, 'We\'re having trouble connecting to our servers. Please try again in a moment.'),
  
  databaseConstraintError: (constraint: string, details?: any) => 
    new AppError(ErrorCode.DATABASE_CONSTRAINT_ERROR, 'This information is already in use. Please try something different.', details),
  
  // GDPR/Privacy Errors
  gdprConsentRequired: () => 
    new AppError(ErrorCode.GDPR_CONSENT_REQUIRED, 'Please agree to our terms and privacy policy to continue'),
  
  dataProcessingConsentRequired: () => 
    new AppError(ErrorCode.DATA_PROCESSING_CONSENT_REQUIRED, 'Please agree to our data processing terms to continue'),
  
  accountDeletionFailed: (reason?: string) => 
    new AppError(ErrorCode.ACCOUNT_DELETION_FAILED, 'We couldn\'t delete your account. Please contact support for assistance.', { reason }),
  
  // Server Errors
  internalServerError: (message = 'Something went wrong on our end. Our team has been notified and we\'re working on it!') => 
    new AppError(ErrorCode.INTERNAL_SERVER_ERROR, message, undefined, undefined, undefined, undefined, false),
  
  serviceUnavailable: (service?: string) => 
    new AppError(ErrorCode.SERVICE_UNAVAILABLE, 'This service is temporarily unavailable. Please try again in a few minutes.', { service }),
  
  maintenanceMode: () => 
    new AppError(ErrorCode.MAINTENANCE_MODE, 'We\'re performing some maintenance right now. We\'ll be back shortly!'),
  
  // External Service Errors
  externalServiceError: (service: string, details?: any) => 
    new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 'We\'re having trouble connecting to one of our services. Please try again in a moment.', details),
  
  emailServiceError: (details?: any) => 
    new AppError(ErrorCode.EMAIL_SERVICE_ERROR, 'We couldn\'t send the email right now. Please try again or contact support.', details),
  
  paymentServiceError: (details?: any) => 
    new AppError(ErrorCode.PAYMENT_SERVICE_ERROR, 'There was an issue processing your payment. Please try again.', details),
}

// Error to tRPC Error Converter
export function appErrorToTRPCError(error: AppError): TRPCError {
  const httpStatus = getHttpStatusFromErrorCode(error.code)
  
  return new TRPCError({
    code: getTRPCCodeFromErrorCode(error.code),
    message: error.message,
    cause: error,
  })
}

// HTTP Status Code Mapping
function getHttpStatusFromErrorCode(code: ErrorCode): number {
  switch (code) {
    // 400 Bad Request
    case ErrorCode.VALIDATION_ERROR:
    case ErrorCode.INVALID_INPUT:
    case ErrorCode.MISSING_REQUIRED_FIELD:
    case ErrorCode.INVALID_EMAIL_FORMAT:
    case ErrorCode.PASSWORD_TOO_WEAK:
    case ErrorCode.PASSWORD_TOO_LONG:
    case ErrorCode.EMAIL_ALREADY_VERIFIED:
    case ErrorCode.GDPR_CONSENT_REQUIRED:
    case ErrorCode.DATA_PROCESSING_CONSENT_REQUIRED:
      return 400
    
    // 401 Unauthorized
    case ErrorCode.INVALID_CREDENTIALS:
    case ErrorCode.TOKEN_EXPIRED:
    case ErrorCode.TOKEN_INVALID:
    case ErrorCode.SESSION_EXPIRED:
    case ErrorCode.SESSION_INVALID:
    case ErrorCode.UNAUTHORIZED:
      return 401
    
    // 403 Forbidden
    case ErrorCode.ACCOUNT_LOCKED:
    case ErrorCode.ACCOUNT_NOT_VERIFIED:
    case ErrorCode.FORBIDDEN:
    case ErrorCode.INSUFFICIENT_PERMISSIONS:
      return 403
    
    // 404 Not Found
    case ErrorCode.USER_NOT_FOUND:
    case ErrorCode.ANIME_NOT_FOUND:
    case ErrorCode.RESOURCE_NOT_FOUND:
      return 404
    
    // 409 Conflict
    case ErrorCode.USER_ALREADY_EXISTS:
    case ErrorCode.RESOURCE_ALREADY_EXISTS:
      return 409
    
    // 429 Too Many Requests
    case ErrorCode.RATE_LIMIT_EXCEEDED:
    case ErrorCode.TOO_MANY_REQUESTS:
      return 429
    
    // 500 Internal Server Error
    case ErrorCode.DATABASE_ERROR:
    case ErrorCode.DATABASE_CONNECTION_ERROR:
    case ErrorCode.DATABASE_CONSTRAINT_ERROR:
    case ErrorCode.EMAIL_SEND_FAILED:
    case ErrorCode.EMAIL_VERIFICATION_FAILED:
    case ErrorCode.ACCOUNT_DELETION_FAILED:
    case ErrorCode.INTERNAL_SERVER_ERROR:
    case ErrorCode.EXTERNAL_SERVICE_ERROR:
    case ErrorCode.EMAIL_SERVICE_ERROR:
    case ErrorCode.PAYMENT_SERVICE_ERROR:
      return 500
    
    // 503 Service Unavailable
    case ErrorCode.SERVICE_UNAVAILABLE:
    case ErrorCode.MAINTENANCE_MODE:
      return 503
    
    default:
      return 500
  }
}

// tRPC Code Mapping
function getTRPCCodeFromErrorCode(code: ErrorCode): 'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'TOO_MANY_REQUESTS' | 'INTERNAL_SERVER_ERROR' {
  const httpStatus = getHttpStatusFromErrorCode(code)
  
  switch (httpStatus) {
    case 400:
      return 'BAD_REQUEST'
    case 401:
      return 'UNAUTHORIZED'
    case 403:
      return 'FORBIDDEN'
    case 404:
      return 'NOT_FOUND'
    case 409:
      return 'CONFLICT'
    case 429:
      return 'TOO_MANY_REQUESTS'
    default:
      return 'INTERNAL_SERVER_ERROR'
  }
}

// Error Handler Utility
export function handleError(error: unknown, context?: { requestId?: string; userId?: string }): AppError {
  if (error instanceof AppError) {
    return error
  }
  
  if (error instanceof TRPCError) {
    return new AppError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      error.message,
      { originalError: error.message },
      undefined,
      context?.requestId,
      context?.userId,
      false
    )
  }
  
  if (error instanceof Error) {
    return new AppError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      error.message,
      { originalError: error.message, stack: error.stack },
      undefined,
      context?.requestId,
      context?.userId,
      false
    )
  }
  
  return new AppError(
    ErrorCode.INTERNAL_SERVER_ERROR,
    'An unknown error occurred',
    { originalError: error },
    undefined,
    context?.requestId,
    context?.userId,
    false
  )
}

// Error Response Formatter
export function formatErrorResponse(error: AppError, includeDetails: boolean = false) {
  const response: any = {
    error: {
      code: error.code,
      message: error.message,
      timestamp: error.timestamp,
    }
  }
  
  if (includeDetails && error.details) {
    response.error.details = error.details
  }
  
  if (error.field) {
    response.error.field = error.field
  }
  
  if (error.requestId) {
    response.error.requestId = error.requestId
  }
  
  return response
}
