/**
 * User Rating Service
 * Handles anime rating operations
 */

import { db } from '../db.js'
import { invalidateUserCaches } from '../recommendations.js'
import { createActivity } from '../social.js'

/**
 * Rate an anime
 */
export async function rateAnime(userId: string, animeId: string, rating: number) {
  // Check if anime exists
  const anime = await db.anime.findUnique({
    where: { id: animeId },
  })

  if (!anime) {
    throw new Error('Anime not found')
  }

  // Upsert rating
  const animeRating = await db.userAnimeRating.upsert({
    where: {
      userId_animeId: {
        userId,
        animeId,
      },
    },
    update: {
      score: rating,
    },
    create: {
      userId,
      animeId,
      score: rating,
    },
  })

  // Invalidate caches to refresh recommendations
  invalidateUserCaches(userId)

  // Create activity
  await createActivity(userId, 'rated_anime', animeId, null, { score: rating })

  return animeRating
}
