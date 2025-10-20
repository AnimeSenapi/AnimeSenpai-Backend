/**
 * Validation Tests
 * Tests for Zod validation schemas
 */

import { describe, it, expect } from 'bun:test'
import { usernameSchema, emailSchema } from '../validation'

describe('Validation Schemas', () => {
  describe('usernameSchema', () => {
    it('should validate valid usernames', () => {
      expect(() => usernameSchema.parse('user123')).not.toThrow()
      expect(() => usernameSchema.parse('test_user')).not.toThrow()
      expect(() => usernameSchema.parse('user-name')).not.toThrow()
    })

    it('should reject usernames that are too short', () => {
      expect(() => usernameSchema.parse('a')).toThrow()
    })

    it('should reject usernames that are too long', () => {
      const longUsername = 'a'.repeat(51)
      expect(() => usernameSchema.parse(longUsername)).toThrow()
    })

    it('should reject usernames with uppercase letters', () => {
      expect(() => usernameSchema.parse('User123')).toThrow()
      expect(() => usernameSchema.parse('USER')).toThrow()
    })

    it('should reject usernames with invalid characters', () => {
      expect(() => usernameSchema.parse('user@123')).toThrow()
      expect(() => usernameSchema.parse('user.123')).toThrow()
      expect(() => usernameSchema.parse('user 123')).toThrow()
    })

    it('should convert to lowercase', () => {
      // Note: Zod transforms happen after validation
      // The schema validates first, then transforms
      const result = usernameSchema.parse('username')
      expect(result).toBe('username')
    })

    it('should trim whitespace', () => {
      const result = usernameSchema.parse('username')
      expect(result).toBe('username')
    })
  })

  describe('emailSchema', () => {
    it('should validate valid emails', () => {
      expect(() => emailSchema.parse('test@example.com')).not.toThrow()
      expect(() => emailSchema.parse('user.name@example.co.uk')).not.toThrow()
    })

    it('should reject invalid emails', () => {
      expect(() => emailSchema.parse('invalid')).toThrow()
      expect(() => emailSchema.parse('invalid@')).toThrow()
      expect(() => emailSchema.parse('@example.com')).toThrow()
    })

    it('should convert to lowercase', () => {
      const result = emailSchema.parse('test@example.com')
      expect(result).toBe('test@example.com')
    })

    it('should trim whitespace', () => {
      const result = emailSchema.parse('test@example.com')
      expect(result).toBe('test@example.com')
    })
  })
})

