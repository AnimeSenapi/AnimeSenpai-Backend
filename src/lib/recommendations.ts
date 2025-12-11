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

import { db, getCacheStrategy } from './db.js'
import { 
  getCollaborativeRecommendations, 
  invalidateUserSimilarityCache as invalidateCFCache
} from './collaborative-filtering.js'
import {
  findSimilarAnimeByEmbedding
} from './ml-embeddings.js'

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
  favoritedAnime: string[] // Anime IDs the user has favorited
  planToWatchAnime: string[] // Anime IDs in plan-to-watch list
  currentlyWatchingAnime: string[] // Anime IDs currently being watched
  completedAnime: string[] // Anime IDs user has completed
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
  _userId: string,
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
    const ratedItem = topRated[i]
    const similarAnime = allSimilar[i]
    if (!ratedItem || !similarAnime) continue
    
    const userRating = ratedItem.score
    
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
 * Calculate favorite genres from user's watch history and ratings
 * Analyzes all watched/rated anime and returns top genres weighted by ratings
 */
async function calculateFavoriteGenresFromHistory(
  watchList: Array<{ animeId: string; status: string }>,
  ratings: Array<{ animeId: string; score: number }>
): Promise<string[]> {
  if (watchList.length === 0) return []
  
  // Get all anime IDs the user has interacted with
  const animeIds = new Set<string>()
  watchList.forEach(item => animeIds.add(item.animeId))
  ratings.forEach(r => animeIds.add(r.animeId))
  
  if (animeIds.size === 0) return []
  
  // Get anime with their genres - cached by Prisma Accelerate
  const animeWithGenres = await db.anime.findMany({
    where: {
      id: { in: Array.from(animeIds) }
    },
    include: {
      genres: {
        include: {
          genre: true
        }
      }
    },
    ...getCacheStrategy(300) // 5 minutes
  })
  
  // Create rating map for quick lookup
  const ratingMap = new Map<string, number>()
  ratings.forEach(r => {
    ratingMap.set(r.animeId, r.score)
  })
  
  // Count genre frequency weighted by ratings
  const genreScores = new Map<string, number>()
  
  for (const anime of animeWithGenres) {
    const userRating = ratingMap.get(anime.id)
    // Weight: rated anime get rating/10, unrated get 0.5 (neutral)
    const weight = userRating ? userRating / 10 : 0.5
    
    // Also weight by watch status: completed > watching > plan-to-watch
    let statusWeight = 1.0
    const watchItem = watchList.find(w => w.animeId === anime.id)
    if (watchItem) {
      if (watchItem.status === 'completed') statusWeight = 1.2
      else if (watchItem.status === 'watching') statusWeight = 1.0
      else if (watchItem.status === 'plan-to-watch') statusWeight = 0.7
    }
    
    const finalWeight = weight * statusWeight
    
    // Add score for each genre
    anime.genres.forEach((g: { genre: { id: string } }) => {
      const genreId = g.genre.id
      const currentScore = genreScores.get(genreId) || 0
      genreScores.set(genreId, currentScore + finalWeight)
    })
  }
  
  // Sort genres by score and return top 5
  const sortedGenres = Array.from(genreScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genreId]) => genreId)
  
  return sortedGenres
}

/**
 * Get user's preference profile from their watch history and ratings
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  // Get user preferences - cached by Prisma Accelerate
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      preferences: true
    },
    ...getCacheStrategy(300) // 5 minutes
  })
  
  if (!user) return null
  
  // Get rated anime - cached by Prisma Accelerate
  const ratings = await db.userAnimeList.findMany({
    where: {
      userId,
      score: { not: null }
    },
    select: {
      animeId: true,
      score: true
    },
    ...getCacheStrategy(300) // 5 minutes
  })
  
  // Get watched anime - cached by Prisma Accelerate
  const watchList = await db.userAnimeList.findMany({
    where: { userId },
    select: {
      animeId: true,
      status: true,
      isFavorite: true
    },
    ...getCacheStrategy(300) // 5 minutes
  })
  
  // Auto-calculate favoriteGenres if not set or empty
  let favoriteGenres = user.preferences?.favoriteGenres || []
  if (favoriteGenres.length === 0 && watchList.length > 0) {
    favoriteGenres = await calculateFavoriteGenresFromHistory(watchList, ratings)
  }
  
  // Extract favorited anime, plan-to-watch, currently watching, and completed
  const favoritedAnime = watchList
    .filter((item: { animeId: string; status: string; isFavorite: boolean }) => item.isFavorite)
    .map((item: { animeId: string; status: string; isFavorite: boolean }) => item.animeId)
  
  const planToWatchAnime = watchList
    .filter((item: { animeId: string; status: string; isFavorite: boolean }) => item.status === 'plan-to-watch')
    .map((item: { animeId: string; status: string; isFavorite: boolean }) => item.animeId)
  
  const currentlyWatchingAnime = watchList
    .filter((item: { animeId: string; status: string; isFavorite: boolean }) => item.status === 'watching')
    .map((item: { animeId: string; status: string; isFavorite: boolean }) => item.animeId)
  
  const completedAnime = watchList
    .filter((item: { animeId: string; status: string; isFavorite: boolean }) => item.status === 'completed')
    .map((item: { animeId: string; status: string; isFavorite: boolean }) => item.animeId)
  
  const profile: UserProfile = {
    id: userId,
    favoriteGenres,
    favoriteTags: user.preferences?.favoriteTags || [],
    discoveryMode: user.preferences?.discoveryMode || 'balanced',
    ratedAnime: ratings.map((r: typeof ratings[0]) => ({
      animeId: r.animeId,
      score: r.score || 5
    })),
    watchedAnime: watchList,
    favoritedAnime,
    planToWatchAnime,
    currentlyWatchingAnime,
    completedAnime
  }
  
  // Database queries are cached by Prisma Accelerate, no need for in-memory cache
  return profile
}

/**
 * Get anime the user has already interacted with (to exclude from recommendations)
 */
export async function getUserSeenAnime(userId: string): Promise<Set<string>> {
  const seenList = await db.userAnimeList.findMany({
    where: { userId },
    select: { animeId: true },
    ...getCacheStrategy(300) // 5 minutes
  })
  
  return new Set(seenList.map((item: typeof seenList[0]) => item.animeId))
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
    select: { animeId: true },
    ...getCacheStrategy(300) // 5 minutes
  })
  
  return new Set(dismissed.map((item: typeof dismissed[0]) => item.animeId))
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
  
  // Calculate user's average year preference (for recency bias)
  let userAverageYear: number | null = null
  if (profile.completedAnime.length > 0) {
    const completedAnimeDetails = await db.anime.findMany({
      where: {
        id: { in: profile.completedAnime.slice(0, 50) }
      },
      select: { year: true },
      ...getCacheStrategy(300)
    })
    const years = completedAnimeDetails.filter((a: { year: number | null }) => a.year).map((a: { year: number | null }) => a.year!)
    if (years.length > 0) {
      userAverageYear = years.reduce((a: number, b: number) => a + b, 0) / years.length
    }
  }
  
  // Build candidate filter - prioritize genre filtering if user has favorite genres
  const candidateWhere: any = {
    id: {
      notIn: [...seenAnime, ...dismissedAnime]
    }
  }
  
  // Filter by favorite genres if available
  if (profile.favoriteGenres.length > 0) {
    candidateWhere.genres = {
      some: {
        genreId: {
          in: profile.favoriteGenres
        }
      }
    }
  }
  
  // Adaptive quality filters - avoid obscure anime but not too strict
  // Check if user watches older/obscure anime
  const userWatchesOldAnime = userAverageYear && userAverageYear < 2010
  
  // Check if user watches obscure anime (low view count)
  let userWatchesObscureAnime = false
  if (profile.completedAnime.length > 0) {
    const completedAnimeDetails = await db.anime.findMany({
      where: {
        id: { in: profile.completedAnime.slice(0, 50) }
      },
      select: { viewCount: true },
      ...getCacheStrategy(300)
    })
    const avgViewCount = completedAnimeDetails.reduce((sum: number, a: { viewCount: number | null }) => sum + (a.viewCount || 0), 0) / completedAnimeDetails.length
    userWatchesObscureAnime = avgViewCount < 1000 // User watches anime with low popularity
  }
  
  // Quality filter: at least one of these must be true
  const qualityFilters: any[] = []
  
  if (!userWatchesObscureAnime && !userWatchesOldAnime) {
    // For users who prefer popular/recent anime, require quality indicators
    qualityFilters.push(
      { averageRating: { gte: 6.5 } }, // At least decent rating
      { viewCount: { gte: 500 } }, // Or some popularity
      { year: { gte: 2015 } } // Or relatively recent (last 10 years)
    )
  } else {
    // For users who watch diverse/obscure/old anime, be more lenient
    qualityFilters.push(
      { averageRating: { gte: 6.0 } }, // Lower threshold
      { viewCount: { gte: 100 } }, // Lower popularity threshold
      { year: { gte: 2000 } } // Older anime allowed
    )
  }
  
  if (qualityFilters.length > 0) {
    candidateWhere.OR = qualityFilters
  }
  
  // Get candidate anime - cached by Prisma Accelerate
  // Increased pool size to compensate for filtering
  let candidateAnime = await db.anime.findMany({
    where: candidateWhere,
    include: {
      genres: {
        include: {
          genre: true
        }
      }
    },
    orderBy: [
      { averageRating: 'desc' }, // Prioritize higher rated
      { viewCount: 'desc' } // Then more popular
    ],
    take: 500, // Increased from 200 to compensate for filtering
    ...getCacheStrategy(300) // 5 minutes
  })
  
  // Fallback: If filtered pool is too small, relax to include secondary genres
  if (candidateAnime.length < 50 && profile.favoriteGenres.length > 0) {
    // Get secondary genres (genres that appear with favorite genres)
    const favoriteAnime = await db.anime.findMany({
      where: {
        genres: {
          some: {
            genreId: {
              in: profile.favoriteGenres
            }
          }
        }
      },
      select: {
        genres: {
          select: {
            genreId: true
          }
        }
      },
      take: 100,
      ...getCacheStrategy(300)
    })
    
    const secondaryGenres = new Set<string>()
    favoriteAnime.forEach((anime: { genres: Array<{ genreId: string }> }) => {
      anime.genres.forEach((g: { genreId: string }) => {
        if (!profile.favoriteGenres.includes(g.genreId)) {
          secondaryGenres.add(g.genreId)
        }
      })
    })
    
    // Relax filter to include secondary genres
    if (secondaryGenres.size > 0) {
      candidateAnime = await db.anime.findMany({
        where: {
          id: {
            notIn: [...seenAnime, ...dismissedAnime]
          },
          genres: {
            some: {
              genreId: {
                in: [...profile.favoriteGenres, ...Array.from(secondaryGenres)]
              }
            }
          }
        },
        include: {
          genres: {
            include: {
              genre: true
            }
          }
        },
        take: 500,
        ...getCacheStrategy(300)
      })
    }
  }
  
  // Wait for collaborative and embedding results (parallel execution)
  const [collaborativeRecs, embeddingScores] = await Promise.all([
    collaborativePromise,
    embeddingSimilaritiesPromise
  ])
  
  const collaborativeScores = new Map(
    collaborativeRecs.map(rec => [rec.animeId, rec.predictedScore])
  )
  
  // Pre-fetch genre IDs for romance-specific enhancements (optimization)
  const romanceGenre = await db.genre.findUnique({
    where: { slug: 'romance' },
    select: { id: true },
    ...getCacheStrategy(3600) // 1 hour - genres rarely change
  })
  
  const sliceOfLifeGenre = await db.genre.findUnique({
    where: { slug: 'slice-of-life' },
    select: { id: true },
    ...getCacheStrategy(3600)
  })
  
  const actionGenre = await db.genre.findUnique({
    where: { slug: 'action' },
    select: { id: true },
    ...getCacheStrategy(3600)
  })
  
  const shounenGenre = await db.genre.findUnique({
    where: { slug: 'shounen' },
    select: { id: true },
    ...getCacheStrategy(3600)
  })
  
  // Calculate romance anime count if romance is a favorite genre
  let romanceAnimeCount = 0
  if (romanceGenre && profile.favoriteGenres.includes(romanceGenre.id)) {
    const watchedAnimeIds = profile.watchedAnime.map(w => w.animeId)
    romanceAnimeCount = await db.anime.count({
      where: {
        id: { in: watchedAnimeIds },
        genres: {
          some: {
            genreId: romanceGenre.id
          }
        }
      },
      ...getCacheStrategy(300)
    })
  }
  
  // Pre-fetch favorited, plan-to-watch, and currently watching anime for similarity calculations
  const favoritedAnimeDetails = profile.favoritedAnime.length > 0 ? await db.anime.findMany({
    where: { id: { in: profile.favoritedAnime.slice(0, 10) } },
    include: { genres: { include: { genre: true } } },
    ...getCacheStrategy(300)
  }) : []
  
  const planToWatchAnimeDetails = profile.planToWatchAnime.length > 0 ? await db.anime.findMany({
    where: { id: { in: profile.planToWatchAnime.slice(0, 20) } },
    include: { genres: { include: { genre: true } } },
    ...getCacheStrategy(300)
  }) : []
  
  const currentlyWatchingAnimeDetails = profile.currentlyWatchingAnime.length > 0 ? await db.anime.findMany({
    where: { id: { in: profile.currentlyWatchingAnime.slice(0, 10) } },
    include: { genres: { include: { genre: true } } },
    ...getCacheStrategy(300)
  }) : []
  
  // Score each anime using TRIPLE hybrid approach
  const scored: RecommendationScore[] = []
  
  for (const anime of candidateAnime) {
    let contentBasedScore = 0
    let reason = ''
    
    // 1. CONTENT-BASED SCORING (Traditional)
    const animeGenreIds = anime.genres.map((g: typeof anime.genres[0]) => g.genre.id)
    const genreMatch = jaccardSimilarity(animeGenreIds, profile.favoriteGenres)
    // Increased genre weight from 0.4 to 0.6 for stronger genre preference influence
    contentBasedScore += genreMatch * 0.6
    
    if (genreMatch > 0.5) {
      const matchedGenres = anime.genres
        .filter((g: typeof anime.genres[0]) => profile.favoriteGenres.includes(g.genre.id))
        .map((g: typeof anime.genres[0]) => g.genre.name)
      reason = `Popular in ${matchedGenres.slice(0, 2).join(' & ')}`
    }
    
    const tagMatch = jaccardSimilarity(anime.tags, profile.favoriteTags)
    // Reduced tag weight from 0.3 to 0.2 to compensate for increased genre weight
    contentBasedScore += tagMatch * 0.2
    
    if (anime.averageRating) {
      contentBasedScore += (anime.averageRating / 10) * 0.15
    }
    
    const popularityScore = Math.min(anime.viewCount / 10000, 1)
    contentBasedScore += popularityScore * 0.05
    
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
          },
          ...getCacheStrategy(300) // 5 minutes
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
    
    // Similarity to favorited anime (strong signal - user explicitly marked as favorite)
    if (favoritedAnimeDetails.length > 0) {
      let maxFavoriteSimilarity = 0
      for (const favorite of favoritedAnimeDetails) {
        const similarity = calculateAnimeSimilarity(anime, favorite)
        maxFavoriteSimilarity = Math.max(maxFavoriteSimilarity, similarity)
      }
      // Strong boost for similarity to favorites
      contentBasedScore += maxFavoriteSimilarity * 0.4
      
      if (maxFavoriteSimilarity > 0.6 && !reason) {
        reason = 'Similar to your favorites'
      }
    }
    
    // Similarity to plan-to-watch anime (user has shown interest)
    if (planToWatchAnimeDetails.length > 0) {
      let maxPlanToWatchSimilarity = 0
      for (const planned of planToWatchAnimeDetails) {
        const similarity = calculateAnimeSimilarity(anime, planned)
        maxPlanToWatchSimilarity = Math.max(maxPlanToWatchSimilarity, similarity)
      }
      // Moderate boost for similarity to plan-to-watch
      contentBasedScore += maxPlanToWatchSimilarity * 0.25
      
      if (maxPlanToWatchSimilarity > 0.6 && !reason && favoritedAnimeDetails.length === 0) {
        reason = 'Similar to anime you plan to watch'
      }
    }
    
    // Similarity to currently watching anime (user is actively engaged)
    if (currentlyWatchingAnimeDetails.length > 0) {
      let maxWatchingSimilarity = 0
      for (const watching of currentlyWatchingAnimeDetails) {
        const similarity = calculateAnimeSimilarity(anime, watching)
        maxWatchingSimilarity = Math.max(maxWatchingSimilarity, similarity)
      }
      // Boost for similarity to currently watching
      contentBasedScore += maxWatchingSimilarity * 0.3
      
      if (maxWatchingSimilarity > 0.6 && !reason && favoritedAnimeDetails.length === 0) {
        reason = 'Similar to what you\'re watching'
      }
    }
    
    // 2. COLLABORATIVE SCORE (User similarity)
    const collaborativeScore = collaborativeScores.get(anime.id)
    const normalizedCollaborative = collaborativeScore ? collaborativeScore / 10 : 0
    
    // 3. ML EMBEDDING SCORE (Semantic similarity)
    const embeddingScore = embeddingScores.get(anime.id) || 0
    
    // TRIPLE HYBRID SCORING (Phase 3!)
    // Updated weights: 50% content (increased from 40%), 30% collaborative (reduced from 35%), 20% embeddings (reduced from 25%)
    // This gives genre preferences stronger influence in final recommendations
    let finalScore = 
      contentBasedScore * 0.50 +
      normalizedCollaborative * 0.30 +
      embeddingScore * 0.20
    
    // Recency bias - prefer recent anime unless user watches old stuff
    if (anime.year && userAverageYear) {
      const currentYear = new Date().getFullYear()
      const animeAge = currentYear - anime.year
      const userPrefersRecent = userAverageYear >= 2015
      
      if (userPrefersRecent && animeAge <= 5) {
        // Boost recent anime for users who prefer recent content
        finalScore *= 1.15
      } else if (userPrefersRecent && animeAge > 10) {
        // Slight penalty for very old anime if user prefers recent
        finalScore *= 0.9
      } else if (!userPrefersRecent && animeAge <= 5) {
        // Users who watch old anime might still appreciate recent, but less boost
        finalScore *= 1.05
      }
    } else if (anime.year && anime.year >= 2015) {
      // Default: slight boost for recent anime if no user preference data
      finalScore *= 1.1
    }
    
    // Popularity boost within favorite genres (well-known anime in user's preferred genres)
    if (profile.favoriteGenres.length > 0 && genreMatch > 0.3) {
      const popularityBoost = Math.min(anime.viewCount / 5000, 1) // Normalize to 0-1
      // Boost popular anime within favorite genres
      finalScore *= (1 + popularityBoost * 0.15) // Up to 15% boost for very popular anime
    }
    
    // Genre match requirement threshold - enforce genre preferences
    if (profile.favoriteGenres.length > 0) {
      if (genreMatch > 0.2) {
        // Boost score for good genre matches (at least 20% overlap)
        finalScore *= (1 + genreMatch * 0.2) // Up to 20% boost for perfect matches
      } else {
        // Penalize anime with no genre match (less than 20% overlap)
        finalScore *= 0.5 // Reduce score by 50% if no meaningful genre match
      }
    }
    
    // Romance-specific enhancements
    // Apply if romance is a favorite genre and user has significant romance watch history
    if (romanceGenre && profile.favoriteGenres.includes(romanceGenre.id) && romanceAnimeCount > 5) {
      const hasRomance = animeGenreIds.includes(romanceGenre.id)
      const hasSliceOfLife = sliceOfLifeGenre && animeGenreIds.includes(sliceOfLifeGenre.id)
      const hasAction = actionGenre && animeGenreIds.includes(actionGenre.id)
      const hasShounen = shounenGenre && animeGenreIds.includes(shounenGenre.id)
      
      // Boost romance anime scores by 20%
      if (hasRomance) {
        finalScore *= 1.2
      }
      
      // Extra boost for romance + slice-of-life combinations
      if (hasRomance && hasSliceOfLife) {
        finalScore *= 1.15 // Additional 15% boost for ideal combination
      }
      
      // Filter out action/shonen unless explicitly rated highly
      // Only penalize if it's primarily action/shonen without romance
      if ((hasAction || hasShounen) && !hasRomance) {
        // Check if user has rated this anime highly - if so, don't penalize
        const userRating = profile.ratedAnime.find(r => r.animeId === anime.id)
        if (!userRating || userRating.score < 8) {
          finalScore *= 0.3 // Heavy penalty for action/shonen without romance
        }
      }
    }
    
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
  
  // Adaptive discovery mode based on user watch count and genre diversity
  let effectiveDiscoveryMode = profile.discoveryMode
  const watchCount = profile.watchedAnime.length
  
  if (watchCount < 10) {
    // New users: Use balanced mode for exploration
    effectiveDiscoveryMode = 'balanced'
  } else if (watchCount >= 10 && watchCount <= 50) {
    // Growing users: Use focused mode
    effectiveDiscoveryMode = 'focused'
  } else if (watchCount > 50) {
    // Experienced users: Check genre diversity
    // Calculate unique genres from watched anime
    const watchedAnimeIds = profile.watchedAnime.map(w => w.animeId)
    const watchedAnime = await db.anime.findMany({
      where: {
        id: { in: watchedAnimeIds }
      },
      select: {
        genres: {
          select: {
            genreId: true
          }
        }
      },
      take: 100,
      ...getCacheStrategy(300)
    })
    
    const uniqueGenres = new Set<string>()
    watchedAnime.forEach((anime: { genres: Array<{ genreId: string }> }) => {
      anime.genres.forEach((g: { genreId: string }) => uniqueGenres.add(g.genreId))
    })
    
    const genreDiversity = uniqueGenres.size
    
    if (genreDiversity < 3) {
      // Focused users: Use focused mode with minimal discovery (5%)
      effectiveDiscoveryMode = 'focused'
    } else if (genreDiversity >= 5) {
      // Very diverse users: Use exploratory mode for more variety
      effectiveDiscoveryMode = 'exploratory'
    } else {
      // Moderately diverse users: Use balanced mode
      effectiveDiscoveryMode = 'balanced'
    }
  }
  
  // Apply diversity based on effective discovery mode
  let diversitySettings = DIVERSITY[effectiveDiscoveryMode as keyof typeof DIVERSITY] || DIVERSITY.balanced
  
  // For focused users with low genre diversity, reduce discovery even more
  if (effectiveDiscoveryMode === 'focused' && watchCount > 50) {
    diversitySettings = { mainGenre: 0.95, discovery: 0.05 }
  }
  
  const mainCount = Math.floor(limit * diversitySettings.mainGenre)
  const discoveryCount = limit - mainCount
  
  // For diverse users, balance recommendations across their favorite genres
  if (profile.favoriteGenres.length >= 3 && effectiveDiscoveryMode !== 'focused') {
    // Distribute recommendations across favorite genres for diverse users
    const genreDistribution = new Map<string, RecommendationScore[]>()
    const genreLimits = Math.ceil(mainCount / profile.favoriteGenres.length)
    
    // Group recommendations by favorite genres
    for (const rec of scored) {
      const animeGenreIds = rec.anime.genres.map(g => g.genre.id)
      for (const favGenreId of profile.favoriteGenres) {
        if (animeGenreIds.includes(favGenreId)) {
          if (!genreDistribution.has(favGenreId)) {
            genreDistribution.set(favGenreId, [])
          }
          const genreRecs = genreDistribution.get(favGenreId)!
          if (genreRecs.length < genreLimits) {
            genreRecs.push(rec)
            break // Only add to first matching genre
          }
        }
      }
    }
    
    // Combine recommendations from all genres
    const balancedRecommendations: RecommendationScore[] = []
    for (const favGenreId of profile.favoriteGenres) {
      const genreRecs = genreDistribution.get(favGenreId) || []
      balancedRecommendations.push(...genreRecs.slice(0, genreLimits))
    }
    
    // Fill remaining slots with top-scored recommendations
    const usedIds = new Set(balancedRecommendations.map(r => r.anime.id))
    const remaining = scored
      .filter(r => !usedIds.has(r.anime.id))
      .slice(0, mainCount - balancedRecommendations.length)
    
    const mainRecommendations = [...balancedRecommendations, ...remaining].slice(0, mainCount)
    
    // Take some from different genres for discovery
    const usedGenres = new Set<string>()
    mainRecommendations.forEach(rec => {
      rec.anime.genres.forEach(g => usedGenres.add(g.genre.id))
    })
    
    const discoveryRecommendations = scored
      .slice(mainCount)
      .filter(rec => {
        const hasNewGenre = rec.anime.genres.some(g => !usedGenres.has(g.genre.id))
        return hasNewGenre && !usedIds.has(rec.anime.id)
      })
      .slice(0, discoveryCount)
    
    return [...mainRecommendations, ...discoveryRecommendations].slice(0, limit)
  }
  
  // Standard approach for focused users
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
  const scored = candidateAnime.map((anime: typeof candidateAnime[0]) => ({
    anime,
    score: calculateAnimeSimilarity(sourceAnime, anime),
    reason: `Because you watched ${sourceAnime.title}`
  }))
  
  // Sort and return top matches
  scored.sort((a: typeof scored[0], b: typeof scored[0]) => b.score - a.score)
  
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
  const scored = gems.map((anime: typeof gems[0]) => {
    const animeGenreIds = anime.genres.map((g: typeof anime.genres[0]) => g.genre.id)
    const genreMatch = jaccardSimilarity(animeGenreIds, profile.favoriteGenres)
    
    return {
      anime,
      score: genreMatch + (anime.averageRating || 0) / 10,
      reason: 'Hidden gem you might love'
    }
  })
  
  scored.sort((a: typeof scored[0], b: typeof scored[0]) => b.score - a.score)
  
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
  
  const genreNames = genres.map((g: typeof genres[0]) => g.name).join(' & ')
  
  return trending.map((anime: typeof trending[0]) => ({
    anime,
    score: 1,
    reason: `Trending in ${genreNames}`
  }))
}

/**
 * Get overall trending anime (non-personalized)
 */
export async function getTrendingAnime(limit: number = 12): Promise<RecommendationScore[]> {
  // Database query cached by Prisma Accelerate
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
    take: 50,
    ...getCacheStrategy(300) // 5 minutes - trending anime
  })
  
  const result = trending.map((anime: typeof trending[0]) => ({
    anime,
    score: 1,
    reason: 'Trending now'
  }))
  
  // Database query is cached by Prisma Accelerate, no need for in-memory cache
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
    take: limit,
    ...getCacheStrategy(600) // 10 minutes - new releases don't change often
  })
  
  return newAnime.map((anime: typeof newAnime[0]) => ({
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
  
  // Get all genres - cached by Prisma Accelerate
  const allGenres = await db.genre.findMany({
    select: { id: true, name: true },
    ...getCacheStrategy(3600) // 1 hour - genres rarely change
  })
  
  // Find genres user hasn't explored much
  const unexploredGenres = allGenres
    .filter((g: typeof allGenres[0]) => !profile.favoriteGenres.includes(g.id))
    .map((g: typeof allGenres[0]) => g.id)
  
  // Get high-quality anime from unexplored genres - cached by Prisma Accelerate
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
    take: limit,
    ...getCacheStrategy(600) // 10 minutes
  })
  
  return discoveryAnime.map((anime: typeof discoveryAnime[0]) => {
    const newGenres = anime.genres
      .filter((g: typeof anime.genres[0]) => !profile.favoriteGenres.includes(g.genre.id))
      .map((g: typeof anime.genres[0]) => g.genre.name)
    
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
    take: limit,
    ...getCacheStrategy(300) // 5 minutes
  })
  
  const animeIds = watching.map((w: typeof watching[0]) => w.animeId)
  if (animeIds.length === 0) {
    return []
  }
  
  const animeDetails = await db.anime.findMany({
    where: {
      id: { in: animeIds }
    },
    include: {
      genres: {
        include: { genre: true }
      }
    },
    ...getCacheStrategy(300) // 5 minutes
  })
  
  return animeDetails.map((anime: typeof animeDetails[0]) => ({
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
  // Cache invalidation handled by Prisma Accelerate automatically
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
  const animeMap = new Map<string, typeof animeDetails[0]>(animeDetails.map((a: typeof animeDetails[0]) => [a.id, a]))
  
  // Build recommendations with scores
  const recommendations: RecommendationScore[] = []
  
  for (const rec of filtered.slice(0, limit)) {
    const anime = animeMap.get(rec.animeId)
    if (!anime) continue
    
    recommendations.push({
      anime: anime as AnimeWithGenres,
      score: rec.predictedScore,
      reason: rec.similarUserCount > 5 
        ? 'Highly recommended by fans like you'
        : 'Fans with similar taste loved this'
    })
  }
  
  return recommendations
}

