/**
 * Unit tests for user router
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import { userRouter } from '../user'
import { createMockProtectedContext, createMockUser, setupTestDatabase } from '../../tests/helpers/test-setup'
import { db } from '../../lib/db'

setupTestDatabase()

describe('User Router', () => {
  let testUser: any
  let testRole: any

  beforeEach(async () => {
    // Create default role
    testRole = await db.role.create({
      data: {
        name: 'user',
        isDefault: true,
        permissions: [],
      },
    })

    // Create test user
    testUser = await db.user.create({
      data: {
        email: 'testuser@example.com',
        username: 'testuser',
        password: 'hashed-password',
        primaryRoleId: testRole.id,
        emailVerified: true,
        gdprConsent: true,
        dataProcessingConsent: true,
        preferences: {
          create: {},
        },
      },
      include: {
        primaryRole: true,
        preferences: true,
      },
    })
  })

  describe('getAnimeList', () => {
    test('should return empty list for user with no anime', async () => {
      const mockContext = createMockProtectedContext({
        ...testUser,
        role: testUser.primaryRole?.name || 'user',
      })

      const caller = userRouter.createCaller(mockContext)

      const result = await caller.getAnimeList({})

      expect(result).toHaveProperty('items')
      expect(result).toHaveProperty('total')
      expect(result).toHaveProperty('page')
      expect(result).toHaveProperty('limit')
      expect(result.items).toHaveLength(0)
      expect(result.total).toBe(0)
    })

    test('should filter by status', async () => {
      // Create test anime
      const anime = await db.anime.create({
        data: {
          malId: 1,
          title: 'Test Anime',
          slug: 'test-anime',
          type: 'TV',
          status: 'Airing',
        },
      })

      // Add anime to user's list with watching status
      await db.userAnimeList.create({
        data: {
          userId: testUser.id,
          animeId: anime.id,
          status: 'watching',
        },
      })

      const mockContext = createMockProtectedContext({
        ...testUser,
        role: testUser.primaryRole?.name || 'user',
      })

      const caller = userRouter.createCaller(mockContext)

      const result = await caller.getAnimeList({ status: 'watching' })

      expect(result.items).toHaveLength(1)
      expect(result.items[0].status).toBe('watching')
    })

    test('should paginate results', async () => {
      // Create multiple anime entries
      const anime1 = await db.anime.create({
        data: {
          malId: 1,
          title: 'Anime 1',
          slug: 'anime-1',
          type: 'TV',
          status: 'Airing',
        },
      })

      const anime2 = await db.anime.create({
        data: {
          malId: 2,
          title: 'Anime 2',
          slug: 'anime-2',
          type: 'TV',
          status: 'Airing',
        },
      })

      await db.userAnimeList.createMany({
        data: [
          { userId: testUser.id, animeId: anime1.id, status: 'watching' },
          { userId: testUser.id, animeId: anime2.id, status: 'watching' },
        ],
      })

      const mockContext = createMockProtectedContext({
        ...testUser,
        role: testUser.primaryRole?.name || 'user',
      })

      const caller = userRouter.createCaller(mockContext)

      const result = await caller.getAnimeList({ page: 1, limit: 1 })

      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(2)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(1)
    })
  })

  describe('addAnimeToList', () => {
    test('should add anime to user list', async () => {
      const anime = await db.anime.create({
        data: {
          malId: 1,
          title: 'Test Anime',
          slug: 'test-anime',
          type: 'TV',
          status: 'Airing',
        },
      })

      const mockContext = createMockProtectedContext({
        ...testUser,
        role: testUser.primaryRole?.name || 'user',
      })

      const caller = userRouter.createCaller(mockContext)

      const result = await caller.addAnimeToList({
        animeId: anime.id,
        status: 'watching',
      })

      expect(result).toHaveProperty('id')
      expect(result.status).toBe('watching')

      // Verify it was added to database
      const listItem = await db.userAnimeList.findFirst({
        where: {
          userId: testUser.id,
          animeId: anime.id,
        },
      })
      expect(listItem).not.toBeNull()
      expect(listItem?.status).toBe('watching')
    })

    test('should update existing anime in list', async () => {
      const anime = await db.anime.create({
        data: {
          malId: 1,
          title: 'Test Anime',
          slug: 'test-anime',
          type: 'TV',
          status: 'Airing',
        },
      })

      // Add anime with watching status
      await db.userAnimeList.create({
        data: {
          userId: testUser.id,
          animeId: anime.id,
          status: 'watching',
        },
      })

      const mockContext = createMockProtectedContext({
        ...testUser,
        role: testUser.primaryRole?.name || 'user',
      })

      const caller = userRouter.createCaller(mockContext)

      // Update to completed
      const result = await caller.addAnimeToList({
        animeId: anime.id,
        status: 'completed',
      })

      expect(result.status).toBe('completed')

      // Verify update
      const listItem = await db.userAnimeList.findFirst({
        where: {
          userId: testUser.id,
          animeId: anime.id,
        },
      })
      expect(listItem?.status).toBe('completed')
    })
  })
})
