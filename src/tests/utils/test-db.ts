/**
 * Test Database Utilities
 * 
 * Provides database setup, teardown, and helper functions for tests
 */

import { db } from '../../lib/db'
import { Prisma } from '@prisma/client'

/**
 * Clear all test data from database
 */
export async function clearTestData(): Promise<void> {
  // Delete in order to respect foreign key constraints
  await db.userAnimeReview.deleteMany()
  await db.userAnimeList.deleteMany()
  await db.userAchievement.deleteMany()
  await db.userSession.deleteMany()
  await db.userFollow.deleteMany()
  await db.userMessage.deleteMany()
  await db.userNotification.deleteMany()
  await db.userActivity.deleteMany()
  await db.userReport.deleteMany()
  await db.userBlock.deleteMany()
  await db.user.deleteMany()
  await db.anime.deleteMany()
  await db.achievement.deleteMany()
  await db.genre.deleteMany()
  await db.studio.deleteMany()
}

/**
 * Create a test user
 */
export async function createTestUser(data?: {
  email?: string
  username?: string
  password?: string
  emailVerified?: boolean
  role?: string
}) {
  const { hashPassword } = await import('../../lib/auth')
  
  const user = await db.user.create({
    data: {
      email: data?.email || `test${Date.now()}@example.com`,
      username: data?.username || `testuser${Date.now()}`,
      password: await hashPassword(data?.password || 'TestPassword123!'),
      emailVerified: data?.emailVerified ?? false,
      role: data?.role || 'USER',
    },
  })

  return user
}

/**
 * Create test anime
 */
export async function createTestAnime(data?: {
  title?: string
  slug?: string
  malId?: number
  type?: string
  status?: string
}) {
  const anime = await db.anime.create({
    data: {
      title: data?.title || 'Test Anime',
      slug: data?.slug || `test-anime-${Date.now()}`,
      malId: data?.malId || Math.floor(Math.random() * 1000000),
      type: data?.type || 'TV',
      status: data?.status || 'Finished Airing',
      episodes: 12,
      duration: '24 min per ep',
      year: 2020,
      synopsis: 'Test synopsis',
      averageRating: 8.0,
      scoredBy: 1000,
      members: 5000,
    },
  })

  return anime
}

/**
 * Create test achievement
 */
export async function createTestAchievement(data?: {
  name?: string
  description?: string
  icon?: string
  tier?: string
}) {
  const achievement = await db.achievement.create({
    data: {
      name: data?.name || 'Test Achievement',
      description: data?.description || 'Test description',
      icon: data?.icon || '🏆',
      tier: data?.tier || 'BRONZE',
      category: 'GENERAL',
      points: 10,
      requirements: {},
    },
  })

  return achievement
}

/**
 * Create test genre
 */
export async function createTestGenre(data?: {
  name?: string
  slug?: string
}) {
  const genre = await db.genre.create({
    data: {
      name: data?.name || 'Action',
      slug: data?.slug || `action-${Date.now()}`,
      description: 'Test genre description',
    },
  })

  return genre
}

/**
 * Create test session
 */
export async function createTestSession(userId: string, data?: {
  refreshToken?: string
  accessToken?: string
  expiresAt?: Date
}) {
  const session = await db.userSession.create({
    data: {
      userId,
      refreshToken: data?.refreshToken || 'test-refresh-token',
      accessToken: data?.accessToken || 'test-access-token',
      expiresAt: data?.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })

  return session
}

/**
 * Run a test within a transaction and rollback
 */
export async function withTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return await db.$transaction(async (tx) => {
    const result = await callback(tx)
    // Rollback by throwing
    throw new Error('ROLLBACK_TEST_TRANSACTION')
  }).catch((error) => {
    if (error.message === 'ROLLBACK_TEST_TRANSACTION') {
      // Extract result from error if needed
      return undefined as T
    }
    throw error
  })
}

/**
 * Setup test database before tests
 */
export async function setupTestDb(): Promise<void> {
  // Ensure database is ready
  await db.$connect()
}

/**
 * Teardown test database after tests
 */
export async function teardownTestDb(): Promise<void> {
  await clearTestData()
  await db.$disconnect()
}

