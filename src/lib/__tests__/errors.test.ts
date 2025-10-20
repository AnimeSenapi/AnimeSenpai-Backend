/**
 * Error Handling Tests
 * Tests for custom error classes
 */

import { describe, it, expect } from 'bun:test'
import { createError } from '../errors'

describe('Error Handling', () => {
  describe('createError', () => {
    it('should create user not found error', () => {
      const error = createError.userNotFound('test@example.com')
      expect(error.message).toBeDefined()
      expect(error.code).toBe('USER_NOT_FOUND')
    })

    it('should create user already exists error', () => {
      const error = createError.userAlreadyExists('test@example.com')
      expect(error.message).toBeDefined()
      expect(error.code).toBe('USER_ALREADY_EXISTS')
    })

    it('should create invalid credentials error', () => {
      const error = createError.invalidCredentials()
      expect(error.message).toBeDefined()
      expect(error.code).toBe('INVALID_CREDENTIALS')
    })

    it('should create unauthorized error', () => {
      const error = createError.unauthorized()
      expect(error.message).toBeDefined()
      expect(error.code).toBe('UNAUTHORIZED')
    })

    it('should create forbidden error', () => {
      const error = createError.forbidden()
      expect(error.message).toBeDefined()
      expect(error.code).toBe('FORBIDDEN')
    })

    it('should create anime not found error', () => {
      const error = createError.animeNotFound('anime-slug')
      expect(error.message).toBeDefined()
      expect(error.code).toBe('ANIME_NOT_FOUND')
    })
  })
})

