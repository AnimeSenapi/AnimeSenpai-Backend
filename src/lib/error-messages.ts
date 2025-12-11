/**
 * Standardized Error Messages
 * Centralized user-friendly error messages for consistent error handling
 */

import { ErrorCode } from './errors'

export interface ErrorMessageConfig {
  userMessage: string
  recoveryAction?: string
  retryable: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export const ERROR_MESSAGES: Record<ErrorCode, ErrorMessageConfig> = {
  // Authentication Errors
  [ErrorCode.INVALID_CREDENTIALS]: {
    userMessage: 'The email or password you entered is incorrect. Please try again.',
    recoveryAction: 'Check your email and password, or use "Forgot Password" to reset.',
    retryable: true,
    severity: 'medium',
  },
  [ErrorCode.ACCOUNT_LOCKED]: {
    userMessage: 'Your account has been temporarily locked for security reasons.',
    recoveryAction: 'Please wait a few minutes or reset your password.',
    retryable: true,
    severity: 'high',
  },
  [ErrorCode.ACCOUNT_NOT_VERIFIED]: {
    userMessage: 'Please verify your email address to continue.',
    recoveryAction: 'Check your inbox for the verification link, or request a new one.',
    retryable: true,
    severity: 'medium',
  },
  [ErrorCode.TOKEN_EXPIRED]: {
    userMessage: 'Your session has expired. Please sign in again.',
    recoveryAction: 'Sign in again to continue.',
    retryable: true,
    severity: 'low',
  },
  [ErrorCode.TOKEN_INVALID]: {
    userMessage: 'Your session is invalid. Please sign in again.',
    recoveryAction: 'Sign in again to continue.',
    retryable: true,
    severity: 'low',
  },
  [ErrorCode.SESSION_EXPIRED]: {
    userMessage: 'Your session has expired. Please sign in again.',
    recoveryAction: 'Sign in again to continue.',
    retryable: true,
    severity: 'low',
  },
  [ErrorCode.SESSION_INVALID]: {
    userMessage: 'Your session is invalid. Please sign in again.',
    recoveryAction: 'Sign in again to continue.',
    retryable: true,
    severity: 'low',
  },

  // Authorization Errors
  [ErrorCode.UNAUTHORIZED]: {
    userMessage: 'Please sign in to access this feature.',
    recoveryAction: 'Sign in to continue.',
    retryable: true,
    severity: 'low',
  },
  [ErrorCode.FORBIDDEN]: {
    userMessage: "You don't have permission to perform this action.",
    recoveryAction: 'Contact support if you believe this is an error.',
    retryable: false,
    severity: 'medium',
  },
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: {
    userMessage: "You don't have the necessary permissions for this action.",
    recoveryAction: 'Contact support if you need access to this feature.',
    retryable: false,
    severity: 'medium',
  },

  // Validation Errors
  [ErrorCode.VALIDATION_ERROR]: {
    userMessage: 'Please check your input and try again.',
    recoveryAction: 'Review the form fields and correct any errors.',
    retryable: true,
    severity: 'low',
  },
  [ErrorCode.INVALID_INPUT]: {
    userMessage: 'The information you provided is invalid.',
    recoveryAction: 'Please check your input and try again.',
    retryable: true,
    severity: 'low',
  },
  [ErrorCode.MISSING_REQUIRED_FIELD]: {
    userMessage: 'Please fill in all required fields.',
    recoveryAction: 'Complete all required fields and try again.',
    retryable: true,
    severity: 'low',
  },
  [ErrorCode.INVALID_EMAIL_FORMAT]: {
    userMessage: 'Please enter a valid email address.',
    recoveryAction: 'Check your email format and try again.',
    retryable: true,
    severity: 'low',
  },
  [ErrorCode.PASSWORD_TOO_WEAK]: {
    userMessage: 'Please choose a stronger password.',
    recoveryAction: 'Use at least 8 characters with uppercase, lowercase, and numbers.',
    retryable: true,
    severity: 'low',
  },
  [ErrorCode.PASSWORD_TOO_LONG]: {
    userMessage: 'Your password is too long.',
    recoveryAction: 'Please use a shorter password.',
    retryable: true,
    severity: 'low',
  },

  // Resource Errors
  [ErrorCode.USER_NOT_FOUND]: {
    userMessage: "We couldn't find an account with that information.",
    recoveryAction: 'Check your credentials or create a new account.',
    retryable: false,
    severity: 'medium',
  },
  [ErrorCode.USER_ALREADY_EXISTS]: {
    userMessage: 'An account with this email already exists.',
    recoveryAction: 'Try signing in instead, or use a different email.',
    retryable: false,
    severity: 'low',
  },
  [ErrorCode.ANIME_NOT_FOUND]: {
    userMessage: "We couldn't find that anime.",
    recoveryAction: 'Try searching for a different anime.',
    retryable: false,
    severity: 'low',
  },
  [ErrorCode.RESOURCE_NOT_FOUND]: {
    userMessage: "We couldn't find what you're looking for.",
    recoveryAction: 'Please check your request and try again.',
    retryable: false,
    severity: 'low',
  },
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: {
    userMessage: 'This resource already exists.',
    recoveryAction: 'Try a different value or update the existing resource.',
    retryable: false,
    severity: 'low',
  },

  // Rate Limiting
  [ErrorCode.RATE_LIMIT_EXCEEDED]: {
    userMessage: "You're going too fast! Please wait a moment.",
    recoveryAction: 'Wait a few seconds and try again.',
    retryable: true,
    severity: 'medium',
  },
  [ErrorCode.TOO_MANY_REQUESTS]: {
    userMessage: 'Too many requests. Please wait a moment.',
    recoveryAction: 'Wait a few seconds and try again.',
    retryable: true,
    severity: 'medium',
  },

  // Email Errors
  [ErrorCode.EMAIL_SEND_FAILED]: {
    userMessage: "We couldn't send the email. Please try again.",
    recoveryAction: 'Try again in a moment, or contact support if this continues.',
    retryable: true,
    severity: 'medium',
  },
  [ErrorCode.EMAIL_VERIFICATION_FAILED]: {
    userMessage: 'Email verification failed. Please try again.',
    recoveryAction: 'Request a new verification link.',
    retryable: true,
    severity: 'medium',
  },
  [ErrorCode.EMAIL_ALREADY_VERIFIED]: {
    userMessage: 'Your email is already verified!',
    recoveryAction: 'You can sign in now.',
    retryable: false,
    severity: 'low',
  },

  // Database Errors
  [ErrorCode.DATABASE_ERROR]: {
    userMessage: "We're having trouble saving your data. Please try again.",
    recoveryAction: 'Try again in a moment. If this continues, contact support.',
    retryable: true,
    severity: 'high',
  },
  [ErrorCode.DATABASE_CONNECTION_ERROR]: {
    userMessage: "We're having trouble connecting to our servers.",
    recoveryAction: 'Please try again in a moment.',
    retryable: true,
    severity: 'critical',
  },
  [ErrorCode.DATABASE_CONSTRAINT_ERROR]: {
    userMessage: 'This information is already in use.',
    recoveryAction: 'Please try something different.',
    retryable: false,
    severity: 'low',
  },

  // GDPR/Privacy Errors
  [ErrorCode.GDPR_CONSENT_REQUIRED]: {
    userMessage: 'Please agree to our terms and privacy policy to continue.',
    recoveryAction: 'Accept the terms to proceed.',
    retryable: true,
    severity: 'low',
  },
  [ErrorCode.DATA_PROCESSING_CONSENT_REQUIRED]: {
    userMessage: 'Please agree to our data processing terms to continue.',
    recoveryAction: 'Accept the data processing terms to proceed.',
    retryable: true,
    severity: 'low',
  },
  [ErrorCode.ACCOUNT_DELETION_FAILED]: {
    userMessage: "We couldn't delete your account. Please contact support.",
    recoveryAction: 'Contact support for assistance.',
    retryable: false,
    severity: 'high',
  },

  // Server Errors
  [ErrorCode.INTERNAL_SERVER_ERROR]: {
    userMessage: "Something went wrong on our end. We're working on it!",
    recoveryAction: 'Please try again in a moment. If this continues, contact support.',
    retryable: true,
    severity: 'critical',
  },
  [ErrorCode.SERVICE_UNAVAILABLE]: {
    userMessage: 'This service is temporarily unavailable.',
    recoveryAction: 'Please try again in a few minutes.',
    retryable: true,
    severity: 'high',
  },
  [ErrorCode.MAINTENANCE_MODE]: {
    userMessage: "We're performing maintenance right now. We'll be back shortly!",
    recoveryAction: 'Please check back in a few minutes.',
    retryable: true,
    severity: 'medium',
  },

  // External Service Errors
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: {
    userMessage: "We're having trouble connecting to one of our services.",
    recoveryAction: 'Please try again in a moment.',
    retryable: true,
    severity: 'high',
  },
  [ErrorCode.EMAIL_SERVICE_ERROR]: {
    userMessage: "We couldn't send the email right now. Please try again.",
    recoveryAction: 'Try again in a moment, or contact support.',
    retryable: true,
    severity: 'medium',
  },
  [ErrorCode.PAYMENT_SERVICE_ERROR]: {
    userMessage: 'There was an issue processing your payment.',
    recoveryAction: 'Please try again or use a different payment method.',
    retryable: true,
    severity: 'high',
  },
}

/**
 * Get user-friendly error message for an error code
 */
export function getUserFriendlyMessage(code: ErrorCode): ErrorMessageConfig {
  return ERROR_MESSAGES[code] || {
    userMessage: 'An unexpected error occurred. Please try again.',
    retryable: true,
    severity: 'medium',
  }
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(code: ErrorCode): boolean {
  return getUserFriendlyMessage(code).retryable
}

/**
 * Get recovery action for an error
 */
export function getRecoveryAction(code: ErrorCode): string | undefined {
  return getUserFriendlyMessage(code).recoveryAction
}
