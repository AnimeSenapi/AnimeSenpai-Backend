import { describe, test, expect } from 'bun:test'
import { AppError, ErrorCode, createError } from '../errors'
import { handleError } from '../error-handler'

describe('Error Handler', () => {
  describe('AppError', () => {
    test('should create error with correct properties', () => {
      const error = new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Test error message',
        { field: 'email' }
      )

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR)
      expect(error.message).toBe('Test error message')
      expect(error.metadata).toEqual({ field: 'email' })
      expect(error).toBeInstanceOf(Error)
    })

    test('should create error with user-friendly message', () => {
      const error = createError.validationError('Invalid email', 'email')
      
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR)
      expect(error.message).toBe('Invalid email')
      expect(error.metadata?.field).toBe('email')
    })
  })

  describe('handleError', () => {
    test('should handle AppError correctly', () => {
      const appError = createError.validationError('Test error', 'field')
      const handled = handleError(appError)
      
      expect(handled).toBeInstanceOf(AppError)
      expect(handled.code).toBe(ErrorCode.VALIDATION_ERROR)
    })

    test('should handle generic Error', () => {
      const genericError = new Error('Generic error message')
      const handled = handleError(genericError)
      
      expect(handled).toBeInstanceOf(AppError)
      expect(handled.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR)
      expect(handled.message).toBe('Generic error message')
    })

    test('should handle unknown error types', () => {
      const unknownError = { message: 'Unknown error' }
      const handled = handleError(unknownError as any)
      
      expect(handled).toBeInstanceOf(AppError)
      expect(handled.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR)
    })
  })

  describe('Error Codes', () => {
    test('should have all required error codes', () => {
      expect(ErrorCode.VALIDATION_ERROR).toBeDefined()
      expect(ErrorCode.UNAUTHORIZED).toBeDefined()
      expect(ErrorCode.FORBIDDEN).toBeDefined()
      expect(ErrorCode.NOT_FOUND).toBeDefined()
      expect(ErrorCode.INTERNAL_SERVER_ERROR).toBeDefined()
      expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBeDefined()
    })
  })

  describe('Error Factory Functions', () => {
    test('should create validation error', () => {
      const error = createError.validationError('Invalid input', 'field')
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR)
      expect(error.metadata?.field).toBe('field')
    })

    test('should create unauthorized error', () => {
      const error = createError.unauthorized('Not authenticated')
      expect(error.code).toBe(ErrorCode.UNAUTHORIZED)
    })

    test('should create forbidden error', () => {
      const error = createError.forbidden('Access denied')
      expect(error.code).toBe(ErrorCode.FORBIDDEN)
    })

    test('should create not found error', () => {
      const error = createError.notFound('Resource not found', 'anime')
      expect(error.code).toBe(ErrorCode.NOT_FOUND)
      expect(error.metadata?.resource).toBe('anime')
    })

    test('should create rate limit error', () => {
      const error = createError.rateLimitExceeded(100, '15 minutes')
      expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED)
      expect(error.metadata?.limit).toBe(100)
      expect(error.metadata?.window).toBe('15 minutes')
    })
  })
})

