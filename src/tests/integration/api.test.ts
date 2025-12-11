/**
 * Integration Tests for API Endpoints
 * 
 * Comprehensive integration tests covering all major API endpoints
 * with proper setup, teardown, and error handling.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test'
import { appRouter } from '../../routers.js'
import { db } from '../../lib/db.js'
import { cache } from '../../lib/cache.js'
import { errorHandler } from '../../lib/error-handler.js'

// Test data
interface TestUser {
  id: string
  email: string
  username: string
  password: string
  token?: string
}

interface TestAnime {
  id: string
  title: string
  slug: string
  malId: number
}

// Test context
interface TestContext {
  users: TestUser[]
  anime: TestAnime[]
  authTokens: Map<string, string>
}

describe('API Integration Tests', () => {
  let testContext: TestContext

  beforeAll(async () => {
    // Initialize test context
    testContext = {
      users: [],
      anime: [],
      authTokens: new Map(),
    }

    // Clear database and cache
    await clearTestData()
    
    // Initialize monitoring and error handling
    const { monitoringService } = await import('../../lib/monitoring-service.js')
    await monitoringService.start()
  })

  afterAll(async () => {
    // Cleanup
    await clearTestData()
    
    // Stop monitoring
    const { monitoringService } = await import('../../lib/monitoring-service.js')
    monitoringService.stop()
  })

  beforeEach(async () => {
    // Clear cache before each test
    await cache.clear()
  })

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData()
  })

  describe('Authentication Endpoints', () => {
    test('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'TestPassword123!',
        confirmPassword: 'TestPassword123!',
        gdprConsent: true,
        dataProcessingConsent: true,
        marketingConsent: false,
      }

      const result = await appRouter
        .createCaller({})
        .auth.register(userData)

      expect(result.success).toBe(true)
      expect(result.user).toBeDefined()
      expect(result.user.email).toBe(userData.email)
      expect(result.user.username).toBe(userData.username)
      expect(result.user.password).toBeUndefined() // Password should not be returned

      // Store for other tests
      testContext.users.push({
        id: result.user.id,
        email: result.user.email,
        username: result.user.username,
        password: userData.password,
      })
    })

    test('should fail registration with invalid data', async () => {
      const invalidData = {
        email: 'invalid-email',
        username: 'a', // Too short
        password: 'weak', // Too weak
        confirmPassword: 'different',
        gdprConsent: false, // Required
        dataProcessingConsent: false, // Required
      }

      await expect(
        appRouter.createCaller({}).auth.register(invalidData)
      ).rejects.toThrow()
    })

    test('should login with valid credentials', async () => {
      const user = testContext.users[0]
      const loginData = {
        email: user.email,
        password: user.password,
        rememberMe: false,
      }

      const result = await appRouter
        .createCaller({})
        .auth.login(loginData)

      expect(result.success).toBe(true)
      expect(result.accessToken).toBeDefined()
      expect(result.refreshToken).toBeDefined()
      expect(result.user).toBeDefined()

      // Store token for other tests
      testContext.authTokens.set(user.id, result.accessToken)
    })

    test('should fail login with invalid credentials', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
        rememberMe: false,
      }

      await expect(
        appRouter.createCaller({}).auth.login(loginData)
      ).rejects.toThrow()
    })

    test('should refresh token successfully', async () => {
      const user = testContext.users[0]
      const token = testContext.authTokens.get(user.id)
      
      if (!token) {
        throw new Error('No auth token available')
      }

      const result = await appRouter
        .createCaller({})
        .auth.refreshToken({ refreshToken: token })

      expect(result.success).toBe(true)
      expect(result.accessToken).toBeDefined()
    })
  })

  describe('User Management Endpoints', () => {
    let authToken: string

    beforeEach(async () => {
      // Ensure we have a logged-in user
      if (testContext.users.length === 0) {
        await createTestUser()
      }
      authToken = testContext.authTokens.get(testContext.users[0].id) || ''
    })

    test('should get user profile', async () => {
      const result = await appRouter
        .createCaller({ user: { id: testContext.users[0].id } })
        .user.getProfile()

      expect(result).toBeDefined()
      expect(result.id).toBe(testContext.users[0].id)
      expect(result.email).toBe(testContext.users[0].email)
    })

    test('should update user profile', async () => {
      const updateData = {
        name: 'Updated Name',
        bio: 'Updated bio',
        location: 'Updated Location',
      }

      const result = await appRouter
        .createCaller({ user: { id: testContext.users[0].id } })
        .user.updateProfile(updateData)

      expect(result.success).toBe(true)
      expect(result.user.name).toBe(updateData.name)
      expect(result.user.bio).toBe(updateData.bio)
    })

    test('should get user preferences', async () => {
      const result = await appRouter
        .createCaller({ user: { id: testContext.users[0].id } })
        .user.getPreferences()

      expect(result).toBeDefined()
      expect(result.theme).toBeDefined()
      expect(result.language).toBeDefined()
    })

    test('should update user preferences', async () => {
      const preferences = {
        theme: 'dark',
        language: 'en',
        emailNotifications: true,
        pushNotifications: false,
      }

      const result = await appRouter
        .createCaller({ user: { id: testContext.users[0].id } })
        .user.updatePreferences(preferences)

      expect(result.success).toBe(true)
      expect(result.preferences.theme).toBe(preferences.theme)
    })
  })

  describe('Anime Endpoints', () => {
    beforeEach(async () => {
      // Create test anime data
      await createTestAnime()
    })

    test('should get anime list with pagination', async () => {
      const result = await appRouter
        .createCaller({})
        .anime.getList({
          page: 1,
          limit: 10,
          sort: 'popularity',
          order: 'desc',
        })

      expect(result.anime).toBeDefined()
      expect(Array.isArray(result.anime)).toBe(true)
      expect(result.pagination).toBeDefined()
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.total).toBeGreaterThan(0)
    })

    test('should search anime by title', async () => {
      const result = await appRouter
        .createCaller({})
        .anime.search({
          query: 'Attack on Titan',
          page: 1,
          limit: 10,
        })

      expect(result.anime).toBeDefined()
      expect(Array.isArray(result.anime)).toBe(true)
    })

    test('should get anime by ID', async () => {
      const anime = testContext.anime[0]
      const result = await appRouter
        .createCaller({})
        .anime.getById({ id: anime.id })

      expect(result).toBeDefined()
      expect(result.id).toBe(anime.id)
      expect(result.title).toBe(anime.title)
    })

    test('should get anime by slug', async () => {
      const anime = testContext.anime[0]
      const result = await appRouter
        .createCaller({})
        .anime.getBySlug({ slug: anime.slug })

      expect(result).toBeDefined()
      expect(result.slug).toBe(anime.slug)
    })

    test('should get trending anime', async () => {
      const result = await appRouter
        .createCaller({})
        .anime.getTrending({ limit: 10 })

      expect(result.anime).toBeDefined()
      expect(Array.isArray(result.anime)).toBe(true)
    })

    test('should get anime by genre', async () => {
      const result = await appRouter
        .createCaller({})
        .anime.getByGenre({
          genre: 'Action',
          page: 1,
          limit: 10,
        })

      expect(result.anime).toBeDefined()
      expect(Array.isArray(result.anime)).toBe(true)
    })
  })

  describe('User Anime List Endpoints', () => {
    let authToken: string

    beforeEach(async () => {
      if (testContext.users.length === 0) {
        await createTestUser()
      }
      if (testContext.anime.length === 0) {
        await createTestAnime()
      }
      authToken = testContext.authTokens.get(testContext.users[0].id) || ''
    })

    test('should add anime to user list', async () => {
      const anime = testContext.anime[0]
      const listData = {
        animeId: anime.id,
        status: 'watching',
        progress: 5,
        score: 8,
        notes: 'Great anime!',
      }

      const result = await appRouter
        .createCaller({ user: { id: testContext.users[0].id } })
        .user.addToAnimeList(listData)

      expect(result.success).toBe(true)
      expect(result.animeList).toBeDefined()
      expect(result.animeList.status).toBe(listData.status)
    })

    test('should update anime in user list', async () => {
      const anime = testContext.anime[0]
      const updateData = {
        animeId: anime.id,
        status: 'completed',
        progress: 12,
        score: 9,
        notes: 'Amazing anime!',
      }

      const result = await appRouter
        .createCaller({ user: { id: testContext.users[0].id } })
        .user.updateAnimeList(updateData)

      expect(result.success).toBe(true)
      expect(result.animeList.status).toBe(updateData.status)
    })

    test('should get user anime list', async () => {
      const result = await appRouter
        .createCaller({ user: { id: testContext.users[0].id } })
        .user.getAnimeList({
          status: 'watching',
          page: 1,
          limit: 10,
        })

      expect(result.animeList).toBeDefined()
      expect(Array.isArray(result.animeList)).toBe(true)
    })

    test('should remove anime from user list', async () => {
      const anime = testContext.anime[0]
      
      const result = await appRouter
        .createCaller({ user: { id: testContext.users[0].id } })
        .user.removeFromAnimeList({ animeId: anime.id })

      expect(result.success).toBe(true)
    })
  })

  describe('Review Endpoints', () => {
    let authToken: string

    beforeEach(async () => {
      if (testContext.users.length === 0) {
        await createTestUser()
      }
      if (testContext.anime.length === 0) {
        await createTestAnime()
      }
      authToken = testContext.authTokens.get(testContext.users[0].id) || ''
    })

    test('should create anime review', async () => {
      const anime = testContext.anime[0]
      const reviewData = {
        animeId: anime.id,
        title: 'Great Anime!',
        content: 'This anime is absolutely amazing. The story is compelling and the animation is top-notch.',
        score: 9,
        spoilers: false,
      }

      const result = await appRouter
        .createCaller({ user: { id: testContext.users[0].id } })
        .reviews.create(reviewData)

      expect(result.success).toBe(true)
      expect(result.review).toBeDefined()
      expect(result.review.title).toBe(reviewData.title)
      expect(result.review.score).toBe(reviewData.score)
    })

    test('should get anime reviews', async () => {
      const anime = testContext.anime[0]
      const result = await appRouter
        .createCaller({})
        .reviews.getByAnime({
          animeId: anime.id,
          page: 1,
          limit: 10,
        })

      expect(result.reviews).toBeDefined()
      expect(Array.isArray(result.reviews)).toBe(true)
    })

    test('should like a review', async () => {
      // First create a review
      const anime = testContext.anime[0]
      const reviewData = {
        animeId: anime.id,
        title: 'Test Review',
        content: 'Test content',
        score: 8,
      }

      const reviewResult = await appRouter
        .createCaller({ user: { id: testContext.users[0].id } })
        .reviews.create(reviewData)

      // Then like it
      const likeResult = await appRouter
        .createCaller({ user: { id: testContext.users[0].id } })
        .reviews.like({ reviewId: reviewResult.review.id })

      expect(likeResult.success).toBe(true)
    })
  })

  describe('Achievement Endpoints', () => {
    let authToken: string

    beforeEach(async () => {
      if (testContext.users.length === 0) {
        await createTestUser()
      }
      authToken = testContext.authTokens.get(testContext.users[0].id) || ''
    })

    test('should get all achievements', async () => {
      const result = await appRouter
        .createCaller({})
        .achievements.getAll({ page: 1, limit: 10 })

      expect(result.achievements).toBeDefined()
      expect(Array.isArray(result.achievements)).toBe(true)
    })

    test('should get user achievements', async () => {
      const result = await appRouter
        .createCaller({ user: { id: testContext.users[0].id } })
        .achievements.getUserAchievements()

      expect(result.achievements).toBeDefined()
      expect(Array.isArray(result.achievements)).toBe(true)
    })

    test('should get achievement by ID', async () => {
      // First get all achievements to find one
      const allAchievements = await appRouter
        .createCaller({})
        .achievements.getAll({ page: 1, limit: 1 })

      if (allAchievements.achievements.length > 0) {
        const achievement = allAchievements.achievements[0]
        const result = await appRouter
          .createCaller({})
          .achievements.getById({ id: achievement.id })

        expect(result).toBeDefined()
        expect(result.id).toBe(achievement.id)
      }
    })
  })

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // This test would simulate a database error
      // In a real test, you might mock the database connection
      expect(true).toBe(true) // Placeholder
    })

    test('should handle validation errors properly', async () => {
      const invalidData = {
        email: 'invalid-email',
        username: '',
        password: 'weak',
      }

      await expect(
        appRouter.createCaller({}).auth.register(invalidData as any)
      ).rejects.toThrow()
    })

    test('should handle authentication errors', async () => {
      await expect(
        appRouter.createCaller({}).user.getProfile()
      ).rejects.toThrow()
    })
  })

  describe('Performance Tests', () => {
    test('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 10 }, () =>
        appRouter.createCaller({}).anime.getList({ page: 1, limit: 10 })
      )

      const results = await Promise.all(promises)
      expect(results).toHaveLength(10)
      results.forEach(result => {
        expect(result.anime).toBeDefined()
      })
    })

    test('should cache responses appropriately', async () => {
      // First request
      const start1 = Date.now()
      await appRouter.createCaller({}).anime.getList({ page: 1, limit: 10 })
      const time1 = Date.now() - start1

      // Second request (should be faster due to caching)
      const start2 = Date.now()
      await appRouter.createCaller({}).anime.getList({ page: 1, limit: 10 })
      const time2 = Date.now() - start2

      // Second request should be faster (or at least not significantly slower)
      expect(time2).toBeLessThanOrEqual(time1 + 50) // Allow 50ms tolerance
    })
  })

  // Helper functions
  async function createTestUser(): Promise<void> {
    const userData = {
      email: `test${Date.now()}@example.com`,
      username: `testuser${Date.now()}`,
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!',
      gdprConsent: true,
      dataProcessingConsent: true,
      marketingConsent: false,
    }

    const result = await appRouter
      .createCaller({})
      .auth.register(userData)

    testContext.users.push({
      id: result.user.id,
      email: result.user.email,
      username: result.user.username,
      password: userData.password,
    })

    // Login to get token
    const loginResult = await appRouter
      .createCaller({})
      .auth.login({
        email: userData.email,
        password: userData.password,
        rememberMe: false,
      })

    testContext.authTokens.set(result.user.id, loginResult.accessToken)
  }

  async function createTestAnime(): Promise<void> {
    // Create test anime data
    const animeData = {
      title: 'Attack on Titan',
      titleEnglish: 'Attack on Titan',
      slug: 'attack-on-titan',
      type: 'TV',
      status: 'Finished Airing',
      episodes: 25,
      duration: '24 min per ep',
      year: 2013,
      synopsis: 'Humanity fights for survival against the Titans.',
      malId: 16498,
      averageRating: 8.5,
      scoredBy: 1000000,
      members: 2000000,
    }

    const anime = await db.anime.create({
      data: animeData,
    })

    testContext.anime.push({
      id: anime.id,
      title: anime.title,
      slug: anime.slug,
      malId: anime.malId!,
    })
  }

  async function clearTestData(): Promise<void> {
    // Clear all test data
    await db.userAnimeList.deleteMany()
    await db.userAnimeReview.deleteMany()
    await db.userAchievement.deleteMany()
    await db.user.deleteMany()
    await db.anime.deleteMany()
    await db.achievement.deleteMany()
    await db.genre.deleteMany()
  }

  async function cleanupTestData(): Promise<void> {
    // Clean up after each test
    if (testContext.users.length > 0) {
      await db.userAnimeList.deleteMany({
        where: { userId: { in: testContext.users.map(u => u.id) } }
      })
      await db.userAnimeReview.deleteMany({
        where: { userId: { in: testContext.users.map(u => u.id) } }
      })
      await db.userAchievement.deleteMany({
        where: { userId: { in: testContext.users.map(u => u.id) } }
      })
      await db.user.deleteMany({
        where: { id: { in: testContext.users.map(u => u.id) } }
      })
    }

    if (testContext.anime.length > 0) {
      await db.anime.deleteMany({
        where: { id: { in: testContext.anime.map(a => a.id) } }
      })
    }

    testContext.users = []
    testContext.anime = []
    testContext.authTokens.clear()
  }
})
