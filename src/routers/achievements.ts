/**
 * Achievements Router - Tier-based Achievement System
 * 
 * Achievement/badge system for user milestones with tiered progression
 */

import { z } from 'zod'
import { router, protectedProcedure, publicProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import { logger, extractLogContext } from '../lib/logger'

export const achievementsRouter = router({
  /**
   * Get all achievement types with their tiers
   */
  getAll: publicProcedure
    .query(async () => {
      try {
        const achievements = await db.achievement.findMany({
          include: {
            tiers: {
              orderBy: { createdAt: 'asc' }
            }
          },
          orderBy: [
            { category: 'asc' },
            { baseName: 'asc' }
          ]
        })
        
        return {
          achievements
        }
        
      } catch (error) {
        logger.error('Failed to fetch achievements', error as Error)
        throw error
      }
    }),

  /**
   * Get user's achievements with tier progress
   */
  getMyAchievements: protectedProcedure
    .query(async ({ ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        const userAchievements = await db.userAchievement.findMany({
          where: { userId: ctx.user.id },
          include: {
            achievement: true,
            tier: true
          },
          orderBy: { unlockedAt: 'desc' }
        })
        
        const allAchievements = await db.achievement.findMany({
          include: {
            tiers: {
              orderBy: { createdAt: 'asc' }
            }
          }
        })
        
        // Calculate progress for each achievement type
        const progress = await calculateUserProgress(ctx.user.id)
        
        const achievementsWithProgress = allAchievements.map(achievement => {
          const unlockedTiers = userAchievements
            .filter(ua => ua.achievementId === achievement.id)
            .map(ua => ua.tier.tier)
            .sort((a, b) => a - b)
          
          const currentProgress = progress[achievement.key] || 0
          const nextTier = achievement.tiers.find(tier => 
            !unlockedTiers.includes(tier.tier) && currentProgress >= tier.requirement
          )
          
          const highestUnlockedTier = unlockedTiers.length > 0 ? Math.max(...unlockedTiers) : 0
          const nextTierRequirement = achievement.tiers.find(tier => tier.tier === highestUnlockedTier + 1)?.requirement || 0
          
          return {
            ...achievement,
            unlockedTiers,
            currentProgress,
            highestUnlockedTier,
            nextTierRequirement,
            nextTier,
            progressPercentage: nextTierRequirement > 0 
              ? Math.min(100, Math.floor(currentProgress / nextTierRequirement * 100))
              : 100
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
        
        const totalPoints = userAchievements.reduce((sum, ua) => sum + ua.tier.points, 0)
        const totalTiersUnlocked = userAchievements.length
        
        return {
          achievements: achievementsWithProgress,
          byCategory,
          unlockedCount: totalTiersUnlocked,
          totalCount: allAchievements.reduce((sum, a) => sum + a.tiers.length, 0),
          totalPoints
        }
        
      } catch (error) {
        logger.error('Failed to fetch user achievements', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Check and unlock achievement tiers for a user
   * Called automatically after user actions
   */
  checkAndUnlock: protectedProcedure
    .mutation(async ({ ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        const progress = await calculateUserProgress(ctx.user.id)
        const allAchievements = await db.achievement.findMany({
          include: {
            tiers: {
              orderBy: { createdAt: 'asc' }
            }
          }
        })
        
        const userAchievements = await db.userAchievement.findMany({
          where: { userId: ctx.user.id },
          select: { tierId: true }
        })
        
        const unlockedTierIds = new Set(userAchievements.map(ua => ua.tierId))
        const newlyUnlocked: any[] = []
        
        // Check each achievement type
        for (const achievement of allAchievements) {
          const currentProgress = progress[achievement.key] || 0
          
          // Find tiers that can be unlocked
          const unlockableTiers = achievement.tiers.filter(tier => 
            !unlockedTierIds.has(tier.id) && currentProgress >= tier.requirement
          )
          
          // Unlock each tier
          for (const tier of unlockableTiers) {
            const unlocked = await db.userAchievement.create({
              data: {
                userId: ctx.user.id,
                achievementId: achievement.id,
                tierId: tier.id,
                progress: currentProgress
              },
              include: {
                achievement: true,
                tier: true
              }
            })
            
            newlyUnlocked.push(unlocked)
            
            // Create notification
            await db.notification.create({
              data: {
                userId: ctx.user.id,
                type: 'achievement_unlocked',
                relatedId: tier.id,
                message: `Achievement unlocked: ${tier.name}!`,
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
          newlyUnlocked,
          count: newlyUnlocked.length
        }
        
      } catch (error) {
        logger.error('Failed to check and unlock achievements', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Get achievement statistics
   */
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        const [
          totalAchievements,
          totalTiers,
          userAchievements,
          categoryStats
        ] = await Promise.all([
          db.achievement.count(),
          db.achievementTier.count(),
          db.userAchievement.findMany({
            where: { userId: ctx.user.id },
            include: {
              tier: true
            }
          }),
          db.achievement.groupBy({
            by: ['category'],
            _count: { id: true }
          })
        ])
        
        const totalPoints = userAchievements.reduce((sum, ua) => sum + ua.tier.points, 0)
        const userUnlockedTiers = userAchievements.length
        
        return {
          totalAchievements,
          totalTiers,
          unlockedTiers: userUnlockedTiers,
          totalPoints,
          categoryStats
        }
        
      } catch (error) {
        logger.error('Failed to fetch achievement stats', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    })
})

/**
 * Calculate user progress for all achievement types
 */
async function calculateUserProgress(userId: string): Promise<Record<string, number>> {
  const [
    animeList,
    ratings,
    completed,
    reviews,
    followers,
    following,
    mutualFollows,
    perfectRatings,
    userProfile
  ] = await Promise.all([
    // Anime list stats
    db.userAnimeList.count({ where: { userId } }),
    db.userAnimeList.count({ where: { userId, score: { not: null } } }),
    db.userAnimeList.count({ where: { userId, status: 'completed' } }),
    
    // Review stats
    db.userAnimeReview.count({ where: { userId } }),
    
    // Social stats
    db.friendship.count({
      where: { user2Id: userId }
    }),
    db.friendship.count({
      where: { user1Id: userId }
    }),
    db.friendship.count({
      where: {
        AND: [
          { user1Id: userId },
          { user2: { friendships1: { some: { user1Id: userId } } } }
        ]
      }
    }),
    
    // Perfect ratings
    db.userAnimeList.count({
      where: { userId, score: 10 }
    }),
    
    // Profile completion
    db.user.findUnique({
      where: { id: userId },
      select: {
        avatar: true,
        bio: true,
        createdAt: true
      }
    })
  ])
  
  // Get unique genres from user's anime
  const listItems = await db.userAnimeList.findMany({
    where: { userId },
    select: {
      animeId: true
    }
  })
  
  let genreCount = 0
  if (listItems.length > 0) {
    const animeIds = listItems.map(item => item.animeId)
    const animes = await db.anime.findMany({
      where: { id: { in: animeIds } },
      select: {
        genres: {
          select: {
            genre: {
              select: {
                slug: true
              }
            }
          }
        }
      }
    })
  
  // Calculate unique genres
    const uniqueGenres = new Set<string>()
    animes.forEach(anime => {
      anime.genres.forEach(g => {
        uniqueGenres.add(g.genre.slug)
    })
  })
    genreCount = uniqueGenres.size
  }
  
  // Check if user is early adopter (joined within first month of launch)
  const launchDate = new Date('2025-01-01')
  const oneMonthAfterLaunch = new Date(launchDate)
  oneMonthAfterLaunch.setMonth(oneMonthAfterLaunch.getMonth() + 1)
  const isEarlyAdopter = userProfile?.createdAt && userProfile.createdAt <= oneMonthAfterLaunch ? 1 : 0
  
  // Check profile completion
  const hasAvatar = !!userProfile?.avatar
  const hasBio = !!userProfile?.bio && userProfile.bio.trim().length > 0
  const isProfileComplete = hasAvatar && hasBio ? 1 : 0
  
  return {
    // Watching achievements - using new key names from gamified achievements
    'anime_completed': completed,
    'anime_watched': animeList,
    
    // Rating achievements
    'anime_rated': ratings,
    'perfect_ratings': perfectRatings,
    'reviews_written': reviews,
    
    // Social achievements
    'followers_gained': followers,
    'following_count': following,
    'mutual_friends': mutualFollows,
    
    // Discovery achievements
    'genres_explored': genreCount,
    
    // Special achievements
    'early_adopter': isEarlyAdopter,
    'profile_complete': isProfileComplete,
  }
}
