/**
 * Role and Feature Flag Management
 * 
 * This module provides utilities for:
 * - Role-based access control (RBAC)
 * - Feature flag management
 * - Beta testing access control
 */

import { db } from './db'
import { TRPCError } from '@trpc/server'

// Role definitions
export enum UserRole {
  USER = 'user',       // Regular users
  TESTER = 'tester',   // Beta testers - access to unreleased features
  ADMIN = 'admin',     // Full access
}

// Feature flag cache (in-memory for performance)
const featureFlagCache = new Map<string, {
  enabled: boolean
  roles: string[]
  expiresAt: number
}>()

const CACHE_TTL = 60000 // 1 minute

/**
 * Check if user has a specific role
 */
export function hasRole(userRole: string, requiredRole: UserRole): boolean {
  const hierarchy: Record<string, number> = {
    [UserRole.USER]: 1,
    [UserRole.TESTER]: 2,
    [UserRole.ADMIN]: 3,
  }

  const userLevel = hierarchy[userRole] || 0
  const requiredLevel = hierarchy[requiredRole] || 0

  return userLevel >= requiredLevel
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(userRole: string, requiredRoles: UserRole[]): boolean {
  return requiredRoles.some(role => hasRole(userRole, role))
}

/**
 * Get feature flag from database with caching
 */
async function getFeatureFlag(key: string) {
  // Check cache first
  const cached = featureFlagCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached
  }

  // Fetch from database
  const flag = await db.featureFlag.findUnique({
    where: { key },
    select: {
      enabled: true,
      roles: true,
    }
  })

  if (!flag) {
    return null
  }

  // Cache the result
  const cacheEntry = {
    enabled: flag.enabled,
    roles: flag.roles,
    expiresAt: Date.now() + CACHE_TTL
  }
  featureFlagCache.set(key, cacheEntry)

  return cacheEntry
}

/**
 * Check if a feature is enabled for a user
 * 
 * @param featureKey - Unique feature identifier
 * @param userRole - User's role
 * @returns true if feature is accessible
 */
export async function hasFeatureAccess(featureKey: string, userRole: string): Promise<boolean> {
  const flag = await getFeatureFlag(featureKey)

  // Feature doesn't exist - deny access
  if (!flag) {
    return false
  }

  // Feature globally disabled - deny access
  if (!flag.enabled) {
    return false
  }

  // No role restrictions - allow access
  if (!flag.roles || flag.roles.length === 0) {
    return true
  }

  // Check if user's role has access
  return flag.roles.includes(userRole)
}

/**
 * Require specific role (throws error if not met)
 */
export function requireRole(userRole: string, requiredRole: UserRole) {
  if (!hasRole(userRole, requiredRole)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `This action requires ${requiredRole} role`,
    })
  }
}

/**
 * Require admin role (throws error if not admin)
 */
export function requireAdmin(userRole: string) {
  requireRole(userRole, UserRole.ADMIN)
}

/**
 * Require tester or admin role (throws error if neither)
 */
export function requireTester(userRole: string) {
  if (!hasAnyRole(userRole, [UserRole.TESTER, UserRole.ADMIN])) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'This action requires tester or admin role',
    })
  }
}

/**
 * Require feature access (throws error if not available)
 */
export async function requireFeature(featureKey: string, userRole: string) {
  const hasAccess = await hasFeatureAccess(featureKey, userRole)
  
  if (!hasAccess) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Feature '${featureKey}' is not available`,
    })
  }
}

/**
 * Clear feature flag cache (useful after updates)
 */
export function clearFeatureFlagCache(key?: string) {
  if (key) {
    featureFlagCache.delete(key)
  } else {
    featureFlagCache.clear()
  }
}

/**
 * Get all feature flags accessible to a user
 */
export async function getUserFeatures(userRole: string): Promise<string[]> {
  const flags = await db.featureFlag.findMany({
    where: {
      enabled: true,
    },
    select: {
      key: true,
      roles: true,
    }
  })

  return flags
    .filter(flag => {
      // No role restrictions = everyone has access
      if (!flag.roles || flag.roles.length === 0) {
        return true
      }
      // Check if user's role has access
      return flag.roles.includes(userRole)
    })
    .map(flag => flag.key)
}

/**
 * Create or update a feature flag
 */
export async function setFeatureFlag(
  key: string,
  data: {
    name?: string
    description?: string
    enabled?: boolean
    roles?: string[]
  }
) {
  // Validate key format (lowercase, numbers, hyphens only, 3-50 chars)
  if (!key || key.length < 3 || key.length > 50) {
    throw new Error('Feature key must be 3-50 characters long')
  }

  if (!/^[a-z0-9-]+$/.test(key)) {
    throw new Error('Feature key must contain only lowercase letters, numbers, and hyphens')
  }

  // Validate roles if provided
  const validRoles = ['user', 'tester', 'admin']
  if (data.roles) {
    for (const role of data.roles) {
      if (!validRoles.includes(role)) {
        throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`)
      }
    }
  }

  const flag = await db.featureFlag.upsert({
    where: { key },
    update: data,
    create: {
      key,
      name: data.name || key,
      description: data.description,
      enabled: data.enabled ?? false,
      roles: data.roles ?? [],
    }
  })

  // Clear cache for this flag
  clearFeatureFlagCache(key)

  return flag
}

/**
 * Helper to promote user to tester
 */
export async function promoteToTester(userId: string) {
  const user = await db.user.update({
    where: { id: userId },
    data: { role: UserRole.TESTER },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    }
  })

  return user
}

/**
 * Helper to demote tester to regular user
 */
export async function demoteToUser(userId: string) {
  const user = await db.user.update({
    where: { id: userId },
    data: { role: UserRole.USER },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    }
  })

  return user
}

/**
 * Helper to promote user to admin
 */
export async function promoteToAdmin(userId: string) {
  const user = await db.user.update({
    where: { id: userId },
    data: { role: UserRole.ADMIN },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    }
  })

  return user
}

