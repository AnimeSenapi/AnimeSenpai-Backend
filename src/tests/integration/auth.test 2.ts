import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test'
import { appRouter } from '../../routers'
import { db } from '../../lib/db'
import { hashPassword } from '../../lib/auth'

describe('Auth Integration Tests', () => {
  let testUserId: string
  let testUserEmail: string
  let testUserPassword: string

  beforeAll(async () => {
    // Clean up any existing test users
    await db.user.deleteMany({
      where: {
        email: { startsWith: 'test-auth' }
      }
    })
  })

  afterAll(async () => {
    // Clean up test user
    if (testUserId) {
      await db.user.delete({
        where: { id: testUserId }
      })
    }
  })

  beforeEach(() => {
    testUserEmail = `test-auth-${Date.now()}@example.com`
    testUserPassword = 'TestPassword123!'
  })

  describe('User Registration', () => {
    test('should register a new user successfully', async () => {
      const result = await appRouter
        .createCaller({})
        .auth.signup({
          email: testUserEmail,
          password: testUserPassword,
          confirmPassword: testUserPassword,
          gdprConsent: true,
          dataProcessingConsent: true,
          marketingConsent: false,
        })

      expect(result.success).toBe(true)
      expect(result.user).toBeDefined()
      expect(result.user.email).toBe(testUserEmail)
      expect(result.user.password).toBeUndefined()
      
      testUserId = result.user.id
    })

    test('should fail registration with duplicate email', async () => {
      // First registration
      await appRouter
        .createCaller({})
        .auth.signup({
          email: testUserEmail,
          password: testUserPassword,
          confirmPassword: testUserPassword,
          gdprConsent: true,
          dataProcessingConsent: true,
          marketingConsent: false,
        })

      // Second registration with same email should fail
      await expect(
        appRouter
          .createCaller({})
          .auth.signup({
            email: testUserEmail,
            password: testUserPassword,
            confirmPassword: testUserPassword,
            gdprConsent: true,
            dataProcessingConsent: true,
            marketingConsent: false,
          })
      ).rejects.toThrow()
    })

    test('should fail registration with weak password', async () => {
      await expect(
        appRouter
          .createCaller({})
          .auth.signup({
            email: testUserEmail,
            password: 'weak',
            confirmPassword: 'weak',
            gdprConsent: true,
            dataProcessingConsent: true,
            marketingConsent: false,
          })
      ).rejects.toThrow()
    })

    test('should fail registration without GDPR consent', async () => {
      await expect(
        appRouter
          .createCaller({})
          .auth.signup({
            email: testUserEmail,
            password: testUserPassword,
            confirmPassword: testUserPassword,
            gdprConsent: false,
            dataProcessingConsent: false,
            marketingConsent: false,
          })
      ).rejects.toThrow()
    })
  })

  describe('User Login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      const hashedPassword = await hashPassword(testUserPassword)
      const user = await db.user.create({
        data: {
          email: testUserEmail,
          password: hashedPassword,
          preferences: {
            create: {
              favoriteGenres: [],
              favoriteTags: [],
              discoveryMode: 'balanced',
            }
          }
        }
      })
      testUserId = user.id
    })

    test('should login with valid credentials', async () => {
      const result = await appRouter
        .createCaller({})
        .auth.signin({
          email: testUserEmail,
          password: testUserPassword,
          rememberMe: false,
        })

      expect(result.success).toBe(true)
      expect(result.accessToken).toBeDefined()
      expect(result.refreshToken).toBeDefined()
      expect(result.user).toBeDefined()
      expect(result.user.email).toBe(testUserEmail)
    })

    test('should fail login with invalid email', async () => {
      await expect(
        appRouter
          .createCaller({})
          .auth.signin({
            email: 'nonexistent@example.com',
            password: testUserPassword,
            rememberMe: false,
          })
      ).rejects.toThrow()
    })

    test('should fail login with invalid password', async () => {
      await expect(
        appRouter
          .createCaller({})
          .auth.signin({
            email: testUserEmail,
            password: 'wrongpassword',
            rememberMe: false,
          })
      ).rejects.toThrow()
    })

    test('should create session on successful login', async () => {
      const result = await appRouter
        .createCaller({})
        .auth.signin({
          email: testUserEmail,
          password: testUserPassword,
          rememberMe: false,
        })

      // Check that session was created
      const session = await db.userSession.findFirst({
        where: {
          userId: testUserId,
          isActive: true,
        }
      })

      expect(session).toBeDefined()
      expect(session?.userId).toBe(testUserId)
    })
  })

  describe('Token Refresh', () => {
    let refreshToken: string

    beforeEach(async () => {
      // Create user and login
      const hashedPassword = await hashPassword(testUserPassword)
      const user = await db.user.create({
        data: {
          email: testUserEmail,
          password: hashedPassword,
          preferences: {
            create: {
              favoriteGenres: [],
              favoriteTags: [],
              discoveryMode: 'balanced',
            }
          }
        }
      })
      testUserId = user.id

      const loginResult = await appRouter
        .createCaller({})
        .auth.signin({
          email: testUserEmail,
          password: testUserPassword,
          rememberMe: false,
        })
      
      refreshToken = loginResult.refreshToken
    })

    test('should refresh access token with valid refresh token', async () => {
      const result = await appRouter
        .createCaller({})
        .auth.refreshToken({
          refreshToken,
        })

      expect(result.success).toBe(true)
      expect(result.accessToken).toBeDefined()
      expect(result.refreshToken).toBeDefined()
    })

    test('should fail with invalid refresh token', async () => {
      await expect(
        appRouter
          .createCaller({})
          .auth.refreshToken({
            refreshToken: 'invalid-token',
          })
      ).rejects.toThrow()
    })
  })

  describe('Password Reset', () => {
    beforeEach(async () => {
      // Create test user
      const hashedPassword = await hashPassword(testUserPassword)
      const user = await db.user.create({
        data: {
          email: testUserEmail,
          password: hashedPassword,
          preferences: {
            create: {
              favoriteGenres: [],
              favoriteTags: [],
              discoveryMode: 'balanced',
            }
          }
        }
      })
      testUserId = user.id
    })

    test('should request password reset for valid email', async () => {
      const result = await appRouter
        .createCaller({})
        .auth.requestPasswordReset({
          email: testUserEmail,
        })

      expect(result.success).toBe(true)
    })

    test('should not reveal if email exists or not', async () => {
      // Request reset for non-existent email
      const result = await appRouter
        .createCaller({})
        .auth.requestPasswordReset({
          email: 'nonexistent@example.com',
        })

      // Should still return success (security best practice)
      expect(result.success).toBe(true)
    })
  })
})

