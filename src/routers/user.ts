import { z } from 'zod'
import { router, protectedProcedure } from '../lib/trpc'
import { db } from '../lib/db'

export const userRouter = router({
  // Get user's anime list
  getAnimeList: protectedProcedure
    .query(async ({ ctx }) => {
      const status = undefined
      const page = 1
      const limit = 20
      const skip = (page - 1) * limit

      const where: any = {
        userId: ctx.user.id
      }

      if (status) {
        where.status = status
      }

      const [animeLists, total] = await Promise.all([
        db.userAnimeList.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            updatedAt: 'desc'
          },
          select: {
            id: true,
            animeId: true,
            status: true,
            progress: true,
            score: true,
            startedAt: true,
            completedAt: true,
            updatedAt: true,
          }
        }),
        db.userAnimeList.count({ where })
      ])

      return {
        anime: animeLists.map((item: any) => ({
          id: item.animeId,
          listStatus: item.status,
          progress: item.progress
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    }),

  // Add anime to list
  addToList: protectedProcedure
    .input(z.object({
      animeId: z.string(),
      status: z.enum(['favorite', 'watching', 'completed', 'plan-to-watch']),
      progress: z.number().min(0).default(0),
      rating: z.number().min(1).max(10).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const { animeId, status, progress, rating } = input

      // Check if anime exists (select only id for existence check)
      const anime = await db.anime.findUnique({
        where: { id: animeId },
        select: { id: true }
      })

      if (!anime) {
        throw new Error('Anime not found')
      }

      // Upsert anime list entry
      const animeList = await db.userAnimeList.upsert({
        where: {
          userId_animeId: {
            userId: ctx.user.id,
            animeId
          }
        },
        update: {
          status,
          progress
        },
        create: {
          userId: ctx.user.id,
          animeId,
          status,
          progress
        }
      })

      return animeList
    }),

  // Remove anime from list
  removeFromList: protectedProcedure
    .input(z.object({
      animeId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      await db.userAnimeList.delete({
        where: {
          userId_animeId: {
            userId: ctx.user.id,
            animeId: input.animeId
          }
        }
      })

      return { success: true }
    }),

  // Update anime list entry
  updateListEntry: protectedProcedure
    .input(z.object({
      animeId: z.string(),
      status: z.enum(['favorite', 'watching', 'completed', 'plan-to-watch']).optional(),
      progress: z.number().min(0).optional(),
      rating: z.number().min(1).max(10).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const { animeId, ...updateData } = input

      const animeList = await db.userAnimeList.update({
        where: {
          userId_animeId: {
            userId: ctx.user.id,
            animeId
          }
        },
        data: updateData
      })

      return animeList
    }),

  // Rate anime
  rateAnime: protectedProcedure
    .input(z.object({
      animeId: z.string(),
      rating: z.number().min(1).max(10)
    }))
    .mutation(async ({ input, ctx }) => {
      const { animeId, rating } = input

      // Check if anime exists
      const anime = await db.anime.findUnique({
        where: { id: animeId }
      })

      if (!anime) {
        throw new Error('Anime not found')
      }

      // Upsert rating
      const animeRating = await db.userAnimeRating.upsert({
        where: {
          userId_animeId: {
            userId: ctx.user.id,
            animeId
          }
        },
        update: {
          score: rating
        },
        create: {
          userId: ctx.user.id,
          animeId,
          score: rating
        }
      })

      return animeRating
    }),

  // Get user preferences
  getPreferences: protectedProcedure
    .query(async ({ ctx }) => {
      const preferences = await db.userPreferences.findUnique({
        where: { userId: ctx.user.id }
      })

      return preferences
    }),

  // Update user preferences
  updatePreferences: protectedProcedure
    .input(z.object({
      theme: z.string().optional(),
      language: z.string().optional(),
      timezone: z.string().optional(),
      dateFormat: z.string().optional(),
      emailNotifications: z.boolean().optional(),
      pushNotifications: z.boolean().optional(),
      weeklyDigest: z.boolean().optional(),
      newEpisodes: z.boolean().optional(),
      recommendations: z.boolean().optional(),
      socialUpdates: z.boolean().optional(),
      profileVisibility: z.string().optional(),
      showWatchHistory: z.boolean().optional(),
      showFavorites: z.boolean().optional(),
      showRatings: z.boolean().optional(),
      allowMessages: z.boolean().optional(),
      autoplay: z.boolean().optional(),
      skipIntro: z.boolean().optional(),
      skipOutro: z.boolean().optional(),
      defaultQuality: z.string().optional(),
      subtitles: z.boolean().optional(),
      volume: z.number().min(0).max(100).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const preferences = await db.userPreferences.upsert({
        where: { userId: ctx.user.id },
        update: input,
        create: {
          userId: ctx.user.id,
          ...input
        }
      })

      return preferences
    }),

  // Get user stats
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      const [totalAnime, favorites, watching, completed, planToWatch, ratings] = await Promise.all([
        db.userAnimeList.count({
          where: { userId: ctx.user.id }
        }),
        db.userAnimeList.count({
          where: { userId: ctx.user.id, status: 'favorite' }
        }),
        db.userAnimeList.count({
          where: { userId: ctx.user.id, status: 'watching' }
        }),
        db.userAnimeList.count({
          where: { userId: ctx.user.id, status: 'completed' }
        }),
        db.userAnimeList.count({
          where: { userId: ctx.user.id, status: 'plan-to-watch' }
        }),
        db.userAnimeRating.count({
          where: { userId: ctx.user.id }
        })
      ])

      return {
        totalAnime,
        favorites,
        watching,
        completed,
        planToWatch,
        ratings
      }
    })
})
