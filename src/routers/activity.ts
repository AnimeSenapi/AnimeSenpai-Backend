/**
 * Activity Feed Router - Phase 2 Social Features
 * 
 * Shows friend activities in a timeline:
 * - Recently watched anime
 * - New reviews/ratings
 * - Completed anime
 * - Started watching
 */

import { z } from 'zod'
import { router, protectedProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import { logger, extractLogContext } from '../lib/logger'

export const activityRouter = router({
  /**
   * Get friend activities for current user's timeline
   */
  getFriendActivities: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      cursor: z.string().optional(), // For pagination
    }).optional())
    .query(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      const limit = input?.limit || 20
      const cursor = input?.cursor
      
      try {
        logger.info('Fetching friend activities', logContext, { userId: ctx.user.id })
        
        // Get user's friends (both directions)
        const friendships = await db.friendship.findMany({
          where: {
            OR: [
              { user1Id: ctx.user.id },
              { user2Id: ctx.user.id }
            ],
            status: 'accepted'
          },
          select: {
            user1Id: true,
            user2Id: true
          }
        })
        
        const friendIds = friendships.map((f: typeof friendships[0]) => 
          f.user1Id === ctx.user.id ? f.user2Id : f.user1Id
        )
        
        if (friendIds.length === 0) {
          return {
            activities: [],
            nextCursor: null
          }
        }
        
        // Fetch activities from friends
        const activities = await db.activityFeed.findMany({
          where: {
            userId: { in: friendIds },
            isPublic: true,
            ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {})
          },
          take: limit + 1,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true
              }
            },
            anime: {
              select: {
                id: true,
                slug: true,
                title: true,
                titleEnglish: true,
                coverImage: true
              }
            },
            targetUser: {
              select: {
                id: true,
                username: true,
                name: true
              }
            }
          }
        })
        
        let nextCursor: string | null = null
        if (activities.length > limit) {
          const nextItem = activities.pop()
          nextCursor = nextItem!.createdAt.toISOString()
        }
        
        // Parse metadata JSON
        const parsedActivities = activities.map((activity: typeof activities[0]) => ({
          ...activity,
          metadata: activity.metadata ? JSON.parse(activity.metadata) : null
        }))
        
        logger.info('Friend activities fetched', logContext, {
          userId: ctx.user.id,
          count: parsedActivities.length,
          friendCount: friendIds.length
        })
        
        return {
          activities: parsedActivities,
          nextCursor
        }
        
      } catch (error) {
        logger.error('Failed to fetch friend activities', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Get user's own activity history
   */
  getMyActivities: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      cursor: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      const limit = input?.limit || 20
      const cursor = input?.cursor
      
      try {
        const activities = await db.activityFeed.findMany({
          where: {
            userId: ctx.user.id,
            ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {})
          },
          take: limit + 1,
          orderBy: { createdAt: 'desc' },
          include: {
            anime: {
              select: {
                id: true,
                slug: true,
                title: true,
                titleEnglish: true,
                coverImage: true
              }
            }
          }
        })
        
        let nextCursor: string | null = null
        if (activities.length > limit) {
          const nextItem = activities.pop()
          nextCursor = nextItem!.createdAt.toISOString()
        }
        
        // Parse metadata
        const parsedActivities = activities.map((activity: typeof activities[0]) => ({
          ...activity,
          metadata: activity.metadata ? JSON.parse(activity.metadata) : null
        }))
        
        return {
          activities: parsedActivities,
          nextCursor
        }
        
      } catch (error) {
        logger.error('Failed to fetch user activities', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Create a new activity (called automatically by other actions)
   */
  createActivity: protectedProcedure
    .input(z.object({
      activityType: z.enum(['rated_anime', 'completed_anime', 'added_to_list', 'started_watching', 'followed_user', 'reviewed_anime']),
      animeId: z.string().optional(),
      targetUserId: z.string().optional(),
      metadata: z.record(z.any()).optional(),
      isPublic: z.boolean().default(true)
    }))
    .mutation(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        // Check user's privacy settings
        const privacySettings = await db.userPrivacySettings.findUnique({
          where: { userId: ctx.user.id }
        })
        
        // If activity privacy is off, don't create the activity
        if (privacySettings && !privacySettings.showActivity) {
          return { success: true, created: false }
        }
        
        const activity = await db.activityFeed.create({
          data: {
            userId: ctx.user.id,
            activityType: input.activityType,
            animeId: input.animeId,
            targetUserId: input.targetUserId,
            metadata: input.metadata ? JSON.stringify(input.metadata) : null,
            isPublic: input.isPublic
          }
        })
        
        logger.info('Activity created', logContext, {
          userId: ctx.user.id,
          activityType: input.activityType,
          activityId: activity.id
        })
        
        return {
          success: true,
          created: true,
          activity
        }
        
      } catch (error) {
        logger.error('Failed to create activity', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Get activity statistics for a user
   */
  getActivityStats: protectedProcedure
    .input(z.object({
      userId: z.string().optional(), // If not provided, use current user
      timeRange: z.enum(['week', 'month', 'year', 'all']).default('month')
    }).optional())
    .query(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      const targetUserId = input?.userId || ctx.user.id
      const timeRange = input?.timeRange || 'month'
      
      try {
        // Calculate date range
        const now = new Date()
        let startDate: Date | undefined
        
        switch (timeRange) {
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            break
          case 'month':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            break
          case 'year':
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
            break
        }
        
        const activities = await db.activityFeed.findMany({
          where: {
            userId: targetUserId,
            isPublic: true,
            ...(startDate ? { createdAt: { gte: startDate } } : {})
          },
          select: {
            activityType: true,
            createdAt: true
          }
        })
        
        // Group by activity type
        const stats = activities.reduce((acc: Record<string, number>, activity: typeof activities[0]) => {
          const type = activity.activityType
          if (!acc[type]) {
            acc[type] = 0
          }
          acc[type]++
          return acc
        }, {} as Record<string, number>)
        
        return {
          totalActivities: activities.length,
          byType: stats,
          timeRange
        }
        
      } catch (error) {
        logger.error('Failed to fetch activity stats', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    })
})

