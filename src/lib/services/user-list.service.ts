/**
 * User Anime List Service
 * Handles all operations related to user anime lists
 */

import { db } from '../db'
import { logger } from '../logger'
import { createActivity } from '../social'
import { invalidateUserCaches } from '../recommendations'

export interface ListQueryParams {
  userId: string
  status?: 'favorite' | 'watching' | 'completed' | 'plan-to-watch' | 'on-hold' | 'dropped'
  page?: number
  limit?: number
  sortBy?: 'updatedAt' | 'createdAt' | 'title'
  sortOrder?: 'asc' | 'desc'
}

export interface AddToListParams {
  userId: string
  animeId: string
  status: 'favorite' | 'watching' | 'completed' | 'plan-to-watch' | 'on-hold' | 'dropped'
  isFavorite?: boolean
  score?: number
  notes?: string
}

export interface UpdateListEntryParams {
  userId: string
  animeId: string
  status?: 'favorite' | 'watching' | 'completed' | 'plan-to-watch' | 'on-hold' | 'dropped'
  isFavorite?: boolean
  score?: number
  notes?: string
}

/**
 * Get user's anime list with pagination
 */
export async function getUserAnimeList(params: ListQueryParams) {
  const { userId, status, page = 1, limit = 50, sortBy = 'updatedAt', sortOrder = 'desc' } = params

  // Get system settings for max limit
  const systemSettings = await db.systemSettings.findFirst()
  const maxLimit = systemSettings?.maxUserListItems || 5000
  const actualLimit = Math.min(limit, maxLimit)
  const skip = (page - 1) * actualLimit

  logger.debug('getUserAnimeList called', { userId, status, page, limit: actualLimit, skip })

  const where: any = { userId }

  // Handle favorite as a boolean field, not a status
  if (status === 'favorite') {
    where.isFavorite = true
  } else if (status) {
    where.status = status
  }

  const [animeLists, total] = await Promise.all([
    db.userAnimeList.findMany({
      where,
      skip,
      take: actualLimit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        animeId: true,
        status: true,
        isFavorite: true,
        progress: true,
        score: true,
        notes: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.userAnimeList.count({ where }),
  ])

  logger.debug('User anime list query completed', { userId, itemsFound: animeLists.length, total, limit: actualLimit, skip })

  // Fetch full anime details
  const animeIds = animeLists.map((item) => item.animeId)
  const animeDetails = await db.anime.findMany({
    where: { id: { in: animeIds } },
    select: {
      id: true,
      slug: true,
      title: true,
      titleEnglish: true,
      titleJapanese: true,
      titleSynonyms: true,
      description: true,
      coverImage: true,
      bannerImage: true,
      year: true,
      rating: true,
      status: true,
      type: true,
      episodes: true,
      duration: true,
      season: true,
      averageRating: true,
      genres: {
        select: {
          genre: {
            select: {
              id: true,
              name: true,
              slug: true,
              color: true,
            },
          },
        },
      },
    },
  })

  // Merge list data with anime details
  const animeMap = new Map(animeDetails.map((a) => [a.id, a]))
  const mergedData = animeLists
    .map((listItem) => {
      const anime = animeMap.get(listItem.animeId)
      return {
        listId: listItem.id,
        anime: anime
          ? {
              id: anime.id,
              slug: anime.slug,
              title: anime.title,
              titleEnglish: anime.titleEnglish,
              titleJapanese: anime.titleJapanese,
              titleSynonyms: anime.titleSynonyms,
              description: anime.description,
              coverImage: anime.coverImage,
              bannerImage: anime.bannerImage,
              year: anime.year,
              rating: anime.rating,
              status: anime.status,
              type: anime.type,
              episodes: anime.episodes,
              duration: anime.duration,
              season: anime.season,
              averageRating: anime.averageRating,
              genres: anime.genres.map((g) => g.genre),
            }
          : null,
        listStatus: listItem.status,
        isFavorite: listItem.isFavorite,
        progress: listItem.progress,
        score: listItem.score,
        notes: listItem.notes,
        startedAt: listItem.startedAt,
        completedAt: listItem.completedAt,
        createdAt: listItem.createdAt,
        updatedAt: listItem.updatedAt,
      }
    })
    .filter((item) => item.anime !== null)

  return {
    items: mergedData,
    pagination: {
      page,
      limit: actualLimit,
      total,
      pages: Math.ceil(total / actualLimit),
    },
  }
}

/**
 * Check if anime is in user's list
 */
export async function checkAnimeInList(userId: string, animeId: string) {
  return db.userAnimeList.findUnique({
    where: {
      userId_animeId: {
        userId,
        animeId,
      },
    },
    select: {
      id: true,
      status: true,
      progress: true,
      score: true,
      notes: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}

/**
 * Add anime to user's list
 */
export async function addAnimeToList(params: AddToListParams) {
  const { userId, animeId, status, isFavorite, score, notes } = params

  // Check if anime exists
  const anime = await db.anime.findUnique({
    where: { id: animeId },
    select: { id: true },
  })

  if (!anime) {
    throw new Error('Anime not found')
  }

  // Determine dates based on status
  const now = new Date()
  const startedAt = status === 'watching' || status === 'completed' ? now : null
  const completedAt = status === 'completed' ? now : null

  // Handle favorite as a special case
  const actualStatus = status === 'favorite' ? 'plan-to-watch' : status
  const actualIsFavorite = status === 'favorite' ? true : isFavorite ?? false

  // Upsert anime list entry
  const animeList = await db.userAnimeList.upsert({
    where: {
      userId_animeId: {
        userId,
        animeId,
      },
    },
    update: {
      status: actualStatus,
      isFavorite: actualIsFavorite,
      score: score !== undefined ? score : undefined,
      notes: notes !== undefined ? notes : undefined,
      completedAt: actualStatus === 'completed' ? completedAt || now : null,
    },
    create: {
      userId,
      animeId,
      status: actualStatus,
      isFavorite: actualIsFavorite,
      score,
      notes,
      startedAt,
      completedAt,
    },
  })

  logger.debug('Anime added/updated to user list', { userId, animeId, status: actualStatus, isFavorite: actualIsFavorite })

  // Create activity if favorited
  if (actualIsFavorite) {
    await createActivity(userId, 'favorited_anime', animeId, null, null)
  }

  return animeList
}

/**
 * Remove anime from user's list
 */
export async function removeAnimeFromList(userId: string, animeId: string) {
  await db.userAnimeList.delete({
    where: {
      userId_animeId: {
        userId,
        animeId,
      },
    },
  })

  return { success: true }
}

/**
 * Update anime list entry
 */
export async function updateListEntry(params: UpdateListEntryParams) {
  const { userId, animeId, status, isFavorite, score, notes } = params

  // Build update data
  const updateData: any = {}
  if (status !== undefined) {
    if (status === 'favorite') {
      updateData.isFavorite = true
    } else {
      updateData.status = status
    }
  }
  if (isFavorite !== undefined) updateData.isFavorite = isFavorite
  if (score !== undefined) updateData.score = score
  if (notes !== undefined) updateData.notes = notes

  // Update dates based on status change
  if (status === 'completed') {
    updateData.completedAt = new Date()
  } else if (status === 'watching') {
    const current = await db.userAnimeList.findUnique({
      where: {
        userId_animeId: {
          userId,
          animeId,
        },
      },
      select: { startedAt: true, status: true },
    })

    if (current && current.status === 'plan-to-watch' && !current.startedAt) {
      updateData.startedAt = new Date()
    }
  }

  const animeList = await db.userAnimeList.update({
    where: {
      userId_animeId: {
        userId,
        animeId,
      },
    },
    data: updateData,
  })

  // If score was updated, invalidate recommendation caches
  if (score !== undefined) {
    invalidateUserCaches(userId)

    await createActivity(userId, 'rated_anime', animeId, null, { score })
  }

  // Create activities for status changes
  if (status === 'completed') {
    await createActivity(userId, 'completed_anime', animeId, null, null)
  } else if (status === 'watching') {
    await createActivity(userId, 'started_watching', animeId, null, null)
  }

  return animeList
}

/**
 * Toggle favorite status
 */
export async function toggleFavorite(userId: string, animeId: string) {
  const existing = await db.userAnimeList.findUnique({
    where: {
      userId_animeId: {
        userId,
        animeId,
      },
    },
  })

  if (!existing) {
    // If not in list, add it as favorite with plan-to-watch status
    const animeList = await db.userAnimeList.create({
      data: {
        userId,
        animeId,
        status: 'plan-to-watch',
        isFavorite: true,
      },
    })

    await createActivity(userId, 'favorited_anime', animeId, null, null)

    return { ...animeList, isFavorite: true }
  }

  // Toggle favorite status
  const newFavoriteStatus = !existing.isFavorite
  const updated = await db.userAnimeList.update({
    where: {
      userId_animeId: {
        userId,
        animeId,
      },
    },
    data: {
      isFavorite: newFavoriteStatus,
    },
  })

  // Create activity if favorited
  if (newFavoriteStatus) {
    await createActivity(userId, 'favorited_anime', animeId, null, null)
  }

  return { ...updated, isFavorite: newFavoriteStatus }
}

/**
 * Get favorited anime IDs
 */
export async function getFavoritedAnimeIds(userId: string) {
  const favorites = await db.userAnimeList.findMany({
    where: {
      userId,
      isFavorite: true,
    },
    select: {
      animeId: true,
    },
  })

  return {
    animeIds: favorites.map((f) => f.animeId),
  }
}
