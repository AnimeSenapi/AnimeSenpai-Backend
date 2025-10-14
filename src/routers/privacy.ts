/**
 * Enhanced Privacy Settings Router - Phase 2 Social Features
 * 
 * Granular privacy controls for:
 * - Activity visibility
 * - List visibility
 * - Review visibility
 * - Friend list visibility
 */

import { z } from 'zod'
import { router, protectedProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import { logger, extractLogContext } from '../lib/logger'

export const privacyRouter = router({
  /**
   * Get user's privacy settings
   */
  getSettings: protectedProcedure
    .query(async ({ ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        let settings = await db.userPrivacySettings.findUnique({
          where: { userId: ctx.user.id }
        })
        
        // Create default settings if none exist
        if (!settings) {
          settings = await db.userPrivacySettings.create({
            data: {
              userId: ctx.user.id,
              profileVisibility: 'public',
              showAnimeList: true,
              showReviews: true,
              showActivity: true,
              showFriends: true
            }
          })
        }
        
        return {
          settings
        }
        
      } catch (error) {
        logger.error('Failed to fetch privacy settings', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Update privacy settings
   */
  updateSettings: protectedProcedure
    .input(z.object({
      profileVisibility: z.enum(['public', 'friends', 'private']).optional(),
      showAnimeList: z.boolean().optional(),
      showReviews: z.boolean().optional(),
      showActivity: z.boolean().optional(),
      showFriends: z.boolean().optional(),
      allowMessages: z.boolean().optional(),
      allowFriendRequests: z.boolean().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        // Get or create settings
        let settings = await db.userPrivacySettings.findUnique({
          where: { userId: ctx.user.id }
        })
        
        if (!settings) {
          settings = await db.userPrivacySettings.create({
            data: {
              userId: ctx.user.id,
              profileVisibility: input.profileVisibility || 'public',
              showAnimeList: input.showAnimeList ?? true,
              showReviews: input.showReviews ?? true,
              showActivity: input.showActivity ?? true,
              showFriends: input.showFriends ?? true,
              allowMessages: input.allowMessages ?? true,
              allowFriendRequests: input.allowFriendRequests ?? true
            }
          })
        } else {
          // Update existing settings
          settings = await db.userPrivacySettings.update({
            where: { userId: ctx.user.id },
            data: {
              ...(input.profileVisibility && { profileVisibility: input.profileVisibility }),
              ...(input.showAnimeList !== undefined && { showAnimeList: input.showAnimeList }),
              ...(input.showReviews !== undefined && { showReviews: input.showReviews }),
              ...(input.showActivity !== undefined && { showActivity: input.showActivity }),
              ...(input.showFriends !== undefined && { showFriends: input.showFriends }),
              ...(input.allowMessages !== undefined && { allowMessages: input.allowMessages }),
              ...(input.allowFriendRequests !== undefined && { allowFriendRequests: input.allowFriendRequests })
            }
          })
        }
        
        logger.info('Privacy settings updated', logContext, {
          userId: ctx.user.id,
          changes: Object.keys(input)
        })
        
        return {
          success: true,
          settings
        }
        
      } catch (error) {
        logger.error('Failed to update privacy settings', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Check if user can view another user's content
   */
  canView: protectedProcedure
    .input(z.object({
      targetUserId: z.string(),
      contentType: z.enum(['profile', 'animeList', 'reviews', 'activity', 'friends'])
    }))
    .query(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        // Can always view own content
        if (ctx.user.id === input.targetUserId) {
          return { canView: true }
        }
        
        // Get target user's privacy settings
        const settings = await db.userPrivacySettings.findUnique({
          where: { userId: input.targetUserId }
        })
        
        // Default to public if no settings
        if (!settings) {
          return { canView: true }
        }
        
        // Check profile visibility first
        if (input.contentType === 'profile') {
          if (settings.profileVisibility === 'private') {
            return { canView: false }
          }
          if (settings.profileVisibility === 'friends') {
            // Check if users are friends
            const friendship = await db.friendship.findFirst({
              where: {
                OR: [
                  { user1Id: ctx.user.id, user2Id: input.targetUserId, status: 'accepted' },
                  { user1Id: input.targetUserId, user2Id: ctx.user.id, status: 'accepted' }
                ]
              }
            })
            return { canView: !!friendship }
          }
          return { canView: true } // public
        }
        
        // For other content types, check specific settings
        let settingKey: keyof typeof settings
        switch (input.contentType) {
          case 'animeList':
            settingKey = 'showAnimeList'
            break
          case 'reviews':
            settingKey = 'showReviews'
            break
          case 'activity':
            settingKey = 'showActivity'
            break
          case 'friends':
            settingKey = 'showFriends'
            break
          default:
            return { canView: false }
        }
        
        // If content type is hidden, check if they're friends
        if (!settings[settingKey]) {
          const friendship = await db.friendship.findFirst({
            where: {
              OR: [
                { user1Id: ctx.user.id, user2Id: input.targetUserId, status: 'accepted' },
                { user1Id: input.targetUserId, user2Id: ctx.user.id, status: 'accepted' }
              ]
            }
          })
          return { canView: !!friendship }
        }
        
        return { canView: true }
        
      } catch (error) {
        logger.error('Failed to check view permission', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Bulk privacy update (quick presets)
   */
  applyPreset: protectedProcedure
    .input(z.object({
      preset: z.enum(['public', 'friends_only', 'private'])
    }))
    .mutation(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        let settingsData: any = {}
        
        switch (input.preset) {
          case 'public':
            settingsData = {
              profileVisibility: 'public',
              showAnimeList: true,
              showReviews: true,
              showActivity: true,
              showFriends: true,
              allowMessages: true,
              allowFriendRequests: true
            }
            break
          case 'friends_only':
            settingsData = {
              profileVisibility: 'friends',
              showAnimeList: true,
              showReviews: true,
              showActivity: true,
              showFriends: true,
              allowMessages: true,
              allowFriendRequests: true
            }
            break
          case 'private':
            settingsData = {
              profileVisibility: 'private',
              showAnimeList: false,
              showReviews: false,
              showActivity: false,
              showFriends: false,
              allowMessages: false,
              allowFriendRequests: false
            }
            break
        }
        
        // Upsert settings
        const settings = await db.userPrivacySettings.upsert({
          where: { userId: ctx.user.id },
          create: {
            userId: ctx.user.id,
            ...settingsData
          },
          update: settingsData
        })
        
        logger.info('Privacy preset applied', logContext, {
          userId: ctx.user.id,
          preset: input.preset
        })
        
        return {
          success: true,
          settings
        }
        
      } catch (error) {
        logger.error('Failed to apply privacy preset', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    })
})

