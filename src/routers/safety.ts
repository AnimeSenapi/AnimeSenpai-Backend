/**
 * Safety Router - Phase 3 Social Features
 * 
 * User safety features:
 * - Block users
 * - Report users
 * - Report reviews/content
 */

import { z } from 'zod'
import { router, protectedProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import { TRPCError } from '@trpc/server'
import { logger, extractLogContext } from '../lib/logger'

export const safetyRouter = router({
  /**
   * Block a user
   */
  blockUser: protectedProcedure
    .input(z.object({
      userId: z.string(),
      reason: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        if (input.userId === ctx.user.id) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'You cannot block yourself'
          })
        }
        
        // Check if already blocked
        const existing = await db.blockedUser.findUnique({
          where: {
            userId_blockedId: {
              userId: ctx.user.id,
              blockedId: input.userId
            }
          }
        })
        
        if (existing) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'User is already blocked'
          })
        }
        
        // Create block
        await db.blockedUser.create({
          data: {
            userId: ctx.user.id,
            blockedId: input.userId,
            reason: input.reason
          }
        })
        
        // Remove friendship if exists
        await db.friendship.deleteMany({
          where: {
            OR: [
              { user1Id: ctx.user.id, user2Id: input.userId },
              { user1Id: input.userId, user2Id: ctx.user.id }
            ]
          }
        })
        
        // Remove follow if exists
        await db.follow.deleteMany({
          where: {
            OR: [
              { followerId: ctx.user.id, followingId: input.userId },
              { followerId: input.userId, followingId: ctx.user.id }
            ]
          }
        })
        
        logger.security('User blocked', logContext, {
          userId: ctx.user.id,
          blockedId: input.userId
        })
        
        return {
          success: true
        }
        
      } catch (error) {
        logger.error('Failed to block user', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Unblock a user
   */
  unblockUser: protectedProcedure
    .input(z.object({
      userId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        await db.blockedUser.deleteMany({
          where: {
            userId: ctx.user.id,
            blockedId: input.userId
          }
        })
        
        logger.info('User unblocked', logContext, {
          userId: ctx.user.id,
          unblockedId: input.userId
        })
        
        return {
          success: true
        }
        
      } catch (error) {
        logger.error('Failed to unblock user', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Get blocked users
   */
  getBlockedUsers: protectedProcedure
    .query(async ({ ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        const blocked = await db.blockedUser.findMany({
          where: { userId: ctx.user.id },
          include: {
            blocked: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        })
        
        return {
          blockedUsers: blocked
        }
        
      } catch (error) {
        logger.error('Failed to fetch blocked users', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Report a user
   */
  reportUser: protectedProcedure
    .input(z.object({
      userId: z.string(),
      reason: z.enum(['spam', 'harassment', 'inappropriate_content', 'fake_account', 'other']),
      description: z.string().min(10).max(500)
    }))
    .mutation(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        if (input.userId === ctx.user.id) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'You cannot report yourself'
          })
        }
        
        // Create report
        const report = await db.userReport.create({
          data: {
            reporterId: ctx.user.id,
            reportedId: input.userId,
            reason: input.reason,
            description: input.description,
            status: 'pending'
          }
        })
        
        logger.security('User reported', logContext, {
          reporterId: ctx.user.id,
          reportedId: input.userId,
          reason: input.reason
        })
        
        return {
          success: true,
          reportId: report.id
        }
        
      } catch (error) {
        logger.error('Failed to report user', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Get reports (Admin only)
   */
  getReports: protectedProcedure
    .input(z.object({
      status: z.enum(['pending', 'reviewed', 'actioned', 'dismissed']).optional(),
      limit: z.number().min(1).max(100).default(20)
    }).optional())
    .query(async ({ ctx, input }) => {
      // Check admin role
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required'
        })
      }
      const limit = input?.limit || 20
      const status = input?.status
      
      const reports = await db.userReport.findMany({
        where: status ? { status } : undefined,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: {
            select: {
              id: true,
              username: true,
              name: true
            }
          },
          reported: {
            select: {
              id: true,
              username: true,
              name: true,
              email: true,
              role: true
            }
          },
          reviewer: {
            select: {
              id: true,
              username: true,
              name: true
            }
          }
        }
      })
      
      return {
        reports
      }
    }),

  /**
   * Review a report (Admin only)
   */
  reviewReport: protectedProcedure
    .input(z.object({
      reportId: z.string(),
      action: z.enum(['dismiss', 'warn', 'suspend', 'ban']),
      notes: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      // Check admin role
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required'
        })
      }
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        await db.userReport.update({
          where: { id: input.reportId },
          data: {
            status: input.action === 'dismiss' ? 'dismissed' : 'actioned',
            reviewedBy: ctx.user.id,
            reviewedAt: new Date()
          }
        })
        
        logger.security('Report reviewed', logContext, {
          adminId: ctx.user.id,
          reportId: input.reportId,
          action: input.action
        })
        
        return {
          success: true
        }
        
      } catch (error) {
        logger.error('Failed to review report', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    })
})

