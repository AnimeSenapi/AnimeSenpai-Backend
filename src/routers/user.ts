import { z } from 'zod'
import { router, protectedProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import { getUserFeatures, hasFeatureAccess } from '../lib/roles'

export const userRouter = router({
  // Get user's anime list with full anime details
  getAnimeList: protectedProcedure
    .input(z.object({
      status: z.enum(['favorite', 'watching', 'completed', 'plan-to-watch']).optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
      sortBy: z.enum(['updatedAt', 'createdAt', 'title', 'progress']).default('updatedAt'),
      sortOrder: z.enum(['asc', 'desc']).default('desc')
    }).optional())
    .query(async ({ input = {}, ctx }) => {
      const { status, page = 1, limit = 20, sortBy = 'updatedAt', sortOrder = 'desc' } = input
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
            [sortBy]: sortOrder
          },
          select: {
            id: true,
            animeId: true,
            status: true,
            progress: true,
            score: true,
            notes: true,
            startedAt: true,
            completedAt: true,
            createdAt: true,
            updatedAt: true,
          }
        }),
        db.userAnimeList.count({ where })
      ])

      // Fetch full anime details
      const animeIds = animeLists.map(item => item.animeId)
      const animeDetails = await db.anime.findMany({
        where: {
          id: { in: animeIds }
        },
        select: {
          id: true,
          slug: true,
          title: true,
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
                }
              }
            }
          }
        }
      })

      // Merge list data with anime details
      const animeMap = new Map(animeDetails.map(a => [a.id, a]))
      const mergedData = animeLists.map(listItem => {
        const anime = animeMap.get(listItem.animeId)
        return {
          listId: listItem.id,
          anime: anime ? {
            id: anime.id,
            slug: anime.slug,
            title: anime.title,
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
            genres: anime.genres.map(g => g.genre)
          } : null,
          listStatus: listItem.status,
          progress: listItem.progress,
          score: listItem.score,
          notes: listItem.notes,
          startedAt: listItem.startedAt,
          completedAt: listItem.completedAt,
          createdAt: listItem.createdAt,
          updatedAt: listItem.updatedAt
        }
      }).filter(item => item.anime !== null)

      return {
        items: mergedData,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    }),

  // Check if anime is in user's list
  checkInList: protectedProcedure
    .input(z.object({
      animeId: z.string()
    }))
    .query(async ({ input, ctx }) => {
      const listEntry = await db.userAnimeList.findUnique({
        where: {
          userId_animeId: {
            userId: ctx.user.id,
            animeId: input.animeId
          }
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
          updatedAt: true
        }
      })

      return listEntry
    }),

  // Add anime to list
  addToList: protectedProcedure
    .input(z.object({
      animeId: z.string(),
      status: z.enum(['favorite', 'watching', 'completed', 'plan-to-watch']),
      progress: z.number().min(0).default(0),
      score: z.number().min(1).max(10).optional(),
      notes: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const { animeId, status, progress, score, notes } = input

      // Check if anime exists (select only id for existence check)
      const anime = await db.anime.findUnique({
        where: { id: animeId },
        select: { id: true }
      })

      if (!anime) {
        throw new Error('Anime not found')
      }

      // Determine dates based on status
      const now = new Date()
      const startedAt = (status === 'watching' || status === 'completed') ? now : null
      const completedAt = status === 'completed' ? now : null

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
          progress,
          score,
          notes,
          completedAt: status === 'completed' ? (completedAt || now) : null
        },
        create: {
          userId: ctx.user.id,
          animeId,
          status,
          progress,
          score,
          notes,
          startedAt,
          completedAt
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
      score: z.number().min(1).max(10).optional(),
      notes: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const { animeId, status, progress, score, notes } = input

      // Build update data
      const updateData: any = {}
      if (status !== undefined) updateData.status = status
      if (progress !== undefined) updateData.progress = progress
      if (score !== undefined) updateData.score = score
      if (notes !== undefined) updateData.notes = notes

      // Update dates based on status change
      if (status === 'completed') {
        updateData.completedAt = new Date()
      } else if (status === 'watching') {
        // If moving from plan-to-watch to watching, set startedAt
        const current = await db.userAnimeList.findUnique({
          where: {
            userId_animeId: {
              userId: ctx.user.id,
              animeId
            }
          },
          select: { startedAt: true, status: true }
        })

        if (current && current.status === 'plan-to-watch' && !current.startedAt) {
          updateData.startedAt = new Date()
        }
      }

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
      const [totalAnime, favorites, watching, completed, planToWatch, ratings, reviews] = await Promise.all([
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
        }),
        db.userAnimeReview.count({
          where: { userId: ctx.user.id }
        })
      ])

      // Calculate total episodes watched
      const watchedAnime = await db.userAnimeList.findMany({
        where: {
          userId: ctx.user.id,
          status: { in: ['watching', 'completed'] }
        },
        select: {
          progress: true
        }
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
        totalEpisodesWatched: totalEpisodes
      }
    }),

  // Get full profile with stats and recent activity
  getProfile: protectedProcedure
    .query(async ({ ctx }) => {
      const [stats, recentActivity] = await Promise.all([
        // Get stats
        (async () => {
          const [totalAnime, favorites, watching, completed, planToWatch, ratings, reviews] = await Promise.all([
            db.userAnimeList.count({ where: { userId: ctx.user.id } }),
            db.userAnimeList.count({ where: { userId: ctx.user.id, status: 'favorite' } }),
            db.userAnimeList.count({ where: { userId: ctx.user.id, status: 'watching' } }),
            db.userAnimeList.count({ where: { userId: ctx.user.id, status: 'completed' } }),
            db.userAnimeList.count({ where: { userId: ctx.user.id, status: 'plan-to-watch' } }),
            db.userAnimeRating.count({ where: { userId: ctx.user.id } }),
            db.userAnimeReview.count({ where: { userId: ctx.user.id } })
          ])

          return { totalAnime, favorites, watching, completed, planToWatch, ratings, reviews }
        })(),
        
        // Get recent activity (last 10 list updates)
        db.userAnimeList.findMany({
          where: { userId: ctx.user.id },
          orderBy: { updatedAt: 'desc' },
          take: 10,
          select: {
            animeId: true,
            status: true,
            progress: true,
            updatedAt: true
          }
        })
      ])

      // Fetch anime details for recent activity
      const animeIds = recentActivity.map(a => a.animeId)
      const animeDetails = await db.anime.findMany({
        where: { id: { in: animeIds } },
        select: {
          id: true,
          slug: true,
          title: true,
          coverImage: true
        }
      })

      const animeMap = new Map(animeDetails.map(a => [a.id, a]))
      const recentActivityWithAnime = recentActivity.map(activity => ({
        anime: animeMap.get(activity.animeId),
        status: activity.status,
        progress: activity.progress,
        updatedAt: activity.updatedAt
      }))

      return {
        user: {
          id: ctx.user.id,
          email: ctx.user.email,
          name: ctx.user.name,
          avatar: ctx.user.avatar,
          bio: ctx.user.bio,
          emailVerified: ctx.user.emailVerified,
          createdAt: ctx.user.createdAt
        },
        stats,
        recentActivity: recentActivityWithAnime,
        preferences: ctx.user.preferences
      }
    }),

  // Get user's reviews
  getReviews: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(50).default(10)
    }).optional())
    .query(async ({ input = {}, ctx }) => {
      const { page = 1, limit = 10 } = input
      const skip = (page - 1) * limit

      const [reviews, total] = await Promise.all([
        db.userAnimeReview.findMany({
          where: { userId: ctx.user.id },
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
            updatedAt: true
          }
        }),
        db.userAnimeReview.count({ where: { userId: ctx.user.id } })
      ])

      // Fetch anime details
      const animeIds = reviews.map(r => r.animeId)
      const animeDetails = await db.anime.findMany({
        where: { id: { in: animeIds } },
        select: {
          id: true,
          slug: true,
          title: true,
          coverImage: true
        }
      })

      const animeMap = new Map(animeDetails.map(a => [a.id, a]))
      const reviewsWithAnime = reviews.map(review => ({
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
        updatedAt: review.updatedAt
      }))

      return {
        reviews: reviewsWithAnime,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    }),

  // Create/Update review
  createReview: protectedProcedure
    .input(z.object({
      animeId: z.string(),
      title: z.string().min(3).max(200),
      content: z.string().min(10).max(5000),
      score: z.number().min(1).max(10),
      isSpoiler: z.boolean().default(false),
      isPublic: z.boolean().default(true)
    }))
    .mutation(async ({ input, ctx }) => {
      const { animeId, title, content, score, isSpoiler, isPublic } = input

      // Check if anime exists
      const anime = await db.anime.findUnique({
        where: { id: animeId },
        select: { id: true }
      })

      if (!anime) {
        throw new Error('Anime not found')
      }

      // Upsert review
      const review = await db.userAnimeReview.upsert({
        where: {
          userId_animeId: {
            userId: ctx.user.id,
            animeId
          }
        },
        update: {
          title,
          content,
          score,
          isSpoiler,
          isPublic
        },
        create: {
          userId: ctx.user.id,
          animeId,
          title,
          content,
          score,
          isSpoiler,
          isPublic
        }
      })

      return review
    }),

  // Delete review
  deleteReview: protectedProcedure
    .input(z.object({
      reviewId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      await db.userAnimeReview.delete({
        where: {
          id: input.reviewId,
          userId: ctx.user.id // Ensure user owns the review
        }
      })

      return { success: true }
    }),

  // Get user's accessible features
  getFeatures: protectedProcedure
    .query(async ({ ctx }) => {
      const features = await getUserFeatures(ctx.user.role)

      return {
        role: ctx.user.role,
        features
      }
    }),

  // Check if user has access to a specific feature
  checkFeature: protectedProcedure
    .input(z.object({
      feature: z.string()
    }))
    .query(async ({ input, ctx }) => {
      const hasAccess = await hasFeatureAccess(input.feature, ctx.user.role)

      return {
        feature: input.feature,
        hasAccess,
        role: ctx.user.role
      }
    })
})
