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
import { logSecurityEvent } from '../lib/auth'

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
          _count: {
            select: {
              userAnimeList: true,
            }
          }
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

      // Prevent demoting yourself
      if (input.userId === ctx.user.id) {
        throw new Error('Cannot change your own role')
      }

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

      // Prevent deleting yourself
      if (input.userId === ctx.user.id) {
        throw new Error('Cannot delete your own account')
      }

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
})

