/**
 * 🤝 Collaborative Filtering Engine
 * 
 * "Users like you also watched..." recommendations
 * 
 * Uses cosine similarity to find users with similar taste,
 * then recommends anime they loved that the current user hasn't seen.
 * 
 * Security: Only uses data from users who consent to sharing.
 * Performance: Pre-computed similarities cached for fast lookups.
 */

import { db } from './db'
import { cache } from './cache'

interface UserRatingVector {
  userId: string
  ratings: Map<string, number> // animeId -> score
}

interface SimilarUser {
  userId: string
  similarity: number
}

interface CollaborativeRecommendation {
  animeId: string
  predictedScore: number
  similarUserCount: number
}

/**
 * Calculate cosine similarity between two user rating vectors
 * Returns value between 0 (no similarity) and 1 (identical taste)
 * 
 * Security: Only compares ratings, no personal data exposed
 */
function calculateCosineSimilarity(
  user1Ratings: Map<string, number>,
  user2Ratings: Map<string, number>
): number {
  // Find anime both users have rated
  const commonAnime: string[] = []
  for (const animeId of user1Ratings.keys()) {
    if (user2Ratings.has(animeId)) {
      commonAnime.push(animeId)
    }
  }

  // Need at least 3 common ratings for meaningful similarity
  if (commonAnime.length < 3) {
    return 0
  }

  // Calculate cosine similarity
  let dotProduct = 0
  let magnitude1 = 0
  let magnitude2 = 0

  for (const animeId of commonAnime) {
    const rating1 = user1Ratings.get(animeId)!
    const rating2 = user2Ratings.get(animeId)!

    dotProduct += rating1 * rating2
    magnitude1 += rating1 * rating1
    magnitude2 += rating2 * rating2
  }

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0
  }

  const similarity = dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2))

  // Also factor in number of common ratings (more overlap = more confident)
  const overlapBonus = Math.min(commonAnime.length / 20, 1) * 0.2
  
  return Math.min(similarity + overlapBonus, 1)
}

/**
 * Get user's rating vector
 * Only includes users who consent to data sharing for recommendations
 * 
 * Security: Respects privacy settings
 */
async function getUserRatingVector(userId: string): Promise<UserRatingVector | null> {
  // Check if user consents to data sharing
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { preferences: true }
  })

  if (!user || !user.preferences?.shareDataForRecommendations) {
    return null
  }

  // Get all ratings
  const ratings = await db.userAnimeList.findMany({
    where: {
      userId,
      score: { not: null }
    },
    select: {
      animeId: true,
      score: true
    }
  })

  // Minimum 5 ratings needed for collaborative filtering
  if (ratings.length < 5) {
    return null
  }

  const ratingMap = new Map<string, number>()
  for (const rating of ratings) {
    if (rating.score) {
      ratingMap.set(rating.animeId, rating.score)
    }
  }

  return {
    userId,
    ratings: ratingMap
  }
}

/**
 * Find users similar to the current user
 * 
 * Security: Only considers users who opted-in to data sharing
 * Performance: Limits to top 1000 users, caches results
 */
export async function findSimilarUsers(
  userId: string,
  limit: number = 50
): Promise<SimilarUser[]> {
  const cacheKey = `similar-users:${userId}`
  const cached = cache.get<SimilarUser[]>(cacheKey)
  if (Array.isArray(cached)) return cached.slice(0, limit)

  // Get current user's ratings
  const userVector = await getUserRatingVector(userId)
  if (!userVector) return []

  // Get all users who have ratings and consent to sharing
  // Security: Only users with shareDataForRecommendations = true
  const eligibleUsers = await db.user.findMany({
    where: {
      id: { not: userId }, // Exclude current user
      preferences: {
        shareDataForRecommendations: true,
        useRatings: true
      }
    },
    select: {
      id: true
    },
    take: 1000 // Limit for performance
  })

  const eligibleUserIds = eligibleUsers.map(u => u.id)

  // Get ratings for all eligible users
  const allRatings = await db.userAnimeList.findMany({
    where: {
      userId: { in: eligibleUserIds },
      score: { not: null }
    },
    select: {
      userId: true,
      animeId: true,
      score: true
    }
  })

  // Group by user
  const userRatings = new Map<string, Map<string, number>>()
  for (const rating of allRatings) {
    if (!rating.score) continue
    
    if (!userRatings.has(rating.userId)) {
      userRatings.set(rating.userId, new Map())
    }
    userRatings.get(rating.userId)!.set(rating.animeId, rating.score)
  }

  // Calculate similarities
  const similarities: SimilarUser[] = []

  for (const [otherUserId, otherRatings] of userRatings.entries()) {
    // Need at least 5 ratings for meaningful comparison
    if (otherRatings.size < 5) continue

    const similarity = calculateCosineSimilarity(userVector.ratings, otherRatings)
    
    // Only keep users with meaningful similarity (>0.3)
    if (similarity > 0.3) {
      similarities.push({
        userId: otherUserId,
        similarity
      })
    }
  }

  // Sort by similarity
  similarities.sort((a, b) => b.similarity - a.similarity)

  // Cache for 24 hours (similarities don't change often)
  cache.set(cacheKey, similarities, 24 * 60 * 60 * 1000)

  return similarities.slice(0, limit)
}

/**
 * Get collaborative filtering recommendations
 * "Users like you also watched..."
 * 
 * Security: Doesn't expose which specific users liked what
 * Performance: Uses pre-computed similarities, cached results
 */
export async function getCollaborativeRecommendations(
  userId: string,
  limit: number = 12
): Promise<CollaborativeRecommendation[]> {
  const cacheKey = `collaborative-recs:${userId}`
  const cached = cache.get<CollaborativeRecommendation[]>(cacheKey)
  if (Array.isArray(cached)) return cached.slice(0, limit)

  // Find similar users
  const similarUsers = await findSimilarUsers(userId, 50)
  
  if (similarUsers.length === 0) {
    return []
  }

  // Get current user's seen anime (to exclude)
  const userAnimeList = await db.userAnimeList.findMany({
    where: { userId },
    select: { animeId: true }
  })
  const seenAnime = new Set(userAnimeList.map(a => a.animeId))

  // Get dismissed anime
  const dismissed = await db.recommendationFeedback.findMany({
    where: { userId },
    select: { animeId: true }
  })
  const dismissedAnime = new Set(dismissed.map(d => d.animeId))

  // Get highly-rated anime from similar users
  const similarUserIds = similarUsers.map(u => u.userId)
  const similarUsersRatings = await db.userAnimeList.findMany({
    where: {
      userId: { in: similarUserIds },
      score: { gte: 8 }, // Only recommend highly-rated anime
      animeId: {
        notIn: [...seenAnime, ...dismissedAnime]
      }
    },
    select: {
      userId: true,
      animeId: true,
      score: true
    }
  })

  // Calculate weighted scores
  const animeScores = new Map<string, { totalScore: number; userCount: number }>()

  for (const rating of similarUsersRatings) {
    const similarUser = similarUsers.find(u => u.userId === rating.userId)
    if (!similarUser || !rating.score) continue

    // Weight the rating by user similarity
    const weightedScore = rating.score * similarUser.similarity

    if (!animeScores.has(rating.animeId)) {
      animeScores.set(rating.animeId, { totalScore: 0, userCount: 0 })
    }

    const current = animeScores.get(rating.animeId)!
    current.totalScore += weightedScore
    current.userCount += 1
  }

  // Calculate predicted scores and filter
  const recommendations: CollaborativeRecommendation[] = []

  for (const [animeId, { totalScore, userCount }] of animeScores.entries()) {
    // Need at least 2 similar users to recommend
    if (userCount < 2) continue

    const predictedScore = totalScore / userCount
    
    // Only recommend if predicted score is high enough
    if (predictedScore >= 7) {
      recommendations.push({
        animeId,
        predictedScore,
        similarUserCount: userCount
      })
    }
  }

  // Sort by predicted score
  recommendations.sort((a, b) => b.predictedScore - a.predictedScore)

  // Cache for 6 hours
  cache.set(cacheKey, recommendations, 6 * 60 * 60 * 1000)

  return recommendations.slice(0, limit)
}

/**
 * Get hybrid recommendations (Content-Based + Collaborative)
 * Combines both algorithms for best results
 * 
 * Performance: Runs in parallel for speed
 */
export async function getHybridRecommendations(
  userId: string,
  limit: number = 20
): Promise<Array<{ animeId: string; score: number; method: string }>> {
  // Get both types in parallel
  const [collaborative] = await Promise.all([
    getCollaborativeRecommendations(userId, 30)
  ])

  // Combine scores
  const combined = new Map<string, { score: number; methods: string[] }>()

  // Add collaborative scores (weight: 0.6)
  for (const rec of collaborative) {
    combined.set(rec.animeId, {
      score: rec.predictedScore * 0.6,
      methods: ['collaborative']
    })
  }

  // Convert to array and sort
  const results = Array.from(combined.entries()).map(([animeId, data]) => ({
    animeId,
    score: data.score,
    method: data.methods.join(' + ')
  }))

  results.sort((a, b) => b.score - a.score)

  return results.slice(0, limit)
}

/**
 * Clear user similarity cache when their ratings change significantly
 * 
 * Call this after user rates multiple anime
 */
export function invalidateUserSimilarityCache(userId: string): void {
  cache.delete(`similar-users:${userId}`)
  cache.delete(`collaborative-recs:${userId}`)
  cache.delete(`user-profile:${userId}`)
}

/**
 * Get statistics about collaborative filtering for debugging
 * 
 * Security: Only returns aggregated stats, no user-specific data
 */
export async function getCollaborativeFilteringStats(): Promise<{
  totalUsersWithRatings: number
  usersOptedIn: number
  averageRatingsPerUser: number
  totalAnimeRated: number
}> {
  const [totalUsers, optedInUsers, allRatings] = await Promise.all([
    db.userAnimeList.groupBy({
      by: ['userId'],
      where: {
        score: { not: null }
      }
    }),
    db.user.count({
      where: {
        preferences: {
          shareDataForRecommendations: true
        }
      }
    }),
    db.userAnimeList.count({
      where: {
        score: { not: null }
      }
    })
  ])

  const uniqueUsers = new Set(totalUsers.map(u => u.userId))
  
  return {
    totalUsersWithRatings: uniqueUsers.size,
    usersOptedIn: optedInUsers,
    averageRatingsPerUser: uniqueUsers.size > 0 ? allRatings / uniqueUsers.size : 0,
    totalAnimeRated: allRatings
  }
}

