import { z } from 'zod'
import { router, protectedProcedure } from '../lib/trpc.js'
import { db } from '../lib/db.js'
import {
  UserRole,
  requireAdmin,
  promoteToTester,
  demoteToUser,
  promoteToAdmin,
  setFeatureFlag,
  clearFeatureFlagCache,
} from '../lib/roles.js'
import { logSecurityEvent, sendPasswordReset } from '../lib/auth.js'
import { secureAdminOperation, checkAdminRateLimit } from '../lib/admin-security.js'
import { emailService } from '../lib/email.js'
import { jobQueue } from '../lib/background-jobs.js'
import { getGroupingStatistics, getTopPatterns } from '../lib/grouping-learning.js'

export const adminRouter = router({
  // Get all users with their roles
  getAllUsers: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
      role: z.enum(['user', 'tester', 'admin', 'owner']).optional(),
    }).optional())
    .query(async ({ input = {}, ctx }) => {
      // Only admins can view all users
      requireAdmin(ctx.user.role)

      const { page = 1, limit = 20, role } = input
      const skip = (page - 1) * limit

      const where: any = {}
      if (role) {
        // Get the role ID for the filter
        const roleRecord = await db.role.findFirst({ where: { name: role } })
        if (roleRecord) {
          where.primaryRoleId = roleRecord.id
        }
      }

      const [users, total] = await Promise.all([
        db.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            username: true,
            primaryRole: {
              select: {
                name: true
              }
            },
            emailVerified: true,
            createdAt: true,
            lastLoginAt: true,
          }
        }),
        db.user.count({ where })
      ])

      return {
        users: users.map((user: typeof users[0]) => ({
          ...user,
          name: null,
          role: user.primaryRole?.name || 'user'
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    }),

  // Promote user to tester
  promoteToTester: protectedProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Only admins can promote users
      requireAdmin(ctx.user.role)

      const user = await promoteToTester(input.userId)

      // Log security event
      await logSecurityEvent(
        ctx.user.id,
        'user_role_changed',
        { targetUserId: input.userId, newRole: 'tester', changedBy: ctx.user.email },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return {
        success: true,
        user
      }
    }),

  // Demote tester to regular user
  demoteToUser: protectedProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Only admins can demote users
      requireAdmin(ctx.user.role)

      const user = await demoteToUser(input.userId)

      // Log security event
      await logSecurityEvent(
        ctx.user.id,
        'user_role_changed',
        { targetUserId: input.userId, newRole: 'user', changedBy: ctx.user.email },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return {
        success: true,
        user
      }
    }),

  // Promote user to admin
  promoteToAdmin: protectedProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Only admins can promote to admin
      requireAdmin(ctx.user.role)

      const user = await promoteToAdmin(input.userId)

      // Log security event
      await logSecurityEvent(
        ctx.user.id,
        'user_role_changed',
        { targetUserId: input.userId, newRole: 'admin', changedBy: ctx.user.email },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return {
        success: true,
        user
      }
    }),

  // Get all feature flags
  getFeatureFlags: protectedProcedure
    .query(async ({ ctx }) => {
      // Only admins can view feature flags
      requireAdmin(ctx.user.role)

      const flags = await db.featureFlag.findMany({
        orderBy: { createdAt: 'desc' }
      })

      return flags
    }),

  // Create or update feature flag
  setFeatureFlag: protectedProcedure
    .input(z.object({
      key: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
      name: z.string().min(3).max(100),
      description: z.string().optional(),
      enabled: z.boolean().default(false),
      roles: z.array(z.enum(['user', 'tester', 'admin'])).default([]),
    }))
    .mutation(async ({ input, ctx }) => {
      // Only admins can manage feature flags
      requireAdmin(ctx.user.role)

      const flag = await setFeatureFlag(input.key, {
        name: input.name,
        ...(input.description !== undefined && { description: input.description }),
        enabled: input.enabled,
        roles: input.roles,
      })

      // Log security event
      await logSecurityEvent(
        ctx.user.id,
        'feature_flag_updated',
        { flagKey: input.key, enabled: input.enabled, roles: input.roles },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return flag
    }),

  // Delete feature flag
  deleteFeatureFlag: protectedProcedure
    .input(z.object({
      key: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Only admins can delete feature flags
      requireAdmin(ctx.user.role)

      await db.featureFlag.delete({
        where: { key: input.key }
      })

      // Clear cache
      clearFeatureFlagCache(input.key)

      // Log security event
      await logSecurityEvent(
        ctx.user.id,
        'feature_flag_deleted',
        { flagKey: input.key },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return { success: true }
    }),

  // Toggle feature flag on/off
  toggleFeatureFlag: protectedProcedure
    .input(z.object({
      key: z.string(),
      enabled: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Only admins can toggle features
      requireAdmin(ctx.user.role)

      const flag = await db.featureFlag.update({
        where: { key: input.key },
        data: { enabled: input.enabled }
      })

      // Clear cache
      clearFeatureFlagCache(input.key)

      // Log security event
      await logSecurityEvent(
        ctx.user.id,
        'feature_flag_toggled',
        { flagKey: input.key, enabled: input.enabled },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return flag
    }),

  // Get system statistics
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      // Only admins can view stats
      requireAdmin(ctx.user.role)

      // Get role IDs
      const testerRole = await db.role.findFirst({ where: { name: UserRole.TESTER } })
      const adminRole = await db.role.findFirst({ where: { name: UserRole.ADMIN } })

      const [
        totalUsers, 
        totalTesters, 
        totalAdmins, 
        totalAnime, 
        totalFlags,
        recentUsers,
        totalUserAnimeListEntries
      ] = await Promise.all([
        db.user.count(),
        testerRole ? db.user.count({ where: { primaryRoleId: testerRole.id } }) : 0,
        adminRole ? db.user.count({ where: { primaryRoleId: adminRole.id } }) : 0,
        db.anime.count(),
        db.featureFlag.count(),
        db.user.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            }
          }
        }),
        db.userAnimeList.count(),
      ])

      // Get sync job information
      const jobStats = jobQueue.getStats()
      const animeDataSyncJob = jobStats.jobs.find(job => job.name === 'anime-data-sync')
      const calendarSyncJob = jobStats.jobs.find(job => job.name === 'calendar-sync')
      const groupingLearningJob = jobStats.jobs.find(job => job.name === 'grouping-learning')

      // Get grouping statistics
      const groupingStats = await getGroupingStatistics()
      const topPatterns = await getTopPatterns(10)

      return {
        users: {
          total: totalUsers,
          regular: totalUsers - totalTesters - totalAdmins,
          testers: totalTesters,
          admins: totalAdmins,
          recentSignups: recentUsers,
        },
        content: {
          anime: totalAnime,
          listEntries: totalUserAnimeListEntries,
        },
        features: {
          flags: totalFlags,
        },
        sync: {
          animeDataSync: {
            scheduled: !!animeDataSyncJob?.scheduled,
            lastRun: animeDataSyncJob?.lastRun || 'N/A',
            interval: animeDataSyncJob?.interval ? Math.round(animeDataSyncJob.interval / (60 * 60 * 1000)) : null, // Convert to hours
            isRunning: animeDataSyncJob?.isRunning || false,
            runningDuration: animeDataSyncJob?.runningDuration,
            estimatedTimeRemaining: animeDataSyncJob?.estimatedTimeRemaining,
            nextRun: animeDataSyncJob?.lastRun && animeDataSyncJob?.interval
              ? new Date(new Date(animeDataSyncJob.lastRun).getTime() + animeDataSyncJob.interval).toISOString()
              : null,
          },
          calendarSync: {
            scheduled: !!calendarSyncJob?.scheduled,
            lastRun: calendarSyncJob?.lastRun || 'N/A',
            interval: calendarSyncJob?.interval ? Math.round(calendarSyncJob.interval / (60 * 60 * 1000)) : null, // Convert to hours
            isRunning: calendarSyncJob?.isRunning || false,
            runningDuration: calendarSyncJob?.runningDuration,
            estimatedTimeRemaining: calendarSyncJob?.estimatedTimeRemaining,
            nextRun: calendarSyncJob?.lastRun && calendarSyncJob?.interval
              ? new Date(new Date(calendarSyncJob.lastRun).getTime() + calendarSyncJob.interval).toISOString()
              : null,
          },
        },
        grouping: {
          totalPatterns: groupingStats.totalPatterns,
          averageConfidence: groupingStats.averageConfidence,
          highConfidencePatterns: groupingStats.highConfidencePatterns,
          recentFeedback: groupingStats.recentFeedback,
          successRate: groupingStats.successRate,
          topPatterns: topPatterns.map(p => ({
            patternType: p.patternType,
            pattern: p.pattern,
            confidence: p.confidence,
            successCount: p.successCount,
            failureCount: p.failureCount,
            lastUsed: p.lastUsed,
          })),
          learningJob: {
            scheduled: !!groupingLearningJob?.scheduled,
            lastRun: groupingLearningJob?.lastRun || 'N/A',
            interval: groupingLearningJob?.interval ? Math.round(groupingLearningJob.interval / (60 * 60 * 1000)) : null,
            isRunning: groupingLearningJob?.isRunning || false,
            runningDuration: groupingLearningJob?.runningDuration,
            estimatedTimeRemaining: groupingLearningJob?.estimatedTimeRemaining,
            nextRun: groupingLearningJob?.lastRun && groupingLearningJob?.interval
              ? new Date(new Date(groupingLearningJob.lastRun).getTime() + groupingLearningJob.interval).toISOString()
              : null,
          },
        }
      }
    }),

  // Get user details by ID
  getUserDetails: protectedProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)

      const user = await db.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          email: true,
          username: true,
          primaryRole: {
            select: {
              name: true
            }
          },
          emailVerified: true,
          createdAt: true,
          lastLoginAt: true,
          avatar: true,
        }
      })

      if (!user) {
        throw new Error('User not found')
      }

      const { primaryRole, ...rest } = user

      return {
        ...rest,
        name: null,
        role: primaryRole?.name || 'user'
      }
    }),

  // Update user role
  updateUserRole: protectedProcedure
    .input(z.object({
      userId: z.string(),
      role: z.enum(['user', 'moderator', 'admin', 'owner']),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)
      checkAdminRateLimit(ctx.user.id)

      // Prevent demoting yourself
      if (input.userId === ctx.user.id) {
        throw new Error('Cannot change your own role')
      }

      return await secureAdminOperation(
        ctx.user.id,
        'update_role',
        async () => {
          const user = await db.user.update({
            where: { id: input.userId },
            data: { role: input.role }
          })

          // Log security event
          await logSecurityEvent(
            ctx.user.id,
            'user_role_changed',
            { targetUserId: input.userId, newRole: input.role, changedBy: ctx.user.email },
            ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
            ctx.req?.headers.get('user-agent') || undefined
          )

          return { success: true, user }
        },
        { userId: input.userId, newRole: input.role },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined
      )
    }),

  // Ban/Suspend user (soft delete)
  banUser: protectedProcedure
    .input(z.object({
      userId: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)

      // Prevent banning yourself
      if (input.userId === ctx.user.id) {
        throw new Error('Cannot ban yourself')
      }

      // For now, we'll set a field or handle it via role
      // You might want to add a 'banned' or 'suspended' field to your schema
      await db.user.update({
        where: { id: input.userId },
        data: { 
          // Add banned field if you have it in schema
          // For now, we can log it
          role: 'user' // Demote to user as a temporary measure
        }
      })

      // Log security event
      await logSecurityEvent(
        ctx.user.id,
        'user_banned',
        { targetUserId: input.userId, reason: input.reason, bannedBy: ctx.user.email },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return { success: true }
    }),

  // Delete user account
  deleteUser: protectedProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)
      checkAdminRateLimit(ctx.user.id)

      // Prevent deleting yourself
      if (input.userId === ctx.user.id) {
        throw new Error('Cannot delete your own account')
      }

      return await secureAdminOperation(
        ctx.user.id,
        'delete_user',
        async () => {
          // Delete user and all related data
          await db.user.delete({
            where: { id: input.userId }
          })

          // Log security event
          await logSecurityEvent(
            ctx.user.id,
            'user_deleted',
            { targetUserId: input.userId, deletedBy: ctx.user.email },
            ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
            ctx.req?.headers.get('user-agent') || undefined
          )

          return { success: true }
        },
        { userId: input.userId },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined
      )
    }),

  // Search users
  searchUsers: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)

      const users = await db.user.findMany({
        where: {
          OR: [
            { email: { contains: input.query, mode: 'insensitive' } },
            { username: { contains: input.query, mode: 'insensitive' } },
          ]
        },
        take: input.limit,
        select: {
          id: true,
          email: true,
          username: true,
          emailVerified: true,
          createdAt: true,
          lastLoginAt: true,
          primaryRole: {
            select: {
              name: true
            }
          },
        }
      })

      return users.map((user: any) => ({
        ...user,
        name: null,
        role: user.primaryRole?.name || 'user'
      }))
    }),

  // Delete anime
  updateAnime: protectedProcedure
    .input(z.object({
      animeId: z.string(),
      title: z.string().optional(),
      titleEnglish: z.string().optional(),
      titleJapanese: z.string().optional(),
      synopsis: z.string().optional(),
      year: z.number().optional(),
      episodes: z.number().optional(),
      status: z.string().optional(),
      type: z.string().optional(),
      rating: z.string().optional(),
      coverImage: z.string().optional(),
      bannerImage: z.string().optional(),
      trailer: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)
      checkAdminRateLimit(ctx.user.id)

      return await secureAdminOperation(
        ctx.user.id,
        'update_anime',
        async () => {
          const { animeId, ...updateData } = input

          // Get current anime for logging
          const currentAnime = await db.anime.findUnique({
            where: { id: animeId },
            select: { title: true, id: true }
          })

          if (!currentAnime) {
            throw new Error('Anime not found')
          }

          // Update anime
          const updated = await db.anime.update({
            where: { id: animeId },
            data: updateData,
          })

          // Log security event
          await logSecurityEvent(
            ctx.user.id,
            'anime_updated',
            {
              animeId,
              animeTitle: currentAnime.title,
              updatedFields: Object.keys(updateData),
            }
          )

          return {
            success: true,
            anime: updated,
          }
        }
      )
    }),

  deleteAnime: protectedProcedure
    .input(z.object({
      animeId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)
      checkAdminRateLimit(ctx.user.id)

      return await secureAdminOperation(
        ctx.user.id,
        'delete_anime',
        async () => {
          // Get anime details for logging
          const anime = await db.anime.findUnique({
            where: { id: input.animeId },
            select: { title: true, id: true }
          })

          if (!anime) {
            throw new Error('Anime not found')
          }

          // Delete anime (cascade will handle related data)
          await db.anime.delete({
            where: { id: input.animeId }
          })

          // Log security event
          await logSecurityEvent(
            ctx.user.id,
            'anime_deleted',
            { animeId: input.animeId, animeTitle: anime.title, deletedBy: ctx.user.email },
            ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
            ctx.req?.headers.get('user-agent') || undefined
          )

          return { success: true, title: anime.title }
        },
        { animeId: input.animeId },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined
      )
    }),

  // Get system settings
  getSettings: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx.user.role)

      // Get or create system settings using Prisma model
      let settings = await db.systemSettings.findFirst()

      if (!settings) {
        // Create default settings if they don't exist
        settings = await db.systemSettings.create({
          data: {
            siteName: 'AnimeSenpai',
            siteDescription: 'Track, discover, and explore your favorite anime',
            maintenanceMode: false,
            registrationEnabled: true,
            emailVerificationRequired: true,
            maxUploadSize: 5242880,
            rateLimit: 100,
            sessionTimeout: 86400,
            maxUserListItems: 5000,
            enableRecommendations: true,
            enableSocialFeatures: true,
          }
        })
      }

      // Return in the expected format
      return {
        general: {
          siteName: settings.siteName,
          siteDescription: settings.siteDescription,
          maintenanceMode: settings.maintenanceMode,
          allowRegistration: settings.registrationEnabled,
          requireEmailVerification: settings.emailVerificationRequired,
        },
        features: {
          enableRecommendations: settings.enableRecommendations,
          enableSocialFeatures: settings.enableSocialFeatures,
          enableAchievements: true, // Not in schema yet
          enableComments: true, // Not in schema yet
        },
        security: {
          sessionTimeout: settings.sessionTimeout / 3600, // Convert seconds to hours
          maxLoginAttempts: 5, // Not in schema yet
          requireStrongPasswords: true, // Not in schema yet
          enableTwoFactor: false, // Not in schema yet
        },
        notifications: {
          emailNotifications: true, // Not in schema yet
          newUserAlert: true, // Not in schema yet
          errorReporting: true, // Not in schema yet
        },
        analytics: {
          googleAnalyticsId: '', // Not in schema yet
          enableTracking: false, // Not in schema yet
        },
        limits: {
          maxUserListItems: settings.maxUserListItems,
          maxUploadSize: settings.maxUploadSize,
          rateLimit: settings.rateLimit,
        }
      }
    }),

  // Save system settings
  saveSettings: protectedProcedure
    .input(z.object({
      general: z.object({
        siteName: z.string(),
        siteDescription: z.string(),
        maintenanceMode: z.boolean(),
        allowRegistration: z.boolean(),
        requireEmailVerification: z.boolean(),
      }).optional(),
      features: z.object({
        enableRecommendations: z.boolean(),
        enableSocialFeatures: z.boolean(),
        enableAchievements: z.boolean(),
        enableComments: z.boolean(),
      }).optional(),
      security: z.object({
        sessionTimeout: z.number(),
        maxLoginAttempts: z.number(),
        requireStrongPasswords: z.boolean(),
        enableTwoFactor: z.boolean(),
      }).optional(),
      notifications: z.object({
        emailNotifications: z.boolean(),
        newUserAlert: z.boolean(),
        errorReporting: z.boolean(),
      }).optional(),
      analytics: z.object({
        googleAnalyticsId: z.string(),
        enableTracking: z.boolean(),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)
      checkAdminRateLimit(ctx.user.id)

      return await secureAdminOperation(
        ctx.user.id,
        'update_settings',
        async () => {
          // Get or create settings
          let settings = await db.systemSettings.findFirst()

          const updateData: any = {}

          // Map input to schema fields
          if (input.general) {
            if (input.general.siteName) updateData.siteName = input.general.siteName
            if (input.general.siteDescription) updateData.siteDescription = input.general.siteDescription
            if (input.general.maintenanceMode !== undefined) updateData.maintenanceMode = input.general.maintenanceMode
            if (input.general.allowRegistration !== undefined) updateData.registrationEnabled = input.general.allowRegistration
            if (input.general.requireEmailVerification !== undefined) updateData.emailVerificationRequired = input.general.requireEmailVerification
          }

          if (input.features) {
            if (input.features.enableRecommendations !== undefined) updateData.enableRecommendations = input.features.enableRecommendations
            if (input.features.enableSocialFeatures !== undefined) updateData.enableSocialFeatures = input.features.enableSocialFeatures
          }

          if (input.security && input.security.sessionTimeout) {
            updateData.sessionTimeout = input.security.sessionTimeout * 3600 // Convert hours to seconds
          }

          // Upsert settings
          let updatedSettings
          if (settings) {
            updatedSettings = await db.systemSettings.update({
              where: { id: settings.id },
              data: updateData
            })
          } else {
            updatedSettings = await db.systemSettings.create({
              data: {
                ...updateData,
                siteName: updateData.siteName || 'AnimeSenpai',
                siteDescription: updateData.siteDescription || 'Track, discover, and explore your favorite anime'
              }
            })
          }

          // Log security event
          await logSecurityEvent(
            ctx.user.id,
            'settings_updated',
            { updatedBy: ctx.user.email, sections: Object.keys(input) },
            ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
            ctx.req?.headers.get('user-agent') || undefined
          )

          return { success: true, settings: updatedSettings }
        },
        { sections: Object.keys(input) },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined
      )
    }),

  // Admin-initiated password reset email
  sendPasswordResetEmail: protectedProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)
      checkAdminRateLimit(ctx.user.id)

      return await secureAdminOperation(
        ctx.user.id,
        'admin_send_password_reset',
        async () => {
          const user = await db.user.findUnique({
            where: { id: input.userId },
            select: { id: true, email: true, username: true }
          })

          if (!user) {
            throw new Error('User not found')
          }

          // Send password reset email
          const sent = await sendPasswordReset(user.email)

          // Log security event
          await logSecurityEvent(
            ctx.user.id,
            'admin_password_reset_sent',
            { targetUserId: input.userId, targetEmail: user.email, sentBy: ctx.user.email },
            ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
            ctx.req?.headers.get('user-agent') || undefined
          )

          return { success: sent }
        },
        { userId: input.userId },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined
      )
    }),

  // Toggle email verification status
  toggleEmailVerification: protectedProcedure
    .input(z.object({
      userId: z.string(),
      verified: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)
      checkAdminRateLimit(ctx.user.id)

      return await secureAdminOperation(
        ctx.user.id,
        'toggle_email_verification',
        async () => {
          const user = await db.user.update({
            where: { id: input.userId },
            data: { emailVerified: input.verified },
            select: { id: true, email: true, emailVerified: true }
          })

          // Log security event
          await logSecurityEvent(
            ctx.user.id,
            'email_verification_toggled',
            { 
              targetUserId: input.userId, 
              targetEmail: user.email, 
              verified: input.verified,
              changedBy: ctx.user.email 
            },
            ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
            ctx.req?.headers.get('user-agent') || undefined
          )

          return { success: true, user }
        },
        { userId: input.userId, verified: input.verified },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined
      )
    }),

  // Update user details
  updateUserDetails: protectedProcedure
    .input(z.object({
      userId: z.string(),
      username: z.string().optional(),
      email: z.string().email().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)
      checkAdminRateLimit(ctx.user.id)

      return await secureAdminOperation(
        ctx.user.id,
        'update_user_details',
        async () => {
          const { userId, ...updateData } = input

          // Remove undefined values and type for Prisma update
          const cleanUpdateData: {
            username?: string
            email?: string
            emailVerified?: boolean
          } = Object.fromEntries(
            Object.entries(updateData).filter(([_, v]) => v !== undefined)
          ) as {
            username?: string
            email?: string
          }

          // Check if email is being changed and if it's already in use
          if (cleanUpdateData.email) {
            const existingUser = await db.user.findUnique({
              where: { email: cleanUpdateData.email }
            })

            if (existingUser && existingUser.id !== userId) {
              throw new Error('Email already in use by another user')
            }

            // If email is changed, mark as unverified
            cleanUpdateData.emailVerified = false
          }

          // Check if username is being changed and if it's already in use
          if (cleanUpdateData.username) {
            const existingUser = await db.user.findUnique({
              where: { username: cleanUpdateData.username }
            })

            if (existingUser && existingUser.id !== userId) {
              throw new Error('Username already in use by another user')
            }
          }

          const user = await db.user.update({
            where: { id: userId },
            data: cleanUpdateData,
            select: {
              id: true,
              email: true,
              username: true,
              emailVerified: true,
              createdAt: true,
              lastLoginAt: true,
              primaryRole: {
                select: {
                  name: true
                }
              },
            }
          })

          // Log security event
          await logSecurityEvent(
            ctx.user.id,
            'user_details_updated',
            { 
              targetUserId: userId, 
              updatedFields: Object.keys(cleanUpdateData),
              changedBy: ctx.user.email 
            },
            ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
            ctx.req?.headers.get('user-agent') || undefined
          )

          const { primaryRole, ...rest } = user

          return { 
            success: true,
            user: {
              ...rest,
              name: null,
              role: primaryRole?.name || 'user'
            }
          }
        },
        { userId: input.userId, fields: Object.keys(input) },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined
      )
    }),

  // Get user activity/stats
  getUserActivity: protectedProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)

      const [user, animeListCount, reviewsCount, friendsCount, followersCount, securityLogs] = await Promise.all([
        db.user.findUnique({
          where: { id: input.userId },
          select: {
            id: true,
            email: true,
            username: true,
            createdAt: true,
            lastLoginAt: true,
          }
        }),
        db.userAnimeList.count({ where: { userId: input.userId } }),
        db.userAnimeReview.count({ where: { userId: input.userId } }),
        db.friendship.count({ 
          where: {
            OR: [
              { user1Id: input.userId, status: 'accepted' },
              { user2Id: input.userId, status: 'accepted' }
            ]
          }
        }),
        db.follow.count({ where: { followingId: input.userId } }),
        db.securityLog.findMany({
          where: { userId: input.userId },
          orderBy: { timestamp: 'desc' },
          take: 10,
          select: {
            id: true,
            event: true,
            timestamp: true,
            ipAddress: true,
            userAgent: true,
          }
        })
      ])

      if (!user) {
        throw new Error('User not found')
      }

      return {
        user: {
          ...user,
          name: null,
        },
        stats: {
          animeList: animeListCount,
          reviews: reviewsCount,
          friends: friendsCount,
          followers: followersCount,
        },
        recentActivity: securityLogs.map((log: any) => ({
          id: log.id,
          eventType: log.event,
          createdAt: log.timestamp,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
        }))
      }
    }),

  // Send custom email to user
  sendCustomEmail: protectedProcedure
    .input(z.object({
      userId: z.string(),
      subject: z.string().min(1).max(200),
      message: z.string().min(1).max(5000),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)
      checkAdminRateLimit(ctx.user.id)

      return await secureAdminOperation(
        ctx.user.id,
        'send_custom_email',
        async () => {
          const user = await db.user.findUnique({
            where: { id: input.userId },
            select: { id: true, email: true, username: true }
          })

          if (!user) {
            throw new Error('User not found')
          }

          // Sanitize inputs to prevent XSS
          const sanitizeHtml = (text: string) => {
            return text
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;')
          }

          const sanitizedSubject = sanitizeHtml(input.subject)
          const sanitizedMessage = sanitizeHtml(input.message)
          const sanitizedName = user.username ? sanitizeHtml(user.username) : ''

          // Send custom email
          const html = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <title>${sanitizedSubject}</title>
              </head>
              <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a;">
                <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                  <div style="background: linear-gradient(135deg, #06b6d4 0%, #ec4899 100%); padding: 30px; text-align: center; border-radius: 16px 16px 0 0;">
                    <h1 style="margin: 0; color: white; font-size: 28px;">🎌 AnimeSenpai</h1>
                  </div>
                  <div style="background: #1e293b; padding: 40px 30px; border-radius: 0 0 16px 16px;">
                    <h2 style="color: white; margin: 0 0 20px;">Hi${sanitizedName ? ` ${sanitizedName}` : ''}! 👋</h2>
                    <div style="color: #cbd5e1; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${sanitizedMessage}</div>
                  </div>
                  <div style="text-align: center; padding: 20px; color: #64748b; font-size: 12px;">
                    <p style="margin: 0;">© 2025 AnimeSenpai. All rights reserved.</p>
                  </div>
                </div>
              </body>
            </html>
          `

          const sent = await emailService.sendCustomAdminEmail({
            to: user.email,
            subject: input.subject,
            html,
            text: input.message,
          })

          // Log security event
          await logSecurityEvent(
            ctx.user.id,
            'custom_email_sent',
            { 
              targetUserId: input.userId, 
              targetEmail: user.email,
              subject: input.subject,
              sentBy: ctx.user.email 
            },
            ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
            ctx.req?.headers.get('user-agent') || undefined
          )

          return { success: sent }
        },
        { userId: input.userId, subject: input.subject },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined
      )
    }),

  // ==================== PERMISSION MANAGEMENT ====================

  // Get all permissions with optional filtering
  getAllPermissions: protectedProcedure
    .input(z.object({
      category: z.string().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input = {}, ctx }) => {
      requireAdmin(ctx.user.role)

      const where: any = {}
      
      if (input.category) {
        where.category = input.category
      }
      
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: 'insensitive' } },
          { key: { contains: input.search, mode: 'insensitive' } },
          { description: { contains: input.search, mode: 'insensitive' } },
        ]
      }

      const [permissions, categories] = await Promise.all([
        db.permission.findMany({
          where,
          include: {
            roles: {
              include: {
                role: {
                  select: {
                    id: true,
                    name: true,
                    displayName: true,
                  }
                }
              }
            },
            _count: {
              select: {
                roles: true
              }
            }
          },
          orderBy: [
            { category: 'asc' },
            { name: 'asc' },
          ]
        }),
        db.permission.findMany({
          select: {
            category: true
          },
          distinct: ['category'],
          orderBy: {
            category: 'asc'
          }
        })
      ])

      return {
        permissions,
        categories: categories.map((c: typeof categories[0]) => c.category)
      }
    }),

  // Get single permission details
  getPermission: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)

      const permission = await db.permission.findUnique({
        where: { id: input.id },
        include: {
          roles: {
            include: {
              role: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  description: true,
                  isSystem: true,
                  priority: true,
                }
              }
            }
          }
        }
      })

      if (!permission) {
        throw new Error('Permission not found')
      }

      return permission
    }),

  // Create new permission
  createPermission: protectedProcedure
    .input(z.object({
      key: z.string().min(3).max(100),
      name: z.string().min(3).max(100),
      description: z.string().optional(),
      category: z.string().min(3).max(50),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)

      // Check if permission key already exists
      const existing = await db.permission.findUnique({
        where: { key: input.key }
      })

      if (existing) {
        throw new Error('Permission with this key already exists')
      }

      const permission = await db.permission.create({
        data: {
          key: input.key,
          name: input.name,
          description: input.description,
          category: input.category,
        },
        include: {
          _count: {
            select: {
              roles: true
            }
          }
        }
      })

      // Log the creation
      await logSecurityEvent(
        ctx.user.id,
        'permission_created',
        { 
          permissionId: permission.id,
          key: permission.key,
          name: permission.name,
          category: permission.category,
        },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return permission
    }),

  // Update permission
  updatePermission: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(3).max(100).optional(),
      description: z.string().optional(),
      category: z.string().min(3).max(50).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)

      const { id, ...data } = input

      const permission = await db.permission.update({
        where: { id },
        data,
        include: {
          _count: {
            select: {
              roles: true
            }
          }
        }
      })

      // Log the update
      await logSecurityEvent(
        ctx.user.id,
        'permission_updated',
        { 
          permissionId: permission.id,
          key: permission.key,
          updates: data,
        },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return permission
    }),

  // Delete permission
  deletePermission: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)

      const permission = await db.permission.findUnique({
        where: { id: input.id },
        include: {
          _count: {
            select: {
              roles: true
            }
          }
        }
      })

      if (!permission) {
        throw new Error('Permission not found')
      }

      // Delete the permission (role_permissions will cascade delete)
      await db.permission.delete({
        where: { id: input.id }
      })

      // Log the deletion
      await logSecurityEvent(
        ctx.user.id,
        'permission_deleted',
        { 
          permissionId: permission.id,
          key: permission.key,
          name: permission.name,
          rolesAffected: permission._count.roles,
        },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return { success: true }
    }),

  // Assign permission to role
  assignPermissionToRole: protectedProcedure
    .input(z.object({
      permissionId: z.string(),
      roleId: z.string(),
      granted: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)

      // Check if permission and role exist
      const [permission, role] = await Promise.all([
        db.permission.findUnique({ where: { id: input.permissionId } }),
        db.role.findUnique({ where: { id: input.roleId } }),
      ])

      if (!permission || !role) {
        throw new Error('Permission or role not found')
      }

      // Upsert the role permission
      const rolePermission = await db.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: input.roleId,
            permissionId: input.permissionId,
          }
        },
        create: {
          roleId: input.roleId,
          permissionId: input.permissionId,
          granted: input.granted,
        },
        update: {
          granted: input.granted,
        },
        include: {
          permission: true,
          role: true,
        }
      })

      // Log the assignment
      await logSecurityEvent(
        ctx.user.id,
        'permission_assigned',
        { 
          permissionId: permission.id,
          permissionKey: permission.key,
          roleId: role.id,
          roleName: role.name,
          granted: input.granted,
        },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return rolePermission
    }),

  // Remove permission from role
  removePermissionFromRole: protectedProcedure
    .input(z.object({
      permissionId: z.string(),
      roleId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)

      // Get permission and role details for logging
      const rolePermission = await db.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: input.roleId,
            permissionId: input.permissionId,
          }
        },
        include: {
          permission: true,
          role: true,
        }
      })

      if (!rolePermission) {
        throw new Error('Permission assignment not found')
      }

      // Delete the role permission
      await db.rolePermission.delete({
        where: {
          roleId_permissionId: {
            roleId: input.roleId,
            permissionId: input.permissionId,
          }
        }
      })

      // Log the removal
      await logSecurityEvent(
        ctx.user.id,
        'permission_removed',
        { 
          permissionId: rolePermission.permission.id,
          permissionKey: rolePermission.permission.key,
          roleId: rolePermission.role.id,
          roleName: rolePermission.role.name,
        },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return { success: true }
    }),

  // Get role's permissions
  getRolePermissions: protectedProcedure
    .input(z.object({
      roleId: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)

      const role = await db.role.findUnique({
        where: { id: input.roleId },
        include: {
          permissions: {
            include: {
              permission: true
            },
            orderBy: {
              permission: {
                category: 'asc'
              }
            }
          }
        }
      })

      if (!role) {
        throw new Error('Role not found')
      }

      return role
    }),

  // Bulk assign permissions to role
  bulkAssignPermissions: protectedProcedure
    .input(z.object({
      roleId: z.string(),
      permissionIds: z.array(z.string()),
      granted: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)

      // Check if role exists
      const role = await db.role.findUnique({ where: { id: input.roleId } })
      if (!role) {
        throw new Error('Role not found')
      }

      // Create all role permissions
      const createdPermissions = await Promise.all(
        input.permissionIds.map(permissionId =>
          db.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: input.roleId,
                permissionId,
              }
            },
            create: {
              roleId: input.roleId,
              permissionId,
              granted: input.granted,
            },
            update: {
              granted: input.granted,
            }
          })
        )
      )

      // Log the bulk assignment
      await logSecurityEvent(
        ctx.user.id,
        'permissions_bulk_assigned',
        { 
          roleId: role.id,
          roleName: role.name,
          permissionCount: input.permissionIds.length,
          granted: input.granted,
        },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return { 
        success: true,
        count: createdPermissions.length
      }
    }),

  // Bulk remove permissions from role
  bulkRemovePermissions: protectedProcedure
    .input(z.object({
      roleId: z.string(),
      permissionIds: z.array(z.string()),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)

      // Check if role exists
      const role = await db.role.findUnique({ where: { id: input.roleId } })
      if (!role) {
        throw new Error('Role not found')
      }

      // Delete all role permissions
      const result = await db.rolePermission.deleteMany({
        where: {
          roleId: input.roleId,
          permissionId: {
            in: input.permissionIds
          }
        }
      })

      // Log the bulk removal
      await logSecurityEvent(
        ctx.user.id,
        'permissions_bulk_removed',
        { 
          roleId: role.id,
          roleName: role.name,
          permissionCount: result.count,
        },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return { 
        success: true,
        count: result.count
      }
    }),

  // ===== ACHIEVEMENTS MANAGEMENT =====
  
  /**
   * Get all achievements with pagination and filtering
   */
  getAchievements: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
      category: z.string().optional(),
      tier: z.string().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input = {}, ctx }) => {
      requireAdmin(ctx.user.role)
      await checkAdminRateLimit(ctx.user.id)

      const { page = 1, limit = 20, category, search } = input
      const skip = (page - 1) * limit

      const where: any = {}
      if (category) where.category = category
      // Note: tier filtering would need to be done on AchievementTier, not Achievement
      // For now, we'll skip tier filtering at the Achievement level
      if (search) {
        where.OR = [
          { baseName: { contains: search, mode: 'insensitive' } },
          { baseDescription: { contains: search, mode: 'insensitive' } },
          { key: { contains: search, mode: 'insensitive' } }
        ]
      }

      const [achievements, total] = await Promise.all([
        db.achievement.findMany({
          where,
          skip,
          take: limit,
          orderBy: [
            { category: 'asc' },
            { baseName: 'asc' },
            { createdAt: 'asc' }
          ],
          include: {
            tiers: {
              orderBy: { tier: 'asc' }
            },
            _count: {
              select: {
                userAchievements: true
              }
            }
          }
        }),
        db.achievement.count({ where })
      ])

      return {
        achievements,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    }),

  /**
   * Create a new achievement
   */
  createAchievement: protectedProcedure
    .input(z.object({
      key: z.string().min(1).max(50),
      name: z.string().min(1).max(100),
      description: z.string().min(1).max(500),
      icon: z.string().min(1).max(10),
      category: z.enum(['watching', 'rating', 'social', 'discovery', 'special']),
      tier: z.enum(['bronze', 'silver', 'gold', 'platinum', 'diamond']),
      requirement: z.number().min(1),
      points: z.number().min(1).max(1000).default(10),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)
      await checkAdminRateLimit(ctx.user.id)

      // Check if key already exists
      const existing = await db.achievement.findUnique({
        where: { key: input.key }
      })

      if (existing) {
        throw new Error('Achievement key already exists')
      }

      const achievement = await db.achievement.create({
        data: input
      })

      await logSecurityEvent(
        ctx.user.id,
        'achievement_created',
        { achievementId: achievement.id, key: achievement.key, name: achievement.name },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return { success: true, achievement }
    }),

  /**
   * Update an existing achievement
   */
  updateAchievement: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().min(1).max(500).optional(),
      icon: z.string().min(1).max(10).optional(),
      category: z.enum(['watching', 'rating', 'social', 'discovery', 'special']).optional(),
      tier: z.enum(['bronze', 'silver', 'gold', 'platinum', 'diamond']).optional(),
      requirement: z.number().min(1).optional(),
      points: z.number().min(1).max(1000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)
      await checkAdminRateLimit(ctx.user.id)

      const { id, ...updateData } = input

      // Check if achievement exists
      const existing = await db.achievement.findUnique({
        where: { id }
      })

      if (!existing) {
        throw new Error('Achievement not found')
      }

      const achievement = await db.achievement.update({
        where: { id },
        data: updateData
      })

      await logSecurityEvent(
        ctx.user.id,
        'achievement_updated',
        { achievementId: achievement.id, key: achievement.key, name: achievement.name },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return { success: true, achievement }
    }),

  /**
   * Delete an achievement
   */
  deleteAchievement: protectedProcedure
    .input(z.object({
      id: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)
      await checkAdminRateLimit(ctx.user.id)

      const { id } = input

      // Check if achievement exists
      const existing = await db.achievement.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              userAchievements: true
            }
          }
        }
      })

      if (!existing) {
        throw new Error('Achievement not found')
      }

      // Check if any users have unlocked this achievement
      if (existing._count.userAchievements > 0) {
        throw new Error('Cannot delete achievement that has been unlocked by users')
      }

      await db.achievement.delete({
        where: { id }
      })

      await logSecurityEvent(
        ctx.user.id,
        'achievement_deleted',
        { achievementId: existing.id, key: existing.key, name: existing.name },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return { success: true }
    }),

  /**
   * Get achievement statistics
   */
  getAchievementStats: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx.user.role)

      const [
        totalAchievements,
        totalUnlocks,
        categoryStats,
        tierStats,
        recentUnlocks
      ] = await Promise.all([
        db.achievement.count(),
        db.userAchievement.count(),
        db.achievement.groupBy({
          by: ['category'],
          _count: {
            id: true
          }
        }),
        db.achievement.groupBy({
          by: ['tier'],
          _count: {
            id: true
          }
        }),
        db.userAchievement.findMany({
          take: 10,
          orderBy: { unlockedAt: 'desc' },
          include: {
            user: {
              select: { id: true, username: true }
            },
            achievement: {
              select: { id: true, name: true, icon: true, tier: true }
            }
          }
        })
      ])

      return {
        totalAchievements,
        totalUnlocks,
        categoryStats,
        tierStats,
        recentUnlocks: recentUnlocks.map((unlock: any) => ({
          ...unlock,
          user: unlock.user ? { ...unlock.user, name: null } : null,
        }))
      }
    }),

  /**
   * Bulk create achievements from template
   */
  bulkCreateAchievements: protectedProcedure
    .input(z.object({
      achievements: z.array(z.object({
        key: z.string().min(1).max(50),
        name: z.string().min(1).max(100),
        description: z.string().min(1).max(500),
        icon: z.string().min(1).max(10),
        category: z.enum(['watching', 'rating', 'social', 'discovery', 'special']),
        tier: z.enum(['bronze', 'silver', 'gold', 'platinum', 'diamond']),
        requirement: z.number().min(1),
        points: z.number().min(1).max(1000).default(10),
      }))
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)
      await checkAdminRateLimit(ctx.user.id)

      const { achievements } = input

      // Check for duplicate keys
      const keys = achievements.map(a => a.key)
      const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index)
      if (duplicates.length > 0) {
        throw new Error(`Duplicate keys found: ${duplicates.join(', ')}`)
      }

      // Check if any keys already exist
      const existing = await db.achievement.findMany({
        where: { key: { in: keys } },
        select: { key: true }
      })

      if (existing.length > 0) {
        throw new Error(`Keys already exist: ${existing.map((e: typeof existing[0]) => e.key).join(', ')}`)
      }

      const created = await db.achievement.createMany({
        data: achievements
      })

      await logSecurityEvent(
        ctx.user.id,
        'achievements_bulk_created',
        { count: created.count },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return { success: true, count: created.count }
    }),
})

