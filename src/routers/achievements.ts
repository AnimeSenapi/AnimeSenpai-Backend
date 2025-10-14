/**
 * Achievements Router - Phase 3 Social Features
 * 
 * Achievement/badge system for user milestones:
 * - Watching achievements (10, 50, 100, 500 anime)
 * - Rating achievements (10, 50, 100 ratings)
 * - Social achievements (10, 50 friends)
 * - Discovery achievements (try new genres)
 */

import { z } from 'zod'
import { router, protectedProcedure, publicProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import { logger, extractLogContext } from '../lib/logger'

export const achievementsRouter = router({
  /**
   * Get all available achievements
   */
  getAll: publicProcedure
    .query(async () => {
      try {
        const achievements = await db.achievement.findMany({
          orderBy: [
            { category: 'asc' },
            { requirement: 'asc' }
          ]
        })
        
        return {
          achievements
        }
        
      } catch (error) {
        throw error
      }
    }),

  /**
   * Get user's achievements
   */
  getMyAchievements: protectedProcedure
    .query(async ({ ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        const userAchievements = await db.userAchievement.findMany({
          where: { userId: ctx.user.id },
          include: {
            achievement: true
          },
          orderBy: { unlockedAt: 'desc' }
        })
        
        const allAchievements = await db.achievement.findMany()
        
        // Calculate progress for locked achievements
        const progress = await calculateUserProgress(ctx.user.id)
        
        const achievementsWithProgress = allAchievements.map(achievement => {
          const unlocked = userAchievements.find(ua => ua.achievementId === achievement.id)
          
          return {
            ...achievement,
            unlocked: !!unlocked,
            unlockedAt: unlocked?.unlockedAt,
            progress: progress[achievement.key] || 0,
            percentage: Math.min(100, Math.floor((progress[achievement.key] || 0) / achievement.requirement * 100))
          }
        })
        
        // Group by category
        const byCategory = achievementsWithProgress.reduce((acc, achievement) => {
          if (!acc[achievement.category]) {
            acc[achievement.category] = []
          }
          acc[achievement.category].push(achievement)
          return acc
        }, {} as Record<string, typeof achievementsWithProgress>)
        
        const totalPoints = userAchievements.reduce((sum, ua) => sum + ua.achievement.points, 0)
        
        return {
          achievements: achievementsWithProgress,
          byCategory,
          unlockedCount: userAchievements.length,
          totalCount: allAchievements.length,
          totalPoints
        }
        
      } catch (error) {
        logger.error('Failed to fetch user achievements', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Check and unlock achievements for a user
   * Called automatically after user actions
   */
  checkAndUnlock: protectedProcedure
    .mutation(async ({ ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        const progress = await calculateUserProgress(ctx.user.id)
        const allAchievements = await db.achievement.findMany()
        const userAchievements = await db.userAchievement.findMany({
          where: { userId: ctx.user.id },
          select: { achievementId: true }
        })
        
        const unlockedIds = new Set(userAchievements.map(ua => ua.achievementId))
        const newlyUnlocked: any[] = []
        
        // Check each achievement
        for (const achievement of allAchievements) {
          if (unlockedIds.has(achievement.id)) continue
          
          const currentProgress = progress[achievement.key] || 0
          
          if (currentProgress >= achievement.requirement) {
            // Unlock achievement
            const unlocked = await db.userAchievement.create({
              data: {
                userId: ctx.user.id,
                achievementId: achievement.id,
                progress: currentProgress
              },
              include: {
                achievement: true
              }
            })
            
            newlyUnlocked.push(unlocked)
            
            // Create notification
            await db.notification.create({
              data: {
                userId: ctx.user.id,
                type: 'achievement_unlocked',
                relatedId: achievement.id,
                message: `Achievement unlocked: ${achievement.name}!`,
                actionUrl: '/achievements'
              }
            })
          }
        }
        
        if (newlyUnlocked.length > 0) {
          logger.info('Achievements unlocked', logContext, {
            userId: ctx.user.id,
            count: newlyUnlocked.length
          })
        }
        
        return {
          newlyUnlocked
        }
        
      } catch (error) {
        logger.error('Failed to check achievements', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    })
})

/**
 * Calculate user's progress towards all achievements
 */
async function calculateUserProgress(userId: string): Promise<Record<string, number>> {
  const [
    animeList,
    ratings,
    friends,
    genresWatched,
    reviews,
    activities
  ] = await Promise.all([
    db.userAnimeList.count({ where: { userId } }),
    db.userAnimeList.count({ where: { userId, score: { not: null } } }),
    db.friendship.count({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      }
    }),
    db.userAnimeList.findMany({
      where: { userId },
      select: {
        animeId: true
      }
    }),
    db.userAnimeReview.count({ where: { userId } }),
    db.activityFeed.count({ where: { userId } })
  ])
  
  // Count unique genres (simplified - would need to query separately)
  const uniqueGenres = new Set()
  // Simplified: just use count of anime as proxy for genre diversity
  const genreCount = Math.min(genresWatched.length, 20) // Rough estimate
  
  // Count completed anime
  const completed = await db.userAnimeList.count({
    where: { userId, status: 'completed' }
  })
  
  return {
    // Watching achievements
    'first_anime': animeList > 0 ? 1 : 0,
    'watched_10': animeList,
    'watched_50': animeList,
    'watched_100': animeList,
    'watched_500': animeList,
    'completed_10': completed,
    'completed_50': completed,
    'completed_100': completed,
    
    // Rating achievements
    'first_rating': ratings > 0 ? 1 : 0,
    'rated_10': ratings,
    'rated_50': ratings,
    'rated_100': ratings,
    
    // Social achievements
    'first_friend': friends > 0 ? 1 : 0,
    'friends_10': friends,
    'friends_50': friends,
    'popular_100': friends,
    
    // Discovery achievements
    'genre_explorer': genreCount,
    'genre_master': genreCount,
    
    // Review achievements
    'first_review': reviews > 0 ? 1 : 0,
    'reviewer_10': reviews,
    'reviewer_50': reviews,
    
    // Activity achievements
    'active_user': activities,
  }
}

