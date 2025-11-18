import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { 
  calculateAnimeSimilarity,
  getUserProfile,
  getUserSeenAnime,
  getForYouRecommendations,
  getBecauseYouWatchedRecommendations,
  getHiddenGems,
  getTrendingAnime,
  getDiscoveryRecommendations
} from '../recommendations'
import { db } from '../db'

describe('Recommendations Engine', () => {
  let testUserId: string
  let testAnimeIds: string[] = []

  beforeEach(async () => {
    // Create test user
    const user = await db.user.create({
      data: {
        email: `test${Date.now()}@example.com`,
        password: 'hashedpassword',
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

    // Create test anime
    const anime1 = await db.anime.create({
      data: {
        title: 'Test Anime 1',
        slug: 'test-anime-1',
        type: 'TV',
        year: 2020,
        averageRating: 8.5,
        viewCount: 10000,
        tags: ['action', 'adventure'],
        genres: {
          create: [
            {
              genre: {
                connectOrCreate: {
                  where: { slug: 'action' },
                  create: { name: 'Action', slug: 'action' }
                }
              }
            }
          ]
        }
      }
    })

    const anime2 = await db.anime.create({
      data: {
        title: 'Test Anime 2',
        slug: 'test-anime-2',
        type: 'TV',
        year: 2021,
        averageRating: 8.0,
        viewCount: 5000,
        tags: ['action', 'drama'],
        genres: {
          create: [
            {
              genre: {
                connectOrCreate: {
                  where: { slug: 'action' },
                  create: { name: 'Action', slug: 'action' }
                }
              }
            }
          ]
        }
      }
    })

    testAnimeIds = [anime1.id, anime2.id]
  })

  afterEach(async () => {
    // Cleanup
    if (testUserId) {
      await db.userAnimeList.deleteMany({ where: { userId: testUserId } })
      await db.user.delete({ where: { id: testUserId } })
    }
    if (testAnimeIds.length > 0) {
      await db.anime.deleteMany({ where: { id: { in: testAnimeIds } } })
    }
  })

  describe('calculateAnimeSimilarity', () => {
    test('should calculate similarity between similar anime', async () => {
      const anime1 = await db.anime.findUnique({
        where: { id: testAnimeIds[0] },
        include: { genres: { include: { genre: true } } }
      })
      const anime2 = await db.anime.findUnique({
        where: { id: testAnimeIds[1] },
        include: { genres: { include: { genre: true } } }
      })

      if (!anime1 || !anime2) {
        throw new Error('Test anime not found')
      }

      const similarity = calculateAnimeSimilarity(anime1, anime2)
      
      // Should have some similarity (both are action anime)
      expect(similarity).toBeGreaterThan(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })

    test('should return 0 for completely different anime', async () => {
      const anime1 = await db.anime.findUnique({
        where: { id: testAnimeIds[0] },
        include: { genres: { include: { genre: true } } }
      })

      const anime3 = await db.anime.create({
        data: {
          title: 'Completely Different Anime',
          slug: 'different-anime',
          type: 'Movie',
          year: 1990,
          averageRating: 7.0,
          viewCount: 1000,
          tags: ['romance', 'slice-of-life'],
          genres: {
            create: [
              {
                genre: {
                  connectOrCreate: {
                    where: { slug: 'romance' },
                    create: { name: 'Romance', slug: 'romance' }
                  }
                }
              }
            ]
          }
        }
      })

      if (!anime1) {
        throw new Error('Test anime not found')
      }

      const anime3WithGenres = await db.anime.findUnique({
        where: { id: anime3.id },
        include: { genres: { include: { genre: true } } }
      })

      if (!anime3WithGenres) {
        throw new Error('Anime 3 not found')
      }

      const similarity = calculateAnimeSimilarity(anime1, anime3WithGenres)
      
      // Should have low similarity
      expect(similarity).toBeLessThan(0.5)

      // Cleanup
      await db.anime.delete({ where: { id: anime3.id } })
    })
  })

  describe('getUserProfile', () => {
    test('should return user profile with preferences', async () => {
      const profile = await getUserProfile(testUserId)
      
      expect(profile).not.toBeNull()
      expect(profile?.id).toBe(testUserId)
      expect(profile?.favoriteGenres).toBeDefined()
      expect(profile?.favoriteTags).toBeDefined()
      expect(profile?.discoveryMode).toBeDefined()
    })

    test('should return null for non-existent user', async () => {
      const profile = await getUserProfile('non-existent-id')
      expect(profile).toBeNull()
    })
  })

  describe('getUserSeenAnime', () => {
    test('should return empty set for user with no watched anime', async () => {
      const seenAnime = await getUserSeenAnime(testUserId)
      expect(seenAnime.size).toBe(0)
    })

    test('should return set of watched anime IDs', async () => {
      // Add anime to user's list
      await db.userAnimeList.create({
        data: {
          userId: testUserId,
          animeId: testAnimeIds[0],
          status: 'completed'
        }
      })

      const seenAnime = await getUserSeenAnime(testUserId)
      expect(seenAnime.size).toBe(1)
      expect(seenAnime.has(testAnimeIds[0])).toBe(true)
    })
  })

  describe('getForYouRecommendations', () => {
    test('should return recommendations for user', async () => {
      const recommendations = await getForYouRecommendations(testUserId, 10)
      
      expect(Array.isArray(recommendations)).toBe(true)
      recommendations.forEach(rec => {
        expect(rec).toHaveProperty('anime')
        expect(rec).toHaveProperty('score')
        expect(rec).toHaveProperty('reason')
      })
    })

    test('should exclude seen anime from recommendations', async () => {
      // Mark anime as watched
      await db.userAnimeList.create({
        data: {
          userId: testUserId,
          animeId: testAnimeIds[0],
          status: 'completed'
        }
      })

      const recommendations = await getForYouRecommendations(testUserId, 10)
      
      // Should not include watched anime
      const watchedAnimeInRecs = recommendations.some(rec => rec.anime.id === testAnimeIds[0])
      expect(watchedAnimeInRecs).toBe(false)
    })
  })

  describe('getBecauseYouWatchedRecommendations', () => {
    test('should return recommendations based on watched anime', async () => {
      const recommendations = await getBecauseYouWatchedRecommendations(
        testUserId,
        testAnimeIds[0],
        10
      )

      expect(Array.isArray(recommendations)).toBe(true)
      recommendations.forEach(rec => {
        expect(rec.anime.id).not.toBe(testAnimeIds[0])
        expect(rec.reason).toContain('Because you watched')
      })
    })
  })

  describe('getHiddenGems', () => {
    test('should return high-rated but less popular anime', async () => {
      const gems = await getHiddenGems(testUserId, 8)
      
      expect(Array.isArray(gems)).toBe(true)
      gems.forEach(gem => {
        expect(gem.anime.averageRating).toBeGreaterThanOrEqual(8)
        expect(gem.anime.viewCount).toBeLessThan(5000)
      })
    })
  })

  describe('getTrendingAnime', () => {
    test('should return trending anime', async () => {
      const trending = await getTrendingAnime(10)
      
      expect(Array.isArray(trending)).toBe(true)
      expect(trending.length).toBeLessThanOrEqual(10)
    })
  })

  describe('getDiscoveryRecommendations', () => {
    test('should return recommendations from unexplored genres', async () => {
      const discovery = await getDiscoveryRecommendations(testUserId, 10)
      
      expect(Array.isArray(discovery)).toBe(true)
      discovery.forEach(rec => {
        expect(rec.reason).toMatch(/Discover|Expand/)
      })
    })
  })
})

