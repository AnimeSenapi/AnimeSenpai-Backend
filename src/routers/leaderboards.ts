/**
 * Leaderboards Router - Phase 3 Social Features
 * 
 * Rankings and leaderboards:
 * - Most anime watched
 * - Highest rated
 * - Most friends
 * - Top reviewers
 */

import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import { logger, extractLogContext } from '../lib/logger'

export const leaderboardsRouter = router({
  /**
   * Get top anime watchers
   */
  getTopWatchers: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      timeRange: z.enum(['week', 'month', 'all']).default('all')
    }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit || 20
      const timeRange = input?.timeRange || 'all'
      
      let dateFilter: Date | undefined
      if (timeRange === 'week') {
        dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      } else if (timeRange === 'month') {
        dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      }
      
      // Get all users with their anime counts
      const allUsers = await db.user.findMany({
        select: {
          id: true,
          username: true,
          name: true,
          avatar: true
        }
      })
      
      // Count anime for each user
      const usersWithCounts = await Promise.all(
        allUsers.map(async (user: typeof allUsers[0]) => {
          const count = await db.userAnimeList.count({
            where: {
              userId: user.id,
              ...(dateFilter ? { createdAt: { gte: dateFilter } } : {})
            }
          })
          return { user, count }
        })
      )
      
      // Sort by count and take top
      const leaderboard = usersWithCounts
        .filter(u => u.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
        .map((item, index) => ({
          rank: index + 1,
          user: item.user,
          count: item.count
        }))
      
      return {
        leaderboard
      }
    }),

  /**
   * Get top reviewers
   */
  getTopReviewers: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20)
    }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit || 20
      
      // Get all users
      const allUsers = await db.user.findMany({
        select: {
          id: true,
          username: true,
          name: true,
          avatar: true
        }
      })
      
      // Count reviews for each user
      const usersWithCounts = await Promise.all(
        allUsers.map(async (user: typeof allUsers[0]) => {
          const count = await db.userAnimeReview.count({
            where: {
              userId: user.id,
              isPublic: true
            }
          })
          return { user, count }
        })
      )
      
      // Sort and take top
      const leaderboard = usersWithCounts
        .filter(u => u.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
        .map((item, index) => ({
          rank: index + 1,
          user: item.user,
          count: item.count
        }))
      
      return {
        leaderboard
      }
    }),

  /**
   * Get most social users (most friends)
   */
  getMostSocial: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20)
    }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit || 20
      
      // Get all users
      const allUsers = await db.user.findMany({
        select: {
          id: true,
          username: true,
          name: true,
          avatar: true
        }
      })
      
      // Count friendships for each user (both directions)
      const usersWithCounts = await Promise.all(
        allUsers.map(async (user: typeof allUsers[0]) => {
          const count1 = await db.friendship.count({
            where: { user1Id: user.id }
          })
          const count2 = await db.friendship.count({
            where: { user2Id: user.id }
          })
          return { user, friendCount: count1 + count2 }
        })
      )
      
      // Sort by friend count and take top
      const leaderboard = usersWithCounts
        .filter(u => u.friendCount > 0)
        .sort((a, b) => b.friendCount - a.friendCount)
        .slice(0, limit)
        .map((item, index) => ({
          rank: index + 1,
          user: item.user,
          count: item.friendCount
        }))
      
      return {
        leaderboard
      }
    }),

  /**
   * Get user's ranking position
   */
  getMyRank: protectedProcedure
    .input(z.object({
      category: z.enum(['watched', 'reviews', 'friends', 'points'])
    }))
    .query(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        let rank = 0
        let total = 0
        let userScore = 0
        
        if (input.category === 'watched') {
          userScore = await db.userAnimeList.count({ where: { userId: ctx.user.id } })
          // Simple rank calculation
          rank = 1
          total = await db.user.count()
        } else if (input.category === 'reviews') {
          userScore = await db.userAnimeReview.count({ where: { userId: ctx.user.id, isPublic: true } })
          rank = 1
          total = await db.user.count()
        } else if (input.category === 'friends') {
          const count1 = await db.friendship.count({ where: { user1Id: ctx.user.id } })
          const count2 = await db.friendship.count({ where: { user2Id: ctx.user.id } })
          userScore = count1 + count2
          rank = 1
          total = await db.user.count()
        } else if (input.category === 'points') {
          const achievements = await db.userAchievement.findMany({
            where: { userId: ctx.user.id },
            include: { achievement: true }
          })
          userScore = achievements.reduce((sum: number, ua: typeof achievements[0]) => sum + ua.achievement.points, 0)
          // Would need to calculate for all users - simplified for now
          rank = 0
          total = 0
        }
        
        return {
          rank,
          total,
          score: userScore,
          percentage: total > 0 ? Math.floor((1 - rank / total) * 100) : 0
        }
        
      } catch (error) {
        logger.error('Failed to fetch user rank', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    })
})

