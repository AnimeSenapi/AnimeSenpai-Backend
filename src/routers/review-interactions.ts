/**
 * Review Interactions Router - Phase 2 Social Features
 * 
 * Handles:
 * - Like/unlike reviews
 * - Comment on reviews
 * - Tag friends in reviews
 */

import { z } from 'zod'
import { router, protectedProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import { TRPCError } from '@trpc/server'
import { logger, extractLogContext } from '../lib/logger'

export const reviewInteractionsRouter = router({
  /**
   * Like a review
   */
  likeReview: protectedProcedure
    .input(z.object({
      reviewId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        // Check if review exists
        const review = await db.userAnimeReview.findUnique({
          where: { id: input.reviewId },
          include: {
            user: {
              select: { id: true, username: true }
            }
          }
        })
        
        if (!review) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Review not found'
          })
        }
        
        // Check if already liked
        const existingLike = await db.reviewLike.findUnique({
          where: {
            userId_reviewId: {
              userId: ctx.user.id,
              reviewId: input.reviewId
            }
          }
        })
        
        if (existingLike) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'You have already liked this review'
          })
        }
        
        // Create like
        await db.reviewLike.create({
          data: {
            userId: ctx.user.id,
            reviewId: input.reviewId
          }
        })
        
        // Update review likes count
        await db.userAnimeReview.update({
          where: { id: input.reviewId },
          data: {
            likes: { increment: 1 }
          }
        })
        
        // Create notification for review author (if not liking own review)
        if (review.userId !== ctx.user.id) {
          await db.notification.create({
            data: {
              userId: review.userId,
              fromUserId: ctx.user.id,
              type: 'review_liked',
              relatedId: input.reviewId,
              message: `${ctx.user.username} liked your review`,
              actionUrl: `/reviews/${input.reviewId}`
            }
          })
        }
        
        logger.info('Review liked', logContext, {
          userId: ctx.user.id,
          reviewId: input.reviewId
        })
        
        return {
          success: true,
          liked: true
        }
        
      } catch (error) {
        logger.error('Failed to like review', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Unlike a review
   */
  unlikeReview: protectedProcedure
    .input(z.object({
      reviewId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        // Check if like exists
        const like = await db.reviewLike.findUnique({
          where: {
            userId_reviewId: {
              userId: ctx.user.id,
              reviewId: input.reviewId
            }
          }
        })
        
        if (!like) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Like not found'
          })
        }
        
        // Delete like
        await db.reviewLike.delete({
          where: {
            userId_reviewId: {
              userId: ctx.user.id,
              reviewId: input.reviewId
            }
          }
        })
        
        // Update review likes count
        await db.userAnimeReview.update({
          where: { id: input.reviewId },
          data: {
            likes: { decrement: 1 }
          }
        })
        
        logger.info('Review unliked', logContext, {
          userId: ctx.user.id,
          reviewId: input.reviewId
        })
        
        return {
          success: true,
          liked: false
        }
        
      } catch (error) {
        logger.error('Failed to unlike review', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Get likes for a review
   */
  getReviewLikes: protectedProcedure
    .input(z.object({
      reviewId: z.string(),
      limit: z.number().min(1).max(50).default(20),
      cursor: z.string().optional()
    }))
    .query(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        const likes = await db.reviewLike.findMany({
          where: {
            reviewId: input.reviewId,
            ...(input.cursor ? { createdAt: { lt: new Date(input.cursor) } } : {})
          },
          take: input.limit + 1,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true
              }
            }
          }
        })
        
        let nextCursor: string | null = null
        if (likes.length > input.limit) {
          const nextItem = likes.pop()
          nextCursor = nextItem!.createdAt.toISOString()
        }
        
        return {
          likes,
          nextCursor
        }
        
      } catch (error) {
        logger.error('Failed to fetch review likes', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Add a comment to a review
   */
  addComment: protectedProcedure
    .input(z.object({
      reviewId: z.string(),
      content: z.string().min(1).max(500)
    }))
    .mutation(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        // Check if review exists
        const review = await db.userAnimeReview.findUnique({
          where: { id: input.reviewId },
          include: {
            user: {
              select: { id: true, username: true }
            }
          }
        })
        
        if (!review) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Review not found'
          })
        }
        
        // Create comment
        const comment = await db.reviewComment.create({
          data: {
            userId: ctx.user.id,
            reviewId: input.reviewId,
            content: input.content
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true
              }
            }
          }
        })
        
        // Create notification for review author (if not commenting on own review)
        if (review.userId !== ctx.user.id) {
          await db.notification.create({
            data: {
              userId: review.userId,
              fromUserId: ctx.user.id,
              type: 'review_commented',
              relatedId: input.reviewId,
              message: `${ctx.user.username} commented on your review`,
              actionUrl: `/reviews/${input.reviewId}`
            }
          })
        }
        
        logger.info('Comment added to review', logContext, {
          userId: ctx.user.id,
          reviewId: input.reviewId,
          commentId: comment.id
        })
        
        return {
          success: true,
          comment
        }
        
      } catch (error) {
        logger.error('Failed to add comment', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Get comments for a review
   */
  getComments: protectedProcedure
    .input(z.object({
      reviewId: z.string(),
      limit: z.number().min(1).max(50).default(20),
      cursor: z.string().optional()
    }))
    .query(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        const comments = await db.reviewComment.findMany({
          where: {
            reviewId: input.reviewId,
            ...(input.cursor ? { createdAt: { lt: new Date(input.cursor) } } : {})
          },
          take: input.limit + 1,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true
              }
            }
          }
        })
        
        let nextCursor: string | null = null
        if (comments.length > input.limit) {
          const nextItem = comments.pop()
          nextCursor = nextItem!.createdAt.toISOString()
        }
        
        return {
          comments,
          nextCursor
        }
        
      } catch (error) {
        logger.error('Failed to fetch comments', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Delete a comment
   */
  deleteComment: protectedProcedure
    .input(z.object({
      commentId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        // Check if comment exists and belongs to user
        const comment = await db.reviewComment.findUnique({
          where: { id: input.commentId }
        })
        
        if (!comment) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Comment not found'
          })
        }
        
        if (comment.userId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You can only delete your own comments'
          })
        }
        
        // Delete comment
        await db.reviewComment.delete({
          where: { id: input.commentId }
        })
        
        logger.info('Comment deleted', logContext, {
          userId: ctx.user.id,
          commentId: input.commentId
        })
        
        return {
          success: true
        }
        
      } catch (error) {
        logger.error('Failed to delete comment', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Tag friends in a review
   */
  tagFriends: protectedProcedure
    .input(z.object({
      reviewId: z.string(),
      userIds: z.array(z.string()).min(1).max(10)
    }))
    .mutation(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        // Check if review exists and belongs to user
        const review = await db.userAnimeReview.findUnique({
          where: { id: input.reviewId }
        })
        
        if (!review) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Review not found'
          })
        }
        
        if (review.userId !== ctx.user.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You can only tag friends in your own reviews'
          })
        }
        
        // Verify all users are friends
        const friendships = await db.friendship.findMany({
          where: {
            OR: [
              {
                user1Id: ctx.user.id,
                user2Id: { in: input.userIds },
                status: 'accepted'
              },
              {
                user2Id: ctx.user.id,
                user1Id: { in: input.userIds },
                status: 'accepted'
              }
            ]
          }
        })
        
        const friendIds = friendships.map((f: typeof friendships[0]) => 
          f.user1Id === ctx.user.id ? f.user2Id : f.user1Id
        )
        
        // Only tag actual friends
        const validUserIds = input.userIds.filter(id => friendIds.includes(id))
        
        if (validUserIds.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'None of the users are your friends'
          })
        }
        
        // Create tags
        const tags = await Promise.all(
          validUserIds.map(userId =>
            db.reviewTag.create({
              data: {
                reviewId: input.reviewId,
                userId,
                taggedBy: ctx.user.id
              }
            })
          )
        )
        
        // Create notifications for tagged users
        await Promise.all(
          validUserIds.map(userId =>
            db.notification.create({
              data: {
                userId,
                fromUserId: ctx.user.id,
                type: 'review_tagged',
                relatedId: input.reviewId,
                message: `${ctx.user.username} tagged you in a review`,
                actionUrl: `/reviews/${input.reviewId}`
              }
            })
          )
        )
        
        logger.info('Friends tagged in review', logContext, {
          userId: ctx.user.id,
          reviewId: input.reviewId,
          taggedCount: tags.length
        })
        
        return {
          success: true,
          taggedCount: tags.length,
          tags
        }
        
      } catch (error) {
        logger.error('Failed to tag friends', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Get tagged users for a review
   */
  getTaggedUsers: protectedProcedure
    .input(z.object({
      reviewId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        const tags = await db.reviewTag.findMany({
          where: { reviewId: input.reviewId },
          include: {
            taggedUser: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true
              }
            },
            tagger: {
              select: {
                id: true,
                username: true,
                name: true
              }
            }
          }
        })
        
        return {
          tags
        }
        
      } catch (error) {
        logger.error('Failed to fetch tagged users', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    })
})

