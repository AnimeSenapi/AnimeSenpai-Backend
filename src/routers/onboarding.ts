/**
 * 🎓 Onboarding Router
 * 
 * Help new users get started with personalized recommendations.
 * Senpai will learn what you love!
 */

import { z } from 'zod'
import { router, protectedProcedure } from '../lib/trpc.js'
import { db } from '../lib/db.js'
import { TRPCError } from '@trpc/server'

export const onboardingRouter = router({
  // Get onboarding status
  getStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const preferences = await db.userPreferences.findUnique({
        where: { userId: ctx.user.id },
        select: {
          onboardingCompleted: true,
          favoriteGenres: true,
          favoriteTags: true,
          discoveryMode: true
        }
      })
      
      if (!preferences) {
        return {
          completed: false,
          step: 1
        }
      }
      
      return {
        completed: preferences.onboardingCompleted,
        step: preferences.onboardingCompleted ? 5 : 1,
        data: {
          favoriteGenres: preferences.favoriteGenres,
          favoriteTags: preferences.favoriteTags,
          discoveryMode: preferences.discoveryMode
        }
      }
    }),

  // Save favorite genres (Step 2)
  saveFavoriteGenres: protectedProcedure
    .input(z.object({
      genreIds: z.array(z.string()).min(3, 'Please select at least 3 genres').max(10, 'Maximum 10 genres allowed')
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify all genres exist
      const genres = await db.genre.findMany({
        where: {
          id: { in: input.genreIds }
        },
        ...getCacheStrategy(3600) // 1 hour - genres rarely change
      })
      
      if (genres.length !== input.genreIds.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Some genres do not exist'
        })
      }
      
      await db.userPreferences.update({
        where: { userId: ctx.user.id },
        data: {
          favoriteGenres: input.genreIds
        }
      })
      
      return { success: true }
    }),

  // Save initial ratings (Step 3)
  saveInitialRatings: protectedProcedure
    .input(z.object({
      ratings: z.array(z.object({
        animeId: z.string(),
        score: z.number().min(1).max(10)
      })).min(3, 'Please rate at least 3 anime').max(20)
    }))
    .mutation(async ({ input, ctx }) => {
      // Save ratings to user anime list
      const operations = input.ratings.map(rating =>
        db.userAnimeList.upsert({
          where: {
            userId_animeId: {
              userId: ctx.user.id,
              animeId: rating.animeId
            }
          },
          create: {
            userId: ctx.user.id,
            animeId: rating.animeId,
            status: 'completed',
            score: rating.score,
            progress: 0
          },
          update: {
            score: rating.score
          }
        })
      )
      
      await Promise.all(operations)
      
      return { success: true }
    }),

  // Save favorite tags (Step 4)
  saveFavoriteTags: protectedProcedure
    .input(z.object({
      tags: z.array(z.string()).max(10, 'Maximum 10 tags allowed')
    }))
    .mutation(async ({ input, ctx }) => {
      await db.userPreferences.update({
        where: { userId: ctx.user.id },
        data: {
          favoriteTags: input.tags
        }
      })
      
      return { success: true }
    }),

  // Save discovery preference (Step 5)
  saveDiscoveryMode: protectedProcedure
    .input(z.object({
      discoveryMode: z.enum(['focused', 'balanced', 'exploratory'])
    }))
    .mutation(async ({ input, ctx }) => {
      await db.userPreferences.update({
        where: { userId: ctx.user.id },
        data: {
          discoveryMode: input.discoveryMode,
          onboardingCompleted: true // Mark as completed
        }
      })
      
      return { success: true }
    }),

  // Complete onboarding (all steps)
  completeOnboarding: protectedProcedure
    .input(z.object({
      favoriteGenres: z.array(z.string()).min(3).max(10),
      ratings: z.array(z.object({
        animeId: z.string(),
        score: z.number().min(1).max(10)
      })).optional().default([]), // Make ratings optional
      favoriteTags: z.array(z.string()).max(10).optional(),
      discoveryMode: z.enum(['focused', 'balanced', 'exploratory']).default('balanced')
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify genres exist
      const genres = await db.genre.findMany({
        where: { id: { in: input.favoriteGenres } }
      })
      
      if (genres.length !== input.favoriteGenres.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Some genres do not exist'
        })
      }
      
      // Save all ratings (if any)
      if (input.ratings && input.ratings.length > 0) {
        const ratingOperations = input.ratings.map(rating =>
          db.userAnimeList.upsert({
            where: {
              userId_animeId: {
                userId: ctx.user.id,
                animeId: rating.animeId
              }
            },
            create: {
              userId: ctx.user.id,
              animeId: rating.animeId,
              status: 'completed',
              score: rating.score,
              progress: 0
            },
            update: {
              score: rating.score
            }
          })
        )
        
        await Promise.all(ratingOperations)
      }
      
      // Update preferences (create if doesn't exist)
      await db.userPreferences.upsert({
        where: { userId: ctx.user.id },
        update: {
          favoriteGenres: input.favoriteGenres,
          favoriteTags: input.favoriteTags || [],
          discoveryMode: input.discoveryMode,
          onboardingCompleted: true
        },
        create: {
          userId: ctx.user.id,
          favoriteGenres: input.favoriteGenres,
          favoriteTags: input.favoriteTags || [],
          discoveryMode: input.discoveryMode,
          onboardingCompleted: true
        }
      })
      
      return { success: true }
    }),

  // Skip onboarding (user can do it later)
  skipOnboarding: protectedProcedure
    .mutation(async ({ ctx }) => {
      await db.userPreferences.upsert({
        where: { userId: ctx.user.id },
        update: {
          onboardingCompleted: true
        },
        create: {
          userId: ctx.user.id,
          onboardingCompleted: true
        }
      })
      
      return { success: true }
    }),

  // Get popular anime for rating during onboarding
  getPopularForOnboarding: protectedProcedure
    .input(z.object({
      limit: z.number().min(5).max(30).default(15)
    }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit || 15
      
      // Get diverse popular anime across different genres
      const popular = await db.anime.findMany({
        where: {
          averageRating: { gte: 7 }, // Quality filter
          viewCount: { gte: 1000 } // Popularity filter
        },
        include: {
          genres: {
            include: {
              genre: true
            }
          }
        },
        orderBy: [
          { viewCount: 'desc' },
          { averageRating: 'desc' }
        ],
        take: limit,
        ...getCacheStrategy(600) // 10 minutes - popular anime for onboarding
      })
      
      return {
        anime: popular.map((a: typeof popular[0]) => ({
          id: a.id,
          slug: a.slug,
          title: a.title,
          coverImage: a.coverImage,
          year: a.year,
          type: a.type,
          averageRating: a.averageRating,
          genres: a.genres.map((g: typeof a.genres[0]) => ({
            id: g.genre.id,
            name: g.genre.name,
            slug: g.genre.slug
          }))
        }))
      }
    })
})

