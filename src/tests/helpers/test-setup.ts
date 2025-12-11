/**
 * Test setup and utilities for router tests
 */

import { beforeEach, afterEach } from 'bun:test'
import { db } from '../../lib/db.js'
import type { Context } from '../../lib/trpc.js'

// Mock request object
export function createMockRequest(overrides?: Partial<Request>): Request {
  const headers = new Headers({
    'user-agent': 'test-agent',
    'x-forwarded-for': '127.0.0.1',
    ...overrides?.headers,
  })

  return {
    method: 'GET',
    headers,
    url: 'http://localhost:3005/api/trpc',
    ...overrides,
  } as Request
}

// Mock context for public procedures
export function createMockPublicContext(overrides?: Partial<Context>): Context {
  return {
    req: createMockRequest(),
    ...overrides,
  }
}

// Mock context for protected procedures
export function createMockProtectedContext(
  user: any,
  overrides?: Partial<Context>
): Context {
  return {
    req: createMockRequest(),
    user,
    sessionId: 'test-session-id',
    ...overrides,
  }
}

// Mock user data
export function createMockUser(overrides?: Partial<any>) {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    username: 'testuser',
    name: 'Test User',
    emailVerified: true,
    primaryRole: {
      id: 'role-id',
      name: 'user',
      isDefault: true,
    },
    preferences: {
      theme: 'dark',
      language: 'en',
    },
    ...overrides,
  }
}

// Database cleanup helper
export async function cleanupDatabase() {
  // Clean up test data in reverse order of dependencies
  try {
    await db.userAnimeList.deleteMany({ where: {} })
    await db.userAnimeReview.deleteMany({ where: {} })
    await db.userSession.deleteMany({ where: {} })
    await db.user.deleteMany({ where: {} })
    await db.anime.deleteMany({ where: {} })
  } catch (error) {
    // Ignore errors during cleanup
    console.warn('Cleanup warning:', error)
  }
}

// Setup and teardown hooks
export function setupTestDatabase() {
  beforeEach(async () => {
    // Clean database before each test
    await cleanupDatabase()
  })

  afterEach(async () => {
    // Clean database after each test
    await cleanupDatabase()
  })
}
