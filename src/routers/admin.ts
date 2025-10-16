import { z } from 'zod'
import { router, protectedProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import {
  UserRole,
  requireAdmin,
  promoteToTester,
  demoteToUser,
  promoteToAdmin,
  setFeatureFlag,
  clearFeatureFlagCache,
} from '../lib/roles'
import { logSecurityEvent, sendPasswordReset } from '../lib/auth'
import { secureAdminOperation, checkAdminRateLimit } from '../lib/admin-security'
import { emailService } from '../lib/email'

export const adminRouter = router({
  // Get all users with their roles
  getAllUsers: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
      role: z.enum(['user', 'tester', 'admin']).optional(),
    }).optional())
    .query(async ({ input = {}, ctx }) => {
      // Only admins can view all users
      requireAdmin(ctx.user.role)

      const { page = 1, limit = 20, role } = input
      const skip = (page - 1) * limit

      const where: any = {}
      if (role) {
        where.role = role
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
            name: true,
            role: true,
            emailVerified: true,
            createdAt: true,
            lastLoginAt: true,
          }
        }),
        db.user.count({ where })
      ])

      return {
        users,
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
        description: input.description,
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
        db.user.count({ where: { role: UserRole.TESTER } }),
        db.user.count({ where: { role: UserRole.ADMIN } }),
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
          name: true,
          username: true,
          role: true,
          emailVerified: true,
          createdAt: true,
          lastLoginAt: true,
          avatar: true,
        }
      })

      if (!user) {
        throw new Error('User not found')
      }

      return user
    }),

  // Update user role
  updateUserRole: protectedProcedure
    .input(z.object({
      userId: z.string(),
      role: z.enum(['user', 'moderator', 'admin']),
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
      const user = await db.user.update({
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
            { name: { contains: input.query, mode: 'insensitive' } },
            { username: { contains: input.query, mode: 'insensitive' } },
          ]
        },
        take: input.limit,
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          role: true,
          createdAt: true,
          lastLoginAt: true,
        }
      })

      return users
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

      // Settings stored as JSON in a single row with key 'system'
      // We'll use a simple key-value approach in the database
      const settings = await db.$queryRaw<Array<{ key: string; value: string }>>`
        SELECT * FROM "SystemSettings" WHERE key = 'system' LIMIT 1
      `

      if (settings.length === 0) {
        // Return default settings
        return {
          general: {
            siteName: 'AnimeSenpai',
            siteDescription: 'Track, discover, and explore your favorite anime',
            maintenanceMode: false,
            allowRegistration: true,
            requireEmailVerification: true,
          },
          features: {
            enableRecommendations: true,
            enableSocialFeatures: true,
            enableAchievements: true,
            enableComments: true,
          },
          security: {
            sessionTimeout: 30,
            maxLoginAttempts: 5,
            requireStrongPasswords: true,
            enableTwoFactor: false,
          },
          notifications: {
            emailNotifications: true,
            newUserAlert: true,
            errorReporting: true,
          },
          analytics: {
            googleAnalyticsId: '',
            enableTracking: false,
          }
        }
      }

      return JSON.parse(settings[0].value)
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
          // Create SystemSettings table if it doesn't exist
          await db.$executeRaw`
            CREATE TABLE IF NOT EXISTS "SystemSettings" (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL,
              "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updatedBy" TEXT NOT NULL
            )
          `

          // Merge with existing settings
          const existing = await db.$queryRaw<Array<{ key: string; value: string }>>`
            SELECT * FROM "SystemSettings" WHERE key = 'system' LIMIT 1
          `

          let currentSettings: Record<string, any> = {}
          if (existing.length > 0) {
            currentSettings = JSON.parse(existing[0].value)
          }

          // Merge new settings
          const updatedSettings = {
            ...currentSettings,
            ...input
          }

          // Upsert settings
          await db.$executeRaw`
            INSERT INTO "SystemSettings" (key, value, "updatedBy", "updatedAt")
            VALUES ('system', ${JSON.stringify(updatedSettings)}::text, ${ctx.user.email}, CURRENT_TIMESTAMP)
            ON CONFLICT (key) DO UPDATE SET
              value = ${JSON.stringify(updatedSettings)}::text,
              "updatedBy" = ${ctx.user.email},
              "updatedAt" = CURRENT_TIMESTAMP
          `

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
            select: { id: true, email: true, name: true }
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
      name: z.string().optional(),
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

          // Remove undefined values
          const cleanUpdateData = Object.fromEntries(
            Object.entries(updateData).filter(([_, v]) => v !== undefined)
          )

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
              name: true,
              username: true,
              emailVerified: true,
              role: true,
              createdAt: true,
              lastLoginAt: true,
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

          return { success: true, user }
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
            name: true,
            username: true,
            createdAt: true,
            lastLoginAt: true,
          }
        }),
        db.userAnimeList.count({ where: { userId: input.userId } }),
        db.review.count({ where: { userId: input.userId } }),
        db.friend.count({ 
          where: {
            OR: [
              { userId: input.userId, status: 'accepted' },
              { friendId: input.userId, status: 'accepted' }
            ]
          }
        }),
        db.follow.count({ where: { followingId: input.userId } }),
        db.securityLog.findMany({
          where: { userId: input.userId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            eventType: true,
            createdAt: true,
            ipAddress: true,
            userAgent: true,
          }
        })
      ])

      if (!user) {
        throw new Error('User not found')
      }

      return {
        user,
        stats: {
          animeList: animeListCount,
          reviews: reviewsCount,
          friends: friendsCount,
          followers: followersCount,
        },
        recentActivity: securityLogs
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
            select: { id: true, email: true, name: true }
          })

          if (!user) {
            throw new Error('User not found')
          }

          // Send custom email
          const html = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <title>${input.subject}</title>
              </head>
              <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a;">
                <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                  <div style="background: linear-gradient(135deg, #06b6d4 0%, #ec4899 100%); padding: 30px; text-align: center; border-radius: 16px 16px 0 0;">
                    <h1 style="margin: 0; color: white; font-size: 28px;">🎌 AnimeSenpai</h1>
                  </div>
                  <div style="background: #1e293b; padding: 40px 30px; border-radius: 0 0 16px 16px;">
                    <h2 style="color: white; margin: 0 0 20px;">Hi${user.name ? ` ${user.name}` : ''}! 👋</h2>
                    <div style="color: #cbd5e1; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${input.message}</div>
                  </div>
                  <div style="text-align: center; padding: 20px; color: #64748b; font-size: 12px;">
                    <p style="margin: 0;">© 2025 AnimeSenpai. All rights reserved.</p>
                  </div>
                </div>
              </body>
            </html>
          `

          const sent = await emailService['sendEmail']({
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
})

