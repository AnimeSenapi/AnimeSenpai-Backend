/**
 * 🎯 AnimeSenpai Recommendation Engine
 * 
 * Phase 1: Content-Based Filtering
 * Phase 2: Collaborative Filtering
 * Phase 3: ML-Enhanced Embeddings
 * 
 * Combines multiple signals for world-class recommendations:
 * - Genre matching (traditional)
 * - Tag similarity (metadata-based)
 * - User similarity (collaborative filtering)
 * - Semantic similarity (ML embeddings from descriptions)
 * - Rating-based predictions
 * - User preference learning
 * 
 * Built for performance, security, and personalization.
 */

import { db } from './db'
import { cache } from './cache'
import { 
  getCollaborativeRecommendations, 
  findSimilarUsers,
  invalidateUserSimilarityCache as invalidateCFCache
} from './collaborative-filtering'
import {
  getAnimeEmbedding,
  findSimilarAnimeByEmbedding,
  calculateSemanticSimilarity,
  calculateConfidenceScore
} from './ml-embeddings'

// Weights for content-based similarity scoring
const WEIGHTS = {
  genreOverlap: 0.35,
  tagSimilarity: 0.20,
  ratingProximity: 0.15,
  yearSimilarity: 0.10,
  typeSimilarity: 0.10,
  popularityBoost: 0.10
}

// Diversity settings
const DIVERSITY = {
  focused: { mainGenre: 0.9, discovery: 0.1 },
  balanced: { mainGenre: 0.7, discovery: 0.3 },
  exploratory: { mainGenre: 0.5, discovery: 0.5 }
}

interface AnimeWithGenres {
  id: string
  title: string
  slug: string
  description: string | null
  coverImage: string | null
  bannerImage: string | null
  year: number | null
  type: string
  episodes: number | null
  rating: string | null
  averageRating: number | null
  viewCount: number
  tags: string[]
  studio: string | null
  genres: Array<{
    genre: {
      id: string
      name: string
      slug: string
    }
  }>
}

interface UserProfile {
  id: string
  favoriteGenres: string[]
  favoriteTags: string[]
  discoveryMode: string
  ratedAnime: Array<{
    animeId: string
    score: number
  }>
  watchedAnime: Array<{
    animeId: string
    status: string
  }>
}

interface RecommendationScore {
  anime: AnimeWithGenres
  score: number
  reason: string
}

/**
 * Calculate Jaccard similarity between two sets
 */
function jaccardSimilarity(set1: string[], set2: string[]): number {
  if (set1.length === 0 && set2.length === 0) return 0
  
  const intersection = set1.filter(item => set2.includes(item)).length
  const union = new Set([...set1, ...set2]).size
  
  return union === 0 ? 0 : intersection / union
}

/**
 * Calculate content-based similarity between two anime
 */
export function calculateAnimeSimilarity(
  anime1: AnimeWithGenres,
  anime2: AnimeWithGenres
): number {
  // Extract genre IDs
  const genres1 = anime1.genres.map(g => g.genre.id)
  const genres2 = anime2.genres.map(g => g.genre.id)
  
  // Genre overlap score
  const genreScore = jaccardSimilarity(genres1, genres2)
  
  // Tag similarity score
  const tagScore = jaccardSimilarity(anime1.tags, anime2.tags)
  
  // Rating proximity score (if both have ratings)
  let ratingScore = 0
  if (anime1.averageRating && anime2.averageRating) {
    const ratingDiff = Math.abs(anime1.averageRating - anime2.averageRating)
    ratingScore = Math.max(0, 1 - (ratingDiff / 10)) // Normalize to 0-1
  }
  
  // Year similarity (prefer anime from similar era)
  let yearScore = 0
  if (anime1.year && anime2.year) {
    const yearDiff = Math.abs(anime1.year - anime2.year)
    yearScore = Math.max(0, 1 - (yearDiff / 20)) // 20 year window
  }
  
  // Type similarity (TV, Movie, OVA, etc.)
  const typeScore = anime1.type === anime2.type ? 1 : 0
  
  // Calculate weighted score
  const similarity =
    WEIGHTS.genreOverlap * genreScore +
    WEIGHTS.tagSimilarity * tagScore +
    WEIGHTS.ratingProximity * ratingScore +
    WEIGHTS.yearSimilarity * yearScore +
    WEIGHTS.typeSimilarity * typeScore
  
  return similarity
}

/**
 * Get embedding-based recommendations from user's top-rated anime
 * Uses semantic similarity from ML embeddings
 * 
 * Performance: Cached, parallel execution
 * Security: No user data exposed, only anime similarity
 */
async function getEmbeddingBasedRecommendations(
  userId: string,
  ratedAnime: Array<{ animeId: string; score: number }>
): Promise<Map<string, number>> {
  const scores = new Map<string, number>()
  
  // Get top 5 rated anime
  const topRated = ratedAnime
    .filter(r => r.score >= 8)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
  
  if (topRated.length === 0) return scores
  
  // For each top-rated anime, find similar ones using embeddings
  const similarAnimePromises = topRated.map(rated =>
    findSimilarAnimeByEmbedding(rated.animeId, 20)
  )
  
  const allSimilar = await Promise.all(similarAnimePromises)
  
  // Aggregate scores
  for (let i = 0; i < topRated.length; i++) {
    const userRating = topRated[i].score
    const similarAnime = allSimilar[i]
    
    for (const similar of similarAnime) {
      const currentScore = scores.get(similar.animeId) || 0
      // Weight by user's rating and similarity
      const weightedScore = (similar.similarity * userRating) / 10
      scores.set(similar.animeId, currentScore + weightedScore)
    }
  }
  
  return scores
}

/**
 * Get user's preference profile from their watch history and ratings
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const cacheKey = `user-profile:${userId}`
  const cached = cache.get<UserProfile>(cacheKey)
  if (cached) return cached
  
  // Get user preferences
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      preferences: true
    }
  })
  
  if (!user) return null
  
  // Get rated anime
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
  
  // Get watched anime
  const watchList = await db.userAnimeList.findMany({
    where: { userId },
    select: {
      animeId: true,
      status: true
    }
  })
  
  const profile: UserProfile = {
    id: userId,
    favoriteGenres: user.preferences?.favoriteGenres || [],
    favoriteTags: user.preferences?.favoriteTags || [],
    discoveryMode: user.preferences?.discoveryMode || 'balanced',
    ratedAnime: ratings.map(r => ({
      animeId: r.animeId,
      score: r.score || 5
    })),
    watchedAnime: watchList
  }
  
  // Cache for 5 minutes
  cache.set(cacheKey, profile, 5 * 60 * 1000)
  
  return profile
}

/**
 * Get anime the user has already interacted with (to exclude from recommendations)
 */
export async function getUserSeenAnime(userId: string): Promise<Set<string>> {
  const seenList = await db.userAnimeList.findMany({
    where: { userId },
    select: { animeId: true }
  })
  
  return new Set(seenList.map(item => item.animeId))
}

/**
 * Get anime the user has dismissed/hidden
 */
export async function getUserDismissedAnime(userId: string): Promise<Set<string>> {
  const dismissed = await db.recommendationFeedback.findMany({
    where: {
      userId,
      feedbackType: { in: ['dismiss', 'hide'] }
    },
    select: { animeId: true }
  })
  
  return new Set(dismissed.map(item => item.animeId))
}

/**
 * Generate "For You" recommendations - main personalized feed
 * Now with TRIPLE hybrid: Content + Collaborative + ML Embeddings!
 * 
 * Security: Only uses data from consenting users, all inputs sanitized
 * Performance: Heavily cached, parallel execution, optimized queries
 */
export async function getForYouRecommendations(
  userId: string,
  limit: number = 20
): Promise<RecommendationScore[]> {
  const profile = await getUserProfile(userId)
  if (!profile) return []
  
  const seenAnime = await getUserSeenAnime(userId)
  const dismissedAnime = await getUserDismissedAnime(userId)
  
  // Get collaborative recommendations in parallel
  const collaborativePromise = getCollaborativeRecommendations(userId, 30)
  
  // Get embedding-based recommendations from user's top-rated anime
  const embeddingSimilaritiesPromise = getEmbeddingBasedRecommendations(
    userId,
    profile.ratedAnime
  )
  
  // Get all anime that user hasn't seen
  const candidateAnime = await db.anime.findMany({
    where: {
      id: {
        notIn: [...seenAnime, ...dismissedAnime]
      }
    },
    include: {
      genres: {
        include: {
          genre: true
        }
      }
    },
    take: 200 // Limit candidates for performance
  })
  
  // Wait for collaborative and embedding results (parallel execution)
  const [collaborativeRecs, embeddingScores] = await Promise.all([
    collaborativePromise,
    embeddingSimilaritiesPromise
  ])
  
  const collaborativeScores = new Map(
    collaborativeRecs.map(rec => [rec.animeId, rec.predictedScore])
  )
  
  // Score each anime using TRIPLE hybrid approach
  const scored: RecommendationScore[] = []
  
  for (const anime of candidateAnime) {
    let contentBasedScore = 0
    let reason = ''
    
    // 1. CONTENT-BASED SCORING (Traditional)
    const animeGenreIds = anime.genres.map(g => g.genre.id)
    const genreMatch = jaccardSimilarity(animeGenreIds, profile.favoriteGenres)
    contentBasedScore += genreMatch * 0.4
    
    if (genreMatch > 0.5) {
      const matchedGenres = anime.genres
        .filter(g => profile.favoriteGenres.includes(g.genre.id))
        .map(g => g.genre.name)
      reason = `Popular in ${matchedGenres.slice(0, 2).join(' & ')}`
    }
    
    const tagMatch = jaccardSimilarity(anime.tags, profile.favoriteTags)
    contentBasedScore += tagMatch * 0.3
    
    if (anime.averageRating) {
      contentBasedScore += (anime.averageRating / 10) * 0.2
    }
    
    const popularityScore = Math.min(anime.viewCount / 10000, 1)
    contentBasedScore += popularityScore * 0.1
    
    // Check similarity to highly rated anime (traditional method)
    if (profile.ratedAnime.length > 0) {
      const topRated = profile.ratedAnime
        .filter(r => r.score >= 8)
        .slice(0, 5)
      
      for (const rated of topRated) {
        const ratedAnime = await db.anime.findUnique({
          where: { id: rated.animeId },
          include: {
            genres: {
              include: { genre: true }
            }
          }
        })
        
        if (ratedAnime) {
          const similarity = calculateAnimeSimilarity(anime, ratedAnime)
          contentBasedScore += similarity * 0.3
          
          if (similarity > 0.6 && !reason) {
            reason = `Similar to ${ratedAnime.title}`
          }
        }
      }
    }
    
    // 2. COLLABORATIVE SCORE (User similarity)
    const collaborativeScore = collaborativeScores.get(anime.id)
    const normalizedCollaborative = collaborativeScore ? collaborativeScore / 10 : 0
    
    // 3. ML EMBEDDING SCORE (Semantic similarity)
    const embeddingScore = embeddingScores.get(anime.id) || 0
    
    // TRIPLE HYBRID SCORING (Phase 3!)
    // Weights: 40% content, 35% collaborative, 25% embeddings
    const finalScore = 
      contentBasedScore * 0.40 +
      normalizedCollaborative * 0.35 +
      embeddingScore * 0.25
    
    // Calculate confidence (how sure we are about this recommendation)
    const confidence = calculateConfidenceScore(
      contentBasedScore,
      collaborativeScore || null,
      embeddingScore > 0 ? embeddingScore : null,
      profile.ratedAnime.length,
      collaborativeRecs.find(r => r.animeId === anime.id)?.similarUserCount || 0
    )
    
    // Update reason based on strongest signal
    if (!reason) {
      if (embeddingScore > normalizedCollaborative && embeddingScore > contentBasedScore) {
        reason = 'Matches your taste perfectly'
      } else if (collaborativeScore && collaborativeScore > 7) {
        reason = 'Fans with similar taste loved this'
      } else {
        reason = 'Recommended for you'
      }
    }
    
    scored.push({
      anime,
      score: finalScore,
      reason
    })
  }
  
  // Sort by hybrid score
  scored.sort((a, b) => b.score - a.score)
  
  // Apply diversity based on discovery mode
  const diversitySettings = DIVERSITY[profile.discoveryMode as keyof typeof DIVERSITY] || DIVERSITY.balanced
  const mainCount = Math.floor(limit * diversitySettings.mainGenre)
  const discoveryCount = limit - mainCount
  
  // Take top scores for main recommendations
  const mainRecommendations = scored.slice(0, mainCount)
  
  // Take some from different genres for discovery
  const usedGenres = new Set<string>()
  mainRecommendations.forEach(rec => {
    rec.anime.genres.forEach(g => usedGenres.add(g.genre.id))
  })
  
  const discoveryRecommendations = scored
    .slice(mainCount)
    .filter(rec => {
      const hasNewGenre = rec.anime.genres.some(g => !usedGenres.has(g.genre.id))
      return hasNewGenre
    })
    .slice(0, discoveryCount)
  
  return [...mainRecommendations, ...discoveryRecommendations].slice(0, limit)
}

/**
 * Get "Because You Watched X" recommendations
 */
export async function getBecauseYouWatchedRecommendations(
  userId: string,
  sourceAnimeId: string,
  limit: number = 12
): Promise<RecommendationScore[]> {
  const sourceAnime = await db.anime.findUnique({
    where: { id: sourceAnimeId },
    include: {
      genres: {
        include: { genre: true }
      }
    }
  })
  
  if (!sourceAnime) return []
  
  const seenAnime = await getUserSeenAnime(userId)
  const dismissedAnime = await getUserDismissedAnime(userId)
  
  // Get similar anime
  const candidateAnime = await db.anime.findMany({
    where: {
      id: {
        notIn: [sourceAnimeId, ...seenAnime, ...dismissedAnime]
      }
    },
    include: {
      genres: {
        include: { genre: true }
      }
    },
    take: 100
  })
  
  // Calculate similarity scores
  const scored = candidateAnime.map(anime => ({
    anime,
    score: calculateAnimeSimilarity(sourceAnime, anime),
    reason: `Because you watched ${sourceAnime.title}`
  }))
  
  // Sort and return top matches
  scored.sort((a, b) => b.score - a.score)
  
  return scored.slice(0, limit)
}

/**
 * Get hidden gems - high quality but less popular anime
 */
export async function getHiddenGems(
  userId: string,
  limit: number = 8
): Promise<RecommendationScore[]> {
  const profile = await getUserProfile(userId)
  if (!profile) return []
  
  const seenAnime = await getUserSeenAnime(userId)
  const dismissedAnime = await getUserDismissedAnime(userId)
  
  // Find high-rated but less popular anime
  const gems = await db.anime.findMany({
    where: {
      id: {
        notIn: [...seenAnime, ...dismissedAnime]
      },
      averageRating: { gte: 8 }, // High quality
      viewCount: { lt: 5000 } // Not too popular
    },
    include: {
      genres: {
        include: { genre: true }
      }
    },
    take: 50
  })
  
  // Score based on genre match
  const scored = gems.map(anime => {
    const animeGenreIds = anime.genres.map(g => g.genre.id)
    const genreMatch = jaccardSimilarity(animeGenreIds, profile.favoriteGenres)
    
    return {
      anime,
      score: genreMatch + (anime.averageRating || 0) / 10,
      reason: 'Hidden gem you might love'
    }
  })
  
  scored.sort((a, b) => b.score - a.score)
  
  return scored.slice(0, limit)
}

/**
 * Get trending anime in user's favorite genres
 */
export async function getTrendingInFavoriteGenres(
  userId: string,
  limit: number = 12
): Promise<RecommendationScore[]> {
  const profile = await getUserProfile(userId)
  if (!profile || profile.favoriteGenres.length === 0) {
    // Return overall trending if no preferences
    return getTrendingAnime(limit)
  }
  
  const seenAnime = await getUserSeenAnime(userId)
  
  const trending = await db.anime.findMany({
    where: {
      id: { notIn: [...seenAnime] },
      genres: {
        some: {
          genreId: {
            in: profile.favoriteGenres
          }
        }
      }
    },
    include: {
      genres: {
        include: { genre: true }
      }
    },
    orderBy: [
      { viewCount: 'desc' },
      { averageRating: 'desc' }
    ],
    take: limit
  })
  
  const genres = await db.genre.findMany({
    where: { id: { in: profile.favoriteGenres } },
    select: { name: true }
  })
  
  const genreNames = genres.map(g => g.name).join(' & ')
  
  return trending.map(anime => ({
    anime,
    score: 1,
    reason: `Trending in ${genreNames}`
  }))
}

/**
 * Get overall trending anime (non-personalized)
 */
export async function getTrendingAnime(limit: number = 12): Promise<RecommendationScore[]> {
  const cacheKey = 'trending-anime'
  const cached = cache.get<RecommendationScore[]>(cacheKey)
  if (cached) return cached.slice(0, limit)
  
  const trending = await db.anime.findMany({
    include: {
      genres: {
        include: { genre: true }
      }
    },
    orderBy: [
      { viewCount: 'desc' },
      { averageRating: 'desc' }
    ],
    take: 50
  })
  
  const result = trending.map(anime => ({
    anime,
    score: 1,
    reason: 'Trending now'
  }))
  
  // Cache for 1 hour (3600 seconds)
  cache.set(cacheKey, result, 3600)
  
  return result.slice(0, limit)
}

/**
 * Get new releases
 */
export async function getNewReleases(limit: number = 12): Promise<RecommendationScore[]> {
  const newAnime = await db.anime.findMany({
    include: {
      genres: {
        include: { genre: true }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: limit
  })
  
  return newAnime.map(anime => ({
    anime,
    score: 1,
    reason: 'New on AnimeSenpai'
  }))
}

/**
 * Get "Expand Your Horizons" - Discovery mode recommendations
 * Intentionally different from user's usual preferences
 */
export async function getDiscoveryRecommendations(
  userId: string,
  limit: number = 10
): Promise<RecommendationScore[]> {
  const profile = await getUserProfile(userId)
  if (!profile) return []
  
  const seenAnime = await getUserSeenAnime(userId)
  const dismissedAnime = await getUserDismissedAnime(userId)
  
  // Get all genres
  const allGenres = await db.genre.findMany({
    select: { id: true, name: true }
  })
  
  // Find genres user hasn't explored much
  const unexploredGenres = allGenres
    .filter(g => !profile.favoriteGenres.includes(g.id))
    .map(g => g.id)
  
  // Get high-quality anime from unexplored genres
  const discoveryAnime = await db.anime.findMany({
    where: {
      id: {
        notIn: [...seenAnime, ...dismissedAnime]
      },
      averageRating: { gte: 7.5 }, // Only recommend quality anime for discovery
      genres: {
        some: {
          genreId: {
            in: unexploredGenres
          }
        }
      }
    },
    include: {
      genres: {
        include: { genre: true }
      }
    },
    orderBy: {
      averageRating: 'desc'
    },
    take: limit
  })
  
  return discoveryAnime.map(anime => {
    const newGenres = anime.genres
      .filter(g => !profile.favoriteGenres.includes(g.genre.id))
      .map(g => g.genre.name)
    
    return {
      anime,
      score: anime.averageRating || 0,
      reason: newGenres.length > 0 
        ? `Discover ${newGenres[0]}` 
        : 'Expand your horizons'
    }
  })
}

/**
 * Get "Finish What You Started" - anime user is currently watching
 */
export async function getContinueWatchingRecommendations(
  userId: string,
  limit: number = 6
): Promise<RecommendationScore[]> {
  const watching = await db.userAnimeList.findMany({
    where: {
      userId,
      status: 'watching',
      updatedAt: {
        lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Not updated in 7 days
      }
    },
    orderBy: {
      updatedAt: 'desc'
    },
    take: limit
  })
  
  const animeIds = watching.map(w => w.animeId)
  const animeDetails = await db.anime.findMany({
    where: {
      id: { in: animeIds }
    },
    include: {
      genres: {
        include: { genre: true }
      }
    }
  })
  
  return animeDetails.map(anime => ({
    anime,
    score: 1,
    reason: 'Continue watching'
  }))
}

/**
 * Track user interaction for future recommendation improvements
 */
export async function trackInteraction(
  userId: string,
  animeId: string | null,
  actionType: string,
  metadata?: any,
  duration?: number
): Promise<void> {
  try {
    await db.userInteraction.create({
      data: {
        userId,
        animeId,
        actionType,
        metadata: metadata ? JSON.stringify(metadata) : null,
        duration
      }
    })
  } catch (error) {
    // Don't fail requests if tracking fails
    console.error('Failed to track interaction:', error)
  }
}

/**
 * Submit feedback on recommendation (hide/dismiss)
 */
export async function submitRecommendationFeedback(
  userId: string,
  animeId: string,
  feedbackType: 'dismiss' | 'hide' | 'not_interested_genre',
  reason?: string
): Promise<void> {
  await db.recommendationFeedback.upsert({
    where: {
      userId_animeId: {
        userId,
        animeId
      }
    },
    create: {
      userId,
      animeId,
      feedbackType,
      reason
    },
    update: {
      feedbackType,
      reason,
      createdAt: new Date() // Update timestamp
    }
  })
  
  // Clear all caches for this user
  invalidateUserCaches(userId)
}

/**
 * Invalidate all user-related caches
 * Call this when user rates anime or changes preferences
 * 
 * Performance: Clears caches so fresh recommendations are generated
 */
export function invalidateUserCaches(userId: string): void {
  cache.delete(`user-profile:${userId}`)
  invalidateCFCache(userId) // Clear collaborative filtering caches
}

/**
 * Get "Fans Like You Also Watched" - Pure collaborative filtering section
 * 
 * Security: Doesn't reveal which specific users are similar
 * Performance: Uses cached user similarities
 */
export async function getFansLikeYouRecommendations(
  userId: string,
  limit: number = 12
): Promise<RecommendationScore[]> {
  const seenAnime = await getUserSeenAnime(userId)
  const dismissedAnime = await getUserDismissedAnime(userId)
  
  // Get collaborative recommendations
  const collaborativeRecs = await getCollaborativeRecommendations(userId, limit * 2)
  
  // Filter out seen/dismissed anime
  const filtered = collaborativeRecs.filter(rec => 
    !seenAnime.has(rec.animeId) && !dismissedAnime.has(rec.animeId)
  )
  
  // Get anime details
  const animeIds = filtered.slice(0, limit).map(r => r.animeId)
  const animeDetails = await db.anime.findMany({
    where: {
      id: { in: animeIds }
    },
    include: {
      genres: {
        include: {
          genre: true
        }
      }
    }
  })
  
  // Create map for quick lookup
  const animeMap = new Map(animeDetails.map(a => [a.id, a]))
  
  // Build recommendations with scores
  const recommendations: RecommendationScore[] = []
  
  for (const rec of filtered.slice(0, limit)) {
    const anime = animeMap.get(rec.animeId)
    if (!anime) continue
    
    recommendations.push({
      anime,
      score: rec.predictedScore,
      reason: rec.similarUserCount > 5 
        ? 'Highly recommended by fans like you'
        : 'Fans with similar taste loved this'
    })
  }
  
  return recommendations
}

