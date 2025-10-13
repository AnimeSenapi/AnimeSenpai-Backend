import { describe, test, expect, beforeEach } from 'bun:test'
import { 
  checkRateLimit, 
  getRateLimitStatus, 
  resetRateLimit,
  _test 
} from '../rate-limiter'

describe('Rate Limiter', () => {
  beforeEach(() => {
    // Clear all rate limits before each test
    _test.clearAll()
  })

  test('should allow requests within limit', () => {
    const identifier = 'test-user-1'
    
    // Should not throw for first 5 requests
    expect(() => checkRateLimit(identifier, 'auth')).not.toThrow()
    expect(() => checkRateLimit(identifier, 'auth')).not.toThrow()
    expect(() => checkRateLimit(identifier, 'auth')).not.toThrow()
    expect(() => checkRateLimit(identifier, 'auth')).not.toThrow()
    expect(() => checkRateLimit(identifier, 'auth')).not.toThrow()
  })

  test('should block requests exceeding limit', () => {
    const identifier = 'test-user-2'
    
    // Use up all 5 auth attempts
    for (let i = 0; i < 5; i++) {
      checkRateLimit(identifier, 'auth')
    }
    
    // 6th request should throw
    expect(() => checkRateLimit(identifier, 'auth')).toThrow()
  })

  test('should return correct rate limit status', () => {
    const identifier = 'test-user-3'
    
    // Make 3 requests
    checkRateLimit(identifier, 'auth')
    checkRateLimit(identifier, 'auth')
    checkRateLimit(identifier, 'auth')
    
    const status = getRateLimitStatus(identifier, 'auth')
    
    expect(status.requests).toBe(3)
    expect(status.limit).toBe(5)
    expect(status.remaining).toBe(2)
  })

  test('should reset rate limit when called', () => {
    const identifier = 'test-user-4'
    
    // Use up limit
    for (let i = 0; i < 5; i++) {
      checkRateLimit(identifier, 'auth')
    }
    
    // Should throw
    expect(() => checkRateLimit(identifier, 'auth')).toThrow()
    
    // Reset
    resetRateLimit(identifier, 'auth')
    
    // Should allow again
    expect(() => checkRateLimit(identifier, 'auth')).not.toThrow()
  })

  test('should handle different rate limit types', () => {
    const identifier = 'test-user-5'
    
    // Auth limit: 5 requests
    for (let i = 0; i < 5; i++) {
      checkRateLimit(identifier, 'auth')
    }
    expect(() => checkRateLimit(identifier, 'auth')).toThrow()
    
    // Public limit should still work (different counter)
    expect(() => checkRateLimit(identifier, 'public')).not.toThrow()
  })

  test('should use custom keys for specific endpoints', () => {
    const identifier = 'test-user-6'
    
    // Same identifier, different custom keys
    checkRateLimit(identifier, 'auth', 'signup')
    checkRateLimit(identifier, 'auth', 'signin')
    
    // Both should have separate counters
    const signupStatus = getRateLimitStatus(identifier, 'auth', 'signup')
    const signinStatus = getRateLimitStatus(identifier, 'auth', 'signin')
    
    expect(signupStatus.requests).toBe(1)
    expect(signinStatus.requests).toBe(1)
  })
})

