/**
 * Unit tests for auth router
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { authRouter } from '../auth'
import { createMockPublicContext, createMockUser, setupTestDatabase } from '../../tests/helpers/test-setup'
import { db } from '../../lib/db'
import { TRPCError } from '@trpc/server'
import * as authLib from '../../lib/auth'

// Mock auth library functions
const mockHashPassword = mock(() => Promise.resolve('hashed-password'))
const mockVerifyPassword = mock(() => Promise.resolve(true))
const mockCreateSession = mock(() => Promise.resolve({ accessToken: 'access', refreshToken: 'refresh' }))
const mockSendEmailVerification = mock(() => Promise.resolve())
const mockLogSecurityEvent = mock(() => Promise.resolve())

// Setup test database
setupTestDatabase()

describe('Auth Router', () => {
  beforeEach(() => {
    // Reset mocks
    mockHashPassword.mockReset()
    mockVerifyPassword.mockReset()
    mockCreateSession.mockReset()
    mockSendEmailVerification.mockReset()
    mockLogSecurityEvent.mockReset()
  })

  describe('signup', () => {
    test('should create a new user successfully', async () => {
      mockHashPassword.mockResolvedValueOnce('hashed-password')
      mockCreateSession.mockResolvedValueOnce({ accessToken: 'access', refreshToken: 'refresh' })
      mockSendEmailVerification.mockResolvedValueOnce(undefined)

      // Create default role first
      const defaultRole = await db.role.create({
        data: {
          name: 'user',
          isDefault: true,
          permissions: [],
        },
      })

      const caller = authRouter.createCaller(createMockPublicContext())

      const result = await caller.signup({
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'SecurePass123!',
        gdprConsent: true,
        marketingConsent: false,
        dataProcessingConsent: true,
      })

      expect(result).toHaveProperty('user')
      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(result.user.email).toBe('newuser@example.com')
      expect(result.user.username).toBe('newuser')

      // Verify user was created in database
      const user = await db.user.findUnique({
        where: { email: 'newuser@example.com' },
      })
      expect(user).not.toBeNull()
      expect(user?.email).toBe('newuser@example.com')
    })

    test('should reject signup with existing email', async () => {
      // Create default role
      const defaultRole = await db.role.create({
        data: {
          name: 'user',
          isDefault: true,
          permissions: [],
        },
      })

      // Create existing user
      await db.user.create({
        data: {
          email: 'existing@example.com',
          username: 'existing',
          password: 'hashed',
          primaryRoleId: defaultRole.id,
          gdprConsent: true,
          dataProcessingConsent: true,
        },
      })

      const caller = authRouter.createCaller(createMockPublicContext())

      await expect(
        caller.signup({
          email: 'existing@example.com',
          username: 'newuser',
          password: 'SecurePass123!',
          gdprConsent: true,
          marketingConsent: false,
          dataProcessingConsent: true,
        })
      ).rejects.toThrow(TRPCError)
    })

    test('should reject signup with existing username', async () => {
      // Create default role
      const defaultRole = await db.role.create({
        data: {
          name: 'user',
          isDefault: true,
          permissions: [],
        },
      })

      // Create existing user
      await db.user.create({
        data: {
          email: 'user1@example.com',
          username: 'existinguser',
          password: 'hashed',
          primaryRoleId: defaultRole.id,
          gdprConsent: true,
          dataProcessingConsent: true,
        },
      })

      const caller = authRouter.createCaller(createMockPublicContext())

      await expect(
        caller.signup({
          email: 'user2@example.com',
          username: 'existinguser',
          password: 'SecurePass123!',
          gdprConsent: true,
          marketingConsent: false,
          dataProcessingConsent: true,
        })
      ).rejects.toThrow(TRPCError)
    })

    test('should reject signup with uppercase username', async () => {
      const caller = authRouter.createCaller(createMockPublicContext())

      await expect(
        caller.signup({
          email: 'user@example.com',
          username: 'UpperCaseUser',
          password: 'SecurePass123!',
          gdprConsent: true,
          marketingConsent: false,
          dataProcessingConsent: true,
        })
      ).rejects.toThrow(TRPCError)
    })
  })

  describe('signin', () => {
    test('should sign in successfully with valid credentials', async () => {
      mockVerifyPassword.mockResolvedValueOnce(true)
      mockCreateSession.mockResolvedValueOnce({ accessToken: 'access', refreshToken: 'refresh' })

      // Create default role
      const defaultRole = await db.role.create({
        data: {
          name: 'user',
          isDefault: true,
          permissions: [],
        },
      })

      // Create user
      const user = await db.user.create({
        data: {
          email: 'signin@example.com',
          username: 'signinuser',
          password: 'hashed-password',
          primaryRoleId: defaultRole.id,
          emailVerified: true,
          gdprConsent: true,
          dataProcessingConsent: true,
        },
      })

      const caller = authRouter.createCaller(createMockPublicContext())

      const result = await caller.signin({
        email: 'signin@example.com',
        password: 'password123',
      })

      expect(result).toHaveProperty('user')
      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(result.user.email).toBe('signin@example.com')
    })

    test('should reject signin with invalid email', async () => {
      const caller = authRouter.createCaller(createMockPublicContext())

      await expect(
        caller.signin({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
      ).rejects.toThrow(TRPCError)
    })

    test('should reject signin with invalid password', async () => {
      mockVerifyPassword.mockResolvedValueOnce(false)

      // Create default role
      const defaultRole = await db.role.create({
        data: {
          name: 'user',
          isDefault: true,
          permissions: [],
        },
      })

      // Create user
      await db.user.create({
        data: {
          email: 'signin@example.com',
          username: 'signinuser',
          password: 'hashed-password',
          primaryRoleId: defaultRole.id,
          emailVerified: true,
          gdprConsent: true,
          dataProcessingConsent: true,
        },
      })

      const caller = authRouter.createCaller(createMockPublicContext())

      await expect(
        caller.signin({
          email: 'signin@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow(TRPCError)
    })
  })

  describe('me', () => {
    test('should return current user info', async () => {
      // Create default role
      const defaultRole = await db.role.create({
        data: {
          name: 'user',
          isDefault: true,
          permissions: [],
        },
      })

      // Create user
      const user = await db.user.create({
        data: {
          email: 'me@example.com',
          username: 'meuser',
          password: 'hashed',
          primaryRoleId: defaultRole.id,
          emailVerified: true,
          gdprConsent: true,
          dataProcessingConsent: true,
        },
        include: {
          primaryRole: true,
          preferences: true,
        },
      })

      const mockContext = {
        req: createMockPublicContext().req,
        user: {
          ...user,
          role: user.primaryRole?.name || 'user',
        },
      }

      const caller = authRouter.createCaller(mockContext)

      const result = await caller.me()

      expect(result).toHaveProperty('id')
      expect(result.email).toBe('me@example.com')
      expect(result.username).toBe('meuser')
    })
  })
})
