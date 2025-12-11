/**
 * User Review Service
 * Handles all operations related to user anime reviews
 */

import { db } from '../db'

export interface ReviewQueryParams {
  userId: string
  page?: number
  limit?: number
}

export interface CreateReviewParams {
  userId: string
  animeId: string
  title: string
  content: string
  score: number
  isSpoiler?: boolean
  isPublic?: boolean
}

/**
 * Get user's reviews with pagination
 */
export async function getUserReviews(params: ReviewQueryParams) {
  const { userId, page = 1, limit = 10 } = params
  const skip = (page - 1) * limit

  const [reviews, total] = await Promise.all([
    db.userAnimeReview.findMany({
      where: { userId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        animeId: true,
        title: true,
        content: true,
        score: true,
        isSpoiler: true,
        likes: true,
        dislikes: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.userAnimeReview.count({ where: { userId } }),
  ])

  // Fetch anime details
  const animeIds = reviews.map((r) => r.animeId)
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
  const reviewsWithAnime = reviews.map((review) => ({
    id: review.id,
    anime: animeMap.get(review.animeId),
    title: review.title,
    content: review.content,
    score: review.score,
    isSpoiler: review.isSpoiler,
    likes: review.likes,
    dislikes: review.dislikes,
    isPublic: review.isPublic,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  }))

  return {
    reviews: reviewsWithAnime,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  }
}

/**
 * Create or update a review
 */
export async function createReview(params: CreateReviewParams) {
  const { userId, animeId, title, content, score, isSpoiler = false, isPublic = true } = params

  // Check if anime exists
  const anime = await db.anime.findUnique({
    where: { id: animeId },
    select: { id: true },
  })

  if (!anime) {
    throw new Error('Anime not found')
  }

  // Upsert review
  const review = await db.userAnimeReview.upsert({
    where: {
      userId_animeId: {
        userId,
        animeId,
      },
    },
    update: {
      title,
      content,
      score,
      isSpoiler,
      isPublic,
    },
    create: {
      userId,
      animeId,
      title,
      content,
      score,
      isSpoiler,
      isPublic,
    },
  })

  return review
}

/**
 * Delete a review
 */
export async function deleteReview(userId: string, reviewId: string) {
  await db.userAnimeReview.delete({
    where: {
      id: reviewId,
      userId, // Ensure user owns the review
    },
  })

  return { success: true }
}
