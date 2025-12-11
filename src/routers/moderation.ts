/**
 * Content Moderation Router
 * 
 * Handles moderation of user-generated content:
 * - User reviews
 * - User profiles
 * - Flagged content
 * 
 * Admin-only access with full audit logging
 */

import { z } from 'zod'
import { router, protectedProcedure } from '../lib/trpc.js'
import { db } from '../lib/db.js'
import { Prisma } from '@prisma/client'
import { requireAdmin } from '../lib/roles.js'
import { checkAdminRateLimit, secureAdminOperation } from '../lib/admin-security.js'
import { TRPCError } from '@trpc/server'
import { logger, extractLogContext } from '../lib/logger.js'

export const moderationRouter = router({
  // Get all reviews with moderation info
  getReviews: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
      filter: z.enum(['all', 'public', 'hidden', 'recent']).default('all'),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input = {}, ctx }) => {
      requireAdmin(ctx.user.role)
      
      const { page = 1, limit = 20, filter = 'all', search } = input
      const skip = (page - 1) * limit

      // Build where clause
      const where: any = {}
      
      if (filter === 'public') {
        where.isPublic = true
      } else if (filter === 'hidden') {
        where.isPublic = false
      } else if (filter === 'recent') {
        where.createdAt = {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { content: { contains: search, mode: Prisma.QueryMode.insensitive } }
        ]
      }

      // Fetch reviews with user and anime data
      const [reviews, total] = await Promise.all([
        db.userAnimeReview.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                role: true
              }
            },
            anime: {
              select: {
                id: true,
                title: true,
                titleEnglish: true,
                slug: true,
                coverImage: true
              }
            }
          }
        }),
        db.userAnimeReview.count({ where })
      ])

      return {
        reviews,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    }),

  // Get review statistics
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx.user.role)

      const [total, public_, hidden, recent, flagged] = await Promise.all([
        db.userAnimeReview.count(),
        db.userAnimeReview.count({ where: { isPublic: true } }),
        db.userAnimeReview.count({ where: { isPublic: false } }),
        db.userAnimeReview.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        }),
        // For now, we'll use 0 for flagged (would need a flag system)
        Promise.resolve(0)
      ])

      return {
        total,
        public: public_,
        hidden,
        recent,
        flagged
      }
    }),

  // Hide/unhide a review
  toggleReviewVisibility: protectedProcedure
    .input(z.object({
      reviewId: z.string(),
      isPublic: z.boolean()
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)
      checkAdminRateLimit(ctx.user.id)

      const { reviewId, isPublic } = input
      const logContext = extractLogContext(ctx.req, ctx.user.id)

      return await secureAdminOperation(
        ctx.user.id,
        'moderate_review',
        async () => {
          // Get review to log details
          const review = await db.userAnimeReview.findUnique({
            where: { id: reviewId },
            include: {
              user: { select: { username: true } },
              anime: { select: { title: true } }
            }
          })

          if (!review) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Review not found'
            })
          }

          // Update review visibility
          const updated = await db.userAnimeReview.update({
            where: { id: reviewId },
            data: { isPublic }
          })

          logger.security('Review visibility toggled', logContext, {
            reviewId,
            isPublic,
            username: review.user.username,
            animeTitle: review.anime.title,
            action: isPublic ? 'unhide' : 'hide'
          })

          return {
            success: true,
            review: updated
          }
        }
      )
    }),

  // Delete a review
  deleteReview: protectedProcedure
    .input(z.object({
      reviewId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)
      checkAdminRateLimit(ctx.user.id)

      const { reviewId } = input
      const logContext = extractLogContext(ctx.req, ctx.user.id)

      return await secureAdminOperation(
        ctx.user.id,
        'delete_review',
        async () => {
          // Get review details before deletion
          const review = await db.userAnimeReview.findUnique({
            where: { id: reviewId },
            include: {
              user: { select: { id: true, username: true } },
              anime: { select: { title: true } }
            }
          })

          if (!review) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Review not found'
            })
          }

          // Delete review
          await db.userAnimeReview.delete({
            where: { id: reviewId }
          })

          logger.security('Review deleted', logContext, {
            reviewId,
            userId: review.user.id,
            username: review.user.username,
            animeTitle: review.anime.title,
            reviewTitle: review.title
          })

          return {
            success: true,
            message: 'Review deleted successfully'
          }
        }
      )
    }),

  // Get flagged users (inappropriate usernames, etc.)
  getFlaggedUsers: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx.user.role)

      // Get users with potentially inappropriate content
      // For now, we'll get recently created users to manually review
      const users = await db.user.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        },
        take: 50,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true,
          emailVerified: true,
          createdAt: true,
          _count: {
            select: {
              reviews: true
            }
          }
        }
      })

      return {
        users,
        total: users.length
      }
    })
})

