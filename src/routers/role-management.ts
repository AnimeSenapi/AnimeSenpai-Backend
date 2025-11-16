/**
 * Role Management Router
 * 
 * Handles role and permission management for the admin panel
 */

import { z } from 'zod'
import { router, protectedProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import { requireAdmin } from '../lib/roles'
import { logSecurityEvent } from '../lib/auth'

export const roleManagementRouter = router({
  /**
   * Get all roles with their permissions
   */
  getAllRoles: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx.user.role)

      const roles = await db.role.findMany({
        include: {
          permissions: {
            include: {
              permission: true
            }
          },
          _count: {
            select: {
              primaryUsers: true,
              additionalUsers: true
            }
          }
        },
        orderBy: {
          priority: 'desc'
        }
      })

      return roles.map((role: typeof roles[0]) => ({
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        isSystem: role.isSystem,
        isDefault: role.isDefault,
        priority: role.priority,
        userCount: role._count.primaryUsers + role._count.additionalUsers,
        permissions: role.permissions
          .filter((rp: typeof role.permissions[0]) => rp.granted)
          .map((rp: typeof role.permissions[0]) => ({
            id: rp.permission.id,
            key: rp.permission.key,
            name: rp.permission.name,
            description: rp.permission.description,
            category: rp.permission.category
          })),
        createdAt: role.createdAt,
        updatedAt: role.updatedAt
      }))
    }),

  /**
   * Get all permissions grouped by category
   */
  getAllPermissions: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx.user.role)

      const permissions = await db.permission.findMany({
        orderBy: [
          { category: 'asc' },
          { name: 'asc' }
        ]
      })

      // Group by category
      const grouped = permissions.reduce((acc: Record<string, typeof permissions[0][]>, perm: typeof permissions[0]) => {
        if (!acc[perm.category]) {
          acc[perm.category] = []
        }
        const categoryArray = acc[perm.category]!
        categoryArray.push(perm)
        return acc
      }, {} as Record<string, typeof permissions[0][]>)

      return grouped
    }),

  /**
   * Get a single role with permissions
   */
  getRole: protectedProcedure
    .input(z.object({
      roleId: z.string()
    }))
    .query(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)

      const role = await db.role.findUnique({
        where: { id: input.roleId },
        include: {
          permissions: {
            include: {
              permission: true
            }
          },
          _count: {
            select: {
              primaryUsers: true,
              additionalUsers: true
            }
          }
        }
      })

      if (!role) {
        throw new Error('Role not found')
      }

      return {
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        isSystem: role.isSystem,
        isDefault: role.isDefault,
        priority: role.priority,
        userCount: role._count.primaryUsers + role._count.additionalUsers,
        permissions: role.permissions
          .filter((rp: typeof role.permissions[0]) => rp.granted)
          .map((rp: typeof role.permissions[0]) => ({
            id: rp.permission.id,
            key: rp.permission.key,
            name: rp.permission.name,
            description: rp.permission.description,
            category: rp.permission.category
          })),
        createdAt: role.createdAt,
        updatedAt: role.updatedAt
      }
    }),

  /**
   * Create a new role
   */
  createRole: protectedProcedure
    .input(z.object({
      name: z.string().min(3).max(50).regex(/^[a-z0-9-_]+$/),
      displayName: z.string().min(3).max(100),
      description: z.string().optional(),
      priority: z.number().int().min(0).max(100).default(0),
      permissionIds: z.array(z.string()).default([])
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)

      // Check if role name already exists
      const existing = await db.role.findUnique({
        where: { name: input.name }
      })

      if (existing) {
        throw new Error('Role with this name already exists')
      }

      // Create role
      const role = await db.role.create({
        data: {
          name: input.name,
          displayName: input.displayName,
          description: input.description,
          priority: input.priority,
          isSystem: false,
          isDefault: false
        }
      })

      // Assign permissions
      if (input.permissionIds.length > 0) {
        await db.rolePermission.createMany({
          data: input.permissionIds.map(permissionId => ({
            roleId: role.id,
            permissionId,
            granted: true
          }))
        })
      }

      // Log security event
      await logSecurityEvent(
        ctx.user.id,
        'role_created',
        { roleId: role.id, roleName: role.name, createdBy: ctx.user.email },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return {
        success: true,
        role: {
          id: role.id,
          name: role.name,
          displayName: role.displayName,
          description: role.description,
          priority: role.priority
        }
      }
    }),

  /**
   * Update an existing role
   */
  updateRole: protectedProcedure
    .input(z.object({
      roleId: z.string(),
      displayName: z.string().min(3).max(100).optional(),
      description: z.string().optional(),
      priority: z.number().int().min(0).max(100).optional(),
      permissionIds: z.array(z.string()).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)

      const { roleId, permissionIds, ...updateData } = input

      // Check if role exists
      const role = await db.role.findUnique({
        where: { id: roleId }
      })

      if (!role) {
        throw new Error('Role not found')
      }

      if (role.isSystem) {
        throw new Error('Cannot modify system roles')
      }

      // Update role
      const updatedRole = await db.role.update({
        where: { id: roleId },
        data: updateData
      })

      // Update permissions if provided
      if (permissionIds !== undefined) {
        // Delete existing permissions
        await db.rolePermission.deleteMany({
          where: { roleId }
        })

        // Add new permissions
        if (permissionIds.length > 0) {
          await db.rolePermission.createMany({
            data: permissionIds.map(permissionId => ({
              roleId,
              permissionId,
              granted: true
            }))
          })
        }
      }

      // Log security event
      await logSecurityEvent(
        ctx.user.id,
        'role_updated',
        { roleId, roleName: role.name, updatedBy: ctx.user.email },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return {
        success: true,
        role: updatedRole
      }
    }),

  /**
   * Delete a role
   */
  deleteRole: protectedProcedure
    .input(z.object({
      roleId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)

      const role = await db.role.findUnique({
        where: { id: input.roleId },
        include: {
          _count: {
            select: {
              primaryUsers: true,
              additionalUsers: true
            }
          }
        }
      })

      if (!role) {
        throw new Error('Role not found')
      }

      if (role.isSystem) {
        throw new Error('Cannot delete system roles')
      }

      const totalUsers = role._count.primaryUsers + role._count.additionalUsers
      if (totalUsers > 0) {
        throw new Error(`Cannot delete role with ${totalUsers} users assigned. Please reassign users first.`)
      }

      await db.role.delete({
        where: { id: input.roleId }
      })

      // Log security event
      await logSecurityEvent(
        ctx.user.id,
        'role_deleted',
        { roleId: input.roleId, roleName: role.name, deletedBy: ctx.user.email },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return {
        success: true,
        message: 'Role deleted successfully'
      }
    }),

  /**
   * Assign role to user
   */
  assignRoleToUser: protectedProcedure
    .input(z.object({
      userId: z.string(),
      roleId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)

      // Check if role exists
      const role = await db.role.findUnique({
        where: { id: input.roleId }
      })

      if (!role) {
        throw new Error('Role not found')
      }

      // Update user
      const user = await db.user.update({
        where: { id: input.userId },
        data: {
          customRoleId: input.roleId,
          role: role.name
        },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          role: true
        }
      })

      // Log security event
      await logSecurityEvent(
        ctx.user.id,
        'user_role_assigned',
        { userId: input.userId, roleId: input.roleId, roleName: role.name, assignedBy: ctx.user.email },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return {
        success: true,
        user
      }
    }),

  /**
   * Remove custom role from user (revert to default)
   */
  removeRoleFromUser: protectedProcedure
    .input(z.object({
      userId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)

      const user = await db.user.update({
        where: { id: input.userId },
        data: {
          customRoleId: null,
          role: 'user' // Default role
        },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          role: true
        }
      })

      // Log security event
      await logSecurityEvent(
        ctx.user.id,
        'user_role_removed',
        { userId: input.userId, removedBy: ctx.user.email },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return {
        success: true,
        user
      }
    }),

  /**
   * Create a new permission
   */
  createPermission: protectedProcedure
    .input(z.object({
      key: z.string().min(3).max(100).regex(/^[a-z0-9._-]+$/),
      name: z.string().min(3).max(100),
      description: z.string().optional(),
      category: z.string().min(2).max(50).default('general')
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
        data: input
      })

      // Log security event
      await logSecurityEvent(
        ctx.user.id,
        'permission_created',
        { permissionId: permission.id, permissionKey: permission.key, createdBy: ctx.user.email },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return {
        success: true,
        permission
      }
    }),

  /**
   * Update a permission
   */
  updatePermission: protectedProcedure
    .input(z.object({
      permissionId: z.string(),
      name: z.string().min(3).max(100).optional(),
      description: z.string().optional(),
      category: z.string().min(2).max(50).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)

      const { permissionId, ...updateData } = input

      const permission = await db.permission.update({
        where: { id: permissionId },
        data: updateData
      })

      // Log security event
      await logSecurityEvent(
        ctx.user.id,
        'permission_updated',
        { permissionId, permissionKey: permission.key, updatedBy: ctx.user.email },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return {
        success: true,
        permission
      }
    }),

  /**
   * Delete a permission
   */
  deletePermission: protectedProcedure
    .input(z.object({
      permissionId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role)

      const permission = await db.permission.findUnique({
        where: { id: input.permissionId },
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

      if (permission._count.roles > 0) {
        throw new Error(`Cannot delete permission used by ${permission._count.roles} roles. Please remove from roles first.`)
      }

      await db.permission.delete({
        where: { id: input.permissionId }
      })

      // Log security event
      await logSecurityEvent(
        ctx.user.id,
        'permission_deleted',
        { permissionId: input.permissionId, permissionKey: permission.key, deletedBy: ctx.user.email },
        ctx.req?.headers.get('x-forwarded-for') || ctx.req?.headers.get('x-real-ip') || undefined,
        ctx.req?.headers.get('user-agent') || undefined
      )

      return {
        success: true,
        message: 'Permission deleted successfully'
      }
    }),
})

