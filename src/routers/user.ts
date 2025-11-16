import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import { getUserFeatures, hasFeatureAccess } from '../lib/roles'
import { invalidateUserCaches } from '../lib/recommendations'
import { createActivity } from '../lib/social'
import { TRPCError } from '@trpc/server'

export const userRouter = router({
  // Get user's anime list with full anime details
  getAnimeList: protectedProcedure
    .input(z.object({
      status: z.enum(['favorite', 'watching', 'completed', 'plan-to-watch', 'on-hold', 'dropped']).optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(50000).optional(), // Will be capped by system settings
      sortBy: z.enum(['updatedAt', 'createdAt', 'title']).default('updatedAt'),
      sortOrder: z.enum(['asc', 'desc']).default('desc')
    }).optional())
    .query(async ({ input = {}, ctx }) => {
      // Get system settings for max limit
      const systemSettings = await db.systemSettings.findFirst()
      const maxLimit = systemSettings?.maxUserListItems || 5000
      
      const { status, page = 1, sortBy = 'updatedAt', sortOrder = 'desc' } = input
      const requestedLimit = input.limit || maxLimit
      const limit = Math.min(requestedLimit, maxLimit) // Cap at system max
      const skip = (page - 1) * limit
      
      console.log(`[DEBUG] getAnimeList called - user: ${ctx.user.id}, status: ${status}, page: ${page}, limit: ${limit}, maxLimit: ${maxLimit}, skip: ${skip}`)

      const where: any = {
        userId: ctx.user.id
      }

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
          take: limit,
          orderBy: {
            [sortBy]: sortOrder
          },
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
          }
        }),
        db.userAnimeList.count({ where })
      ])

      console.log(`[DEBUG] User ${ctx.user.id} anime list: found ${animeLists.length} items (total: ${total}, limit: ${limit}, skip: ${skip})`)

      // Fetch full anime details
      const animeIds = animeLists.map((item: typeof animeLists[0]) => item.animeId)
      const animeDetails = await db.anime.findMany({
        where: {
          id: { in: animeIds }
        },
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
                }
              }
            }
          }
        }
      })

      // Merge list data with anime details
      const animeMap = new Map<string, typeof animeDetails[0]>(animeDetails.map((a: typeof animeDetails[0]) => [a.id, a]))
      const mergedData = animeLists.map((listItem: typeof animeLists[0]) => {
        const anime = animeMap.get(listItem.animeId)
        return {
          listId: listItem.id,
          anime: anime ? {
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
            genres: anime.genres.map((g: typeof anime.genres[0]) => g.genre)
          } : null,
          listStatus: listItem.status,
          isFavorite: listItem.isFavorite, // Include favorite flag
          progress: listItem.progress,
          score: listItem.score,
          notes: listItem.notes,
          startedAt: listItem.startedAt,
          completedAt: listItem.completedAt,
          createdAt: listItem.createdAt,
          updatedAt: listItem.updatedAt
        }
      }).filter((item: typeof mergedData[0]) => item.anime !== null)

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
      status: z.enum(['favorite', 'watching', 'completed', 'plan-to-watch', 'on-hold', 'dropped']),
      isFavorite: z.boolean().optional(),
      score: z.number().min(1).max(10).optional(),
      notes: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const { animeId, status, isFavorite, score, notes } = input

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

      // Handle favorite as a special case - it can be BOTH favorite AND have a status
      const actualStatus = status === 'favorite' ? 'plan-to-watch' : status
      const actualIsFavorite = status === 'favorite' ? true : (isFavorite ?? false)

      // Upsert anime list entry
      const animeList = await db.userAnimeList.upsert({
        where: {
          userId_animeId: {
            userId: ctx.user.id,
            animeId
          }
        },
        update: {
          status: actualStatus,
          isFavorite: actualIsFavorite,
          score: score !== undefined ? score : undefined,
          notes: notes !== undefined ? notes : undefined,
          completedAt: actualStatus === 'completed' ? (completedAt || now) : null
        },
        create: {
          userId: ctx.user.id,
          animeId,
          status: actualStatus,
          isFavorite: actualIsFavorite,
          score,
          notes,
          startedAt,
          completedAt
        }
      })

      console.log(`[DEBUG] Added/Updated anime ${animeId} for user ${ctx.user.id}: status=${actualStatus}, isFavorite=${actualIsFavorite}`)

      // Create activity if favorited
      if (actualIsFavorite) {
        await createActivity(
          ctx.user.id,
          'favorited_anime',
          animeId,
          null,
          null
        )
      }

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
      status: z.enum(['favorite', 'watching', 'completed', 'plan-to-watch', 'on-hold', 'dropped']).optional(),
      isFavorite: z.boolean().optional(),
      score: z.number().min(1).max(10).optional(),
      notes: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const { animeId, status, isFavorite, score, notes } = input

      // Build update data
      const updateData: any = {}
      if (status !== undefined) {
        // Handle favorite as a special case
        if (status === 'favorite') {
          updateData.isFavorite = true
          // Don't change status if it's just marking as favorite
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

      // If score was updated, invalidate recommendation caches
      if (score !== undefined) {
        invalidateUserCaches(ctx.user.id)
        
        // Create activity for rating
        await createActivity(
          ctx.user.id,
          'rated_anime',
          animeId,
          null,
          { score }
        )
      }
      
      // If status changed to completed, create activity
      if (status === 'completed') {
        await createActivity(
          ctx.user.id,
          'completed_anime',
          animeId,
          null,
          null
        )
      }
      
      // If status changed to watching, create activity
      if (status === 'watching') {
        await createActivity(
          ctx.user.id,
          'started_watching',
          animeId,
          null,
          null
        )
      }

      return animeList
    }),

  // Toggle favorite status (independent of watch status)
  toggleFavorite: protectedProcedure
    .input(z.object({
      animeId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const { animeId } = input

      // Check if anime exists in user's list
      const existing = await db.userAnimeList.findUnique({
        where: {
          userId_animeId: {
            userId: ctx.user.id,
            animeId
          }
        }
      })

      if (!existing) {
        // If not in list, add it as favorite with plan-to-watch status
        const animeList = await db.userAnimeList.create({
          data: {
            userId: ctx.user.id,
            animeId,
            status: 'plan-to-watch',
            isFavorite: true
          }
        })

        // Create activity
        await createActivity(
          ctx.user.id,
          'favorited_anime',
          animeId,
          null,
          null
        )

        return { ...animeList, isFavorite: true }
      }

      // Toggle favorite status
      const newFavoriteStatus = !existing.isFavorite
      const updated = await db.userAnimeList.update({
        where: {
          userId_animeId: {
            userId: ctx.user.id,
            animeId
          }
        },
        data: {
          isFavorite: newFavoriteStatus
        }
      })

      // Create or remove activity
      if (newFavoriteStatus) {
        await createActivity(
          ctx.user.id,
          'favorited_anime',
          animeId,
          null,
          null
        )
      }

      return { ...updated, isFavorite: newFavoriteStatus }
    }),

  // Get favorited anime IDs
  getFavoritedAnimeIds: protectedProcedure
    .query(async ({ ctx }) => {
      const favorites = await db.userAnimeList.findMany({
        where: {
          userId: ctx.user.id,
          isFavorite: true
        },
        select: {
          animeId: true
        }
      })

      return {
        animeIds: favorites.map((f: typeof favorites[0]) => f.animeId)
      }
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

      // Invalidate caches to refresh recommendations
      invalidateUserCaches(ctx.user.id)
      
      // Create activity
      await createActivity(
        ctx.user.id,
        'rated_anime',
        animeId,
        null,
        { score: rating }
      )

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

      const totalEpisodes = watchedAnime.reduce((sum: number, item: typeof watchedAnime[0]) => sum + item.progress, 0)

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
      const animeIds = recentActivity.map((a: typeof recentActivity[0]) => a.animeId)
      const animeDetails = await db.anime.findMany({
        where: { id: { in: animeIds } },
        select: {
          id: true,
          slug: true,
          title: true,
          coverImage: true
        }
      })

      const animeMap = new Map<string, typeof animeDetails[0]>(animeDetails.map((a: typeof animeDetails[0]) => [a.id, a]))
      const recentActivityWithAnime = recentActivity.map((activity: typeof recentActivity[0]) => ({
        anime: animeMap.get(activity.animeId),
        status: activity.status,
        progress: activity.progress,
        updatedAt: activity.updatedAt
      }))

      return {
        user: {
          id: ctx.user.id,
          email: ctx.user.email,
          username: ctx.user.username,
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
      const animeIds = reviews.map((r: typeof reviews[0]) => r.animeId)
      const animeDetails = await db.anime.findMany({
        where: { id: { in: animeIds } },
        select: {
          id: true,
          slug: true,
          title: true,
          coverImage: true
        }
      })

      const animeMap = new Map<string, typeof animeDetails[0]>(animeDetails.map((a: typeof animeDetails[0]) => [a.id, a]))
      const reviewsWithAnime = reviews.map((review: typeof reviews[0]) => ({
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
    }),

  // Get user by username (public endpoint for viewing profiles)
  getUserByUsername: publicProcedure
    .input(z.object({
      username: z.string().min(2).max(50).toLowerCase().trim()
    }))
    .query(async ({ input }) => {
      // Normalize username (already lowercase and trimmed)
      const normalizedUsername = input.username
      
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
              showRatings: true
            }
          }
        }
      })

      // If not found, try case-insensitive search
      if (!user) {
        const users = await db.user.findMany({
          where: {
            username: {
              mode: 'insensitive',
              equals: normalizedUsername
            }
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
                showRatings: true
              }
            }
          },
          take: 1
        })
        
        user = users[0] || null
      }

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `User "@${normalizedUsername}" not found. This username doesn't exist yet!`
        })
      }

      // Check if profile is public
      if (user.preferences?.profileVisibility === 'private') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'This profile is private.'
        })
      }

      // Get user stats
      const [
        totalAnime,
        totalEpisodes,
        favoriteCount,
        completedCount
      ] = await Promise.all([
        db.userAnimeList.count({
          where: { userId: user.id }
        }),
        db.userAnimeList.aggregate({
          where: { userId: user.id },
          _sum: { progress: true }
        }),
        db.userAnimeList.count({
          where: { userId: user.id, isFavorite: true }
        }),
        db.userAnimeList.count({
          where: { userId: user.id, status: 'completed' }
        })
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
          completed: completedCount
        },
        preferences: {
          showWatchHistory: user.preferences?.showWatchHistory ?? true,
          showFavorites: user.preferences?.showFavorites ?? true,
          showRatings: user.preferences?.showRatings ?? true
        }
      }
    }),

  // Check username availability (public endpoint)
  checkUsernameAvailability: publicProcedure
    .input(z.object({
      username: z.string().min(2).max(50).trim()
    }))
    .query(async ({ input }) => {
      // Check if username contains uppercase letters
      if (/[A-Z]/.test(input.username)) {
        return {
          available: false,
          username: input.username,
          reason: 'Username must be lowercase only. Please use only lowercase letters, numbers, underscores, and hyphens.'
        }
      }

      // Check if username contains invalid characters
      if (!/^[a-z0-9_-]+$/.test(input.username)) {
        return {
          available: false,
          username: input.username,
          reason: 'Username can only contain lowercase letters, numbers, underscores, and hyphens'
        }
      }

      const existingUser = await db.user.findUnique({
        where: { username: input.username },
        select: { id: true }
      })

      if (existingUser) {
        return {
          available: false,
          username: input.username,
          reason: 'Username is already taken'
        }
      }

      // Check if uppercase version exists
      // Block if uppercase exists (e.g., "JohnDoe" exists, block "johndoe")
      const uppercaseUsername = input.username.split('').map((char) => 
        char >= 'a' && char <= 'z' ? String.fromCharCode(char.charCodeAt(0) - 32) : char
      ).join('')
      
      if (uppercaseUsername !== input.username) {
        const uppercaseUser = await db.user.findFirst({
          where: { username: uppercaseUsername },
          select: { id: true, username: true }
        })

        if (uppercaseUser) {
          return {
            available: false,
            username: input.username,
            reason: `Username "${uppercaseUser.username}" already exists`
          }
        }
      }

      return {
        available: true,
        username: input.username
      }
    }),

  // Get user's public anime list (for viewing other users' profiles)
  getUserAnimeList: publicProcedure
    .input(z.object({
      username: z.string().min(2).max(50).toLowerCase().trim(),
      status: z.enum(['favorite', 'watching', 'completed', 'plan-to-watch']).optional(),
      limit: z.number().min(1).max(100).default(20)
    }))
    .query(async ({ input }) => {
      const { username, status, limit } = input

      // Normalize username: decode URL encoding and strip @ prefix
      let normalizedUsername = username
      try {
        normalizedUsername = decodeURIComponent(normalizedUsername)
      } catch (_) {
        // ignore decode errors; proceed with original
      }
      if (normalizedUsername.startsWith('%40')) {
        normalizedUsername = normalizedUsername.slice(3)
      }
      if (normalizedUsername.startsWith('@')) {
        normalizedUsername = normalizedUsername.slice(1)
      }
      normalizedUsername = normalizedUsername.toLowerCase().trim()

      // Find user with case-insensitive search
      const user = await db.user.findFirst({
        where: { 
          username: {
            mode: 'insensitive',
            equals: normalizedUsername
          }
        },
        select: {
          id: true,
          preferences: {
            select: {
              showWatchHistory: true,
              showFavorites: true,
              profileVisibility: true
            }
          }
        }
      })

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found'
        })
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
          progress: true
        }
      })

      // Fetch anime details
      const animeIds = animeList.map((item: typeof animeList[0]) => item.animeId)
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
                  slug: true
                }
              }
            }
          }
        }
      })

      // Merge data
      const animeMap = new Map<string, typeof animeDetails[0]>(animeDetails.map((a: typeof animeDetails[0]) => [a.id, a]))
      const items = animeList.map((listItem: typeof animeList[0]) => {
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
          genres: anime.genres.map((g: typeof anime.genres[0]) => g.genre),
          tags: [],
          listStatus: listItem.status,
          userScore: listItem.score
        }
      }).filter(Boolean)

      return { items }
    })
})
