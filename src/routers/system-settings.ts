import { z } from 'zod'
import { router, protectedProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import { requireAdmin } from '../lib/roles'
import { TRPCError } from '@trpc/server'
import { logger } from '../lib/logger'

export const systemSettingsRouter = router({
  /**
   * Get current system settings
   */
  getSettings: protectedProcedure
    .query(async ({ ctx }) => {
      // Require admin access
      requireAdmin(ctx.user.role)

      // Get or create default settings
      let settings = await db.systemSettings.findFirst()
      
      if (!settings) {
        settings = await db.systemSettings.create({
          data: {}
        })
      }

      return settings
    }),

  /**
   * Update system settings
   */
  updateSettings: protectedProcedure
    .input(z.object({
      siteName: z.string().min(1).max(100).optional(),
      siteDescription: z.string().max(500).optional(),
      maintenanceMode: z.boolean().optional(),
      maintenanceMessage: z.string().max(1000).optional(),
      registrationEnabled: z.boolean().optional(),
      emailVerificationRequired: z.boolean().optional(),
      maxUploadSize: z.number().min(1048576).max(104857600).optional(), // 1MB - 100MB
      rateLimit: z.number().min(10).max(10000).optional(),
      sessionTimeout: z.number().min(3600).max(2592000).optional(), // 1 hour - 30 days
      maxUserListItems: z.number().min(100).max(50000).optional(), // 100 - 50,000
      enableRecommendations: z.boolean().optional(),
      enableSocialFeatures: z.boolean().optional(),
      // App Status Badge
      appStatus: z.string().optional(),
      appStatusTooltip: z.string().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Require admin access
      requireAdmin(ctx.user.role)

      // Get or create default settings
      let settings = await db.systemSettings.findFirst()
      
      const data = {
        siteName: input.siteName,
        siteDescription: input.siteDescription,
        maintenanceMode: input.maintenanceMode,
        maintenanceMessage: input.maintenanceMessage ?? null,
        registrationEnabled: input.registrationEnabled,
        emailVerificationRequired: input.emailVerificationRequired,
        maxUploadSize: input.maxUploadSize,
        rateLimit: input.rateLimit,
        sessionTimeout: input.sessionTimeout,
        maxUserListItems: input.maxUserListItems,
        enableRecommendations: input.enableRecommendations,
        enableSocialFeatures: input.enableSocialFeatures,
      }

      if (!settings) {
        settings = await db.systemSettings.create({ data })
      } else {
        settings = await db.systemSettings.update({
          where: { id: settings.id },
          data: {
            siteName: data.siteName ?? settings.siteName,
            siteDescription: data.siteDescription ?? settings.siteDescription,
            maintenanceMode: data.maintenanceMode ?? settings.maintenanceMode,
            maintenanceMessage: data.maintenanceMessage ?? settings.maintenanceMessage,
            registrationEnabled: data.registrationEnabled ?? settings.registrationEnabled,
            emailVerificationRequired: data.emailVerificationRequired ?? settings.emailVerificationRequired,
            maxUploadSize: data.maxUploadSize ?? settings.maxUploadSize,
            rateLimit: data.rateLimit ?? settings.rateLimit,
            sessionTimeout: data.sessionTimeout ?? settings.sessionTimeout,
            maxUserListItems: data.maxUserListItems ?? settings.maxUserListItems,
            enableRecommendations: data.enableRecommendations ?? settings.enableRecommendations,
            enableSocialFeatures: data.enableSocialFeatures ?? settings.enableSocialFeatures,
          }
        })
      }

      logger.info('System settings updated', { username: ctx.user.username, settings: input })

      return settings
    }),

  /**
   * Reset to default settings
   */
  resetToDefaults: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Require admin access
      requireAdmin(ctx.user.role)

      const settings = await db.systemSettings.findFirst()
      
      if (!settings) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'System settings not found'
        })
      }

      const resetSettings = await db.systemSettings.update({
        where: { id: settings.id },
        data: {
          siteName: "AnimeSenpai",
          siteDescription: "Track, discover, and explore your favorite anime",
          maintenanceMode: false,
          maintenanceMessage: null,
          registrationEnabled: true,
          emailVerificationRequired: true,
          maxUploadSize: 5242880, // 5MB
          rateLimit: 100,
          sessionTimeout: 86400, // 24 hours
          maxUserListItems: 5000,
          enableRecommendations: true,
          enableSocialFeatures: true
        }
      })

      logger.info('System settings reset to defaults', { username: ctx.user.username })

      return resetSettings
    })
})

