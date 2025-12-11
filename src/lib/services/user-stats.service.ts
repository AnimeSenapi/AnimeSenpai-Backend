/**
 * User Stats Service
 * Handles user statistics and profile data
 */

import { db } from '../db.js'

/**
 * Get user statistics
 */
export async function getUserStats(userId: string) {
  const [totalAnime, favorites, watching, completed, planToWatch, ratings, reviews] = await Promise.all([
    db.userAnimeList.count({
      where: { userId },
    }),
    db.userAnimeList.count({
      where: { userId, isFavorite: true },
    }),
    db.userAnimeList.count({
      where: { userId, status: 'watching' },
    }),
    db.userAnimeList.count({
      where: { userId, status: 'completed' },
    }),
    db.userAnimeList.count({
      where: { userId, status: 'plan-to-watch' },
    }),
    db.userAnimeRating.count({
      where: { userId },
    }),
    db.userAnimeReview.count({
      where: { userId },
    }),
  ])

  // Calculate total episodes watched
  const watchedAnime = await db.userAnimeList.findMany({
    where: {
      userId,
      status: { in: ['watching', 'completed'] },
    },
    select: {
      progress: true,
    },
  })

  const totalEpisodes = watchedAnime.reduce((sum, item) => sum + item.progress, 0)

  return {
    totalAnime,
    favorites,
    watching,
    completed,
    planToWatch,
    ratings,
    reviews,
    totalEpisodesWatched: totalEpisodes,
  }
}

/**
 * Get user profile with stats and recent activity
 */
export async function getUserProfile(userId: string) {
  const [stats, recentActivity] = await Promise.all([
    getUserStats(userId),
    db.userAnimeList.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        animeId: true,
        status: true,
        progress: true,
        updatedAt: true,
      },
    }),
  ])

  // Fetch anime details for recent activity
  const animeIds = recentActivity.map((a) => a.animeId)
  const animeDetails = await db.anime.findMany({
    where: { id: { in: animeIds } },
    select: {
      id: true,
      slug: true,
      title: true,
      coverImage: true,
    },
  })

  const animeMap = new Map(animeDetails.map((a) => [a.id, a]))
  const recentActivityWithAnime = recentActivity.map((activity) => ({
    anime: animeMap.get(activity.animeId),
    status: activity.status,
    progress: activity.progress,
    updatedAt: activity.updatedAt,
  }))

  return {
    stats,
    recentActivity: recentActivityWithAnime,
  }
}

/**
 * Get public user profile by username
 */
export async function getPublicUserProfile(username: string) {
  // Normalize username
  const normalizedUsername = username.toLowerCase().trim()

  // Try exact match first
  let user = await db.user.findUnique({
    where: { username: normalizedUsername },
    select: {
      id: true,
      username: true,
      avatar: true,
      bio: true,
      role: true,
      createdAt: true,
      preferences: {
        select: {
          profileVisibility: true,
          showWatchHistory: true,
          showFavorites: true,
          showRatings: true,
        },
      },
    },
  })

  // If not found, try case-insensitive search
  if (!user) {
    const users = await db.user.findMany({
      where: {
        username: {
          mode: 'insensitive',
          equals: normalizedUsername,
        },
      },
      select: {
        id: true,
        username: true,
        avatar: true,
        bio: true,
        role: true,
        createdAt: true,
        preferences: {
          select: {
            profileVisibility: true,
            showWatchHistory: true,
            showFavorites: true,
            showRatings: true,
          },
        },
      },
      take: 1,
    })

    user = users[0] || null
  }

  if (!user) {
    return null
  }

  // Get user stats
  const [totalAnime, totalEpisodes, favoriteCount, completedCount] = await Promise.all([
    db.userAnimeList.count({
      where: { userId: user.id },
    }),
    db.userAnimeList.aggregate({
      where: { userId: user.id },
      _sum: { progress: true },
    }),
    db.userAnimeList.count({
      where: { userId: user.id, isFavorite: true },
    }),
    db.userAnimeList.count({
      where: { userId: user.id, status: 'completed' },
    }),
  ])

  return {
    id: user.id,
    username: user.username,
    avatar: user.avatar,
    bio: user.bio,
    role: user.role,
    createdAt: user.createdAt,
    stats: {
      totalAnime,
      totalEpisodes: totalEpisodes._sum.progress || 0,
      favorites: favoriteCount,
      completed: completedCount,
    },
    preferences: {
      showWatchHistory: user.preferences?.showWatchHistory ?? true,
      showFavorites: user.preferences?.showFavorites ?? true,
      showRatings: user.preferences?.showRatings ?? true,
      profileVisibility: user.preferences?.profileVisibility,
    },
  }
}

/**
 * Get public user anime list
 */
export async function getPublicUserAnimeList(username: string, status?: string, limit = 20) {
  // Normalize username
  let normalizedUsername = username
  try {
    normalizedUsername = decodeURIComponent(normalizedUsername)
  } catch (_) {
    // ignore decode errors
  }
  if (normalizedUsername.startsWith('%40')) {
    normalizedUsername = normalizedUsername.slice(3)
  }
  if (normalizedUsername.startsWith('@')) {
    normalizedUsername = normalizedUsername.slice(1)
  }
  normalizedUsername = normalizedUsername.toLowerCase().trim()

  // Find user
  const user = await db.user.findFirst({
    where: {
      username: {
        mode: 'insensitive',
        equals: normalizedUsername,
      },
    },
    select: {
      id: true,
      preferences: {
        select: {
          showWatchHistory: true,
          showFavorites: true,
          profileVisibility: true,
        },
      },
    },
  })

  if (!user) {
    return null
  }

  // Check privacy settings
  if (user.preferences?.profileVisibility === 'private') {
    return { items: [] }
  }

  if (!user.preferences?.showWatchHistory) {
    return { items: [] }
  }

  // Build where clause
  const where: any = { userId: user.id }
  if (status) {
    where.status = status
  }

  // Fetch anime list
  const animeList = await db.userAnimeList.findMany({
    where,
    take: limit,
    orderBy: { updatedAt: 'desc' },
    select: {
      animeId: true,
      status: true,
      score: true,
      progress: true,
    },
  })

  // Fetch anime details
  const animeIds = animeList.map((item) => item.animeId)
  const animeDetails = await db.anime.findMany({
    where: { id: { in: animeIds } },
    select: {
      id: true,
      slug: true,
      title: true,
      coverImage: true,
      year: true,
      rating: true,
      status: true,
      type: true,
      episodes: true,
      duration: true,
      genres: {
        select: {
          genre: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  })

  // Merge data
  const animeMap = new Map(animeDetails.map((a) => [a.id, a]))
  const items = animeList
    .map((listItem) => {
      const anime = animeMap.get(listItem.animeId)
      if (!anime) return null

      return {
        id: anime.id,
        slug: anime.slug,
        title: anime.title,
        coverImage: anime.coverImage,
        year: anime.year,
        rating: anime.rating,
        status: anime.status,
        type: anime.type,
        episodes: anime.episodes,
        duration: anime.duration,
        genres: anime.genres.map((g) => g.genre),
        tags: [],
        listStatus: listItem.status,
        userScore: listItem.score,
      }
    })
    .filter(Boolean)

  return { items }
}
