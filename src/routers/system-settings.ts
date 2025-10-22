import { z } from 'zod'
import { router, protectedProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import { requireAdmin } from '../lib/roles'
import { TRPCError } from '@trpc/server'

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
      enableSocialFeatures: z.boolean().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      // Require admin access
      requireAdmin(ctx.user.role)

      // Get or create default settings
      let settings = await db.systemSettings.findFirst()
      
      if (!settings) {
        settings = await db.systemSettings.create({
          data: input
        })
      } else {
        settings = await db.systemSettings.update({
          where: { id: settings.id },
          data: input
        })
      }

      console.log(`[ADMIN] System settings updated by ${ctx.user.username}:`, input)

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

      console.log(`[ADMIN] System settings reset to defaults by ${ctx.user.username}`)

      return resetSettings
    })
})

