import { describe, test, expect } from 'bun:test'
import { 
  validatePasswordStrength,
  validateEmailDomain,
  validateRateLimit 
} from '../validation'

describe('Auth Validation', () => {
  describe('validatePasswordStrength', () => {
    test('should pass for strong passwords', () => {
      const passwords = [
        'MyP@ssw0rd',
        'Secure!Pass24',
        'Complex$Word9'
      ]

      passwords.forEach(password => {
        const result = validatePasswordStrength(password)
        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })
    })

    test('should fail for weak passwords', () => {
      const result = validatePasswordStrength('weak')
      
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    test('should detect missing uppercase letters', () => {
      const result = validatePasswordStrength('password321!')
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one uppercase letter')
    })

    test('should detect missing special characters', () => {
      const result = validatePasswordStrength('Password321')
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one special character (@$!%*?&)')
    })

    test('should detect common sequences', () => {
      const result = validatePasswordStrength('Pass123word!')
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password cannot contain common sequences')
    })
  })

  describe('validateEmailDomain', () => {
    test('should accept valid email domains', () => {
      const emails = [
        'user@gmail.com',
        'test@company.org',
        'admin@business.co.uk'
      ]

      emails.forEach(email => {
        const result = validateEmailDomain(email)
        expect(result.isValid).toBe(true)
        expect(result.reason).toBeUndefined()
      })
    })

    test('should reject disposable email domains', () => {
      const disposableEmails = [
        'user@10minutemail.com',
        'test@tempmail.org',
        'fake@guerrillamail.com'
      ]

      disposableEmails.forEach(email => {
        const result = validateEmailDomain(email)
        expect(result.isValid).toBe(false)
        expect(result.reason).toContain('Disposable')
      })
    })

    test('should reject suspicious domains', () => {
      const result = validateEmailDomain('user@fakeemail.com')
      
      expect(result.isValid).toBe(false)
      expect(result.reason).toContain('Suspicious')
    })
  })

  describe('validateRateLimit', () => {
    test('should allow requests within limit', () => {
      const result = validateRateLimit(3, 5, 60000)
      
      expect(result.isValid).toBe(true)
      expect(result.retryAfter).toBeUndefined()
    })

    test('should block requests exceeding limit', () => {
      const result = validateRateLimit(5, 5, 60000)
      
      expect(result.isValid).toBe(false)
      expect(result.retryAfter).toBe(60)
    })

    test('should calculate retry time correctly', () => {
      const windowMs = 15 * 60 * 1000 // 15 minutes
      const result = validateRateLimit(10, 5, windowMs)
      
      expect(result.isValid).toBe(false)
      expect(result.retryAfter).toBe(900) // 15 minutes in seconds
    })
  })
})

