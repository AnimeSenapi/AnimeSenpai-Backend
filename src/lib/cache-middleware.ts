/**
 * Caching Middleware for API Endpoints
 * 
 * Provides intelligent caching for tRPC procedures and HTTP endpoints
 * with support for cache invalidation and conditional caching.
 */

import { cache, CacheUtils, CACHE_TTL } from './cache.js'
import { logger } from './logger.js'

// Cache configuration for different endpoint types
interface CacheConfig {
  ttl: number
  keyGenerator: (input: any, ctx?: any) => string
  shouldCache?: (input: any, ctx?: any) => boolean
  invalidateOn?: string[] // List of operations that should invalidate this cache
}

// Predefined cache configurations for common patterns
export const CACHE_CONFIGS = {
  // Anime endpoints
  ANIME_BY_ID: {
    ttl: CACHE_TTL.ANIME,
    keyGenerator: (input: { id: string }) => CacheUtils.animeKey(input.id),
    shouldCache: (input: any) => !!input.id,
    invalidateOn: ['anime.update', 'anime.delete'],
  },
  
  ANIME_LIST: {
    ttl: CACHE_TTL.SHORT,
    keyGenerator: (input: any) => `anime:list:${JSON.stringify(input)}`,
    shouldCache: (input: any) => !input.forceRefresh,
    invalidateOn: ['anime.create', 'anime.update', 'anime.delete'],
  },

  // User endpoints
  USER_BY_ID: {
    ttl: CACHE_TTL.USER,
    keyGenerator: (input: { id: string }) => CacheUtils.userKey(input.id),
    shouldCache: (input: any) => !!input.id,
    invalidateOn: ['user.update', 'user.delete'],
  },

  USER_ANIME_LIST: {
    ttl: CACHE_TTL.MEDIUM,
    keyGenerator: (input: { userId: string; status?: string }) => 
      `user:${input.userId}:anime_list:${input.status || 'all'}`,
    shouldCache: (input: any) => !!input.userId,
    invalidateOn: ['user.updateAnimeList', 'user.addToAnimeList', 'user.removeFromAnimeList'],
  },

  // Achievement endpoints
  ACHIEVEMENTS: {
    ttl: CACHE_TTL.ACHIEVEMENT,
    keyGenerator: (input: any) => `achievements:${JSON.stringify(input)}`,
    shouldCache: () => true,
    invalidateOn: ['achievement.create', 'achievement.update', 'achievement.delete'],
  },

  USER_ACHIEVEMENTS: {
    ttl: CACHE_TTL.MEDIUM,
    keyGenerator: (input: { userId: string }) => `user:${input.userId}:achievements`,
    shouldCache: (input: any) => !!input.userId,
    invalidateOn: ['achievement.unlock', 'achievement.update'],
  },

  // Review endpoints
  REVIEWS: {
    ttl: CACHE_TTL.REVIEW,
    keyGenerator: (input: { animeId?: string; userId?: string }) => 
      `reviews:${input.animeId || 'all'}:${input.userId || 'all'}`,
    shouldCache: () => true,
    invalidateOn: ['review.create', 'review.update', 'review.delete'],
  },

  // Genre endpoints
  GENRES: {
    ttl: CACHE_TTL.GENRE,
    keyGenerator: () => 'genres:all',
    shouldCache: () => true,
    invalidateOn: ['genre.create', 'genre.update', 'genre.delete'],
  },

  // Recommendation endpoints
  RECOMMENDATIONS: {
    ttl: CACHE_TTL.RECOMMENDATION,
    keyGenerator: (input: { userId: string; type?: string }) => 
      CacheUtils.recommendationKey(input.userId, input.type || 'default'),
    shouldCache: (input: any) => !!input.userId,
    invalidateOn: ['user.updateAnimeList', 'user.rateAnime', 'user.updatePreferences'],
  },
} as const

/**
 * Cache middleware for tRPC procedures
 */
export function createCacheMiddleware(config: CacheConfig) {
  return async function cacheMiddleware(opts: {
    ctx: any
    input: any
    path: string
    type: string
  }) {
    const { ctx, input, path, type } = opts

    // Skip caching for mutations
    if (type === 'mutation') {
      return
    }

    // Check if we should cache this request
    if (config.shouldCache && !config.shouldCache(input, ctx)) {
      return
    }

    // Generate cache key
    const cacheKey = config.keyGenerator(input, ctx)

    try {
      // Try to get from cache
      const cached = cache.get(cacheKey)
      if (cached !== null) {
        logger.debug('Cache hit', { path, cacheKey })
        return cached
      }

      logger.debug('Cache miss', { path, cacheKey })
    } catch (error) {
      logger.error('Cache middleware error', error as Error, undefined, {
        path,
        cacheKey,
        operation: 'get',
      })
    }

    // Return undefined to continue with normal execution
    return undefined
  }
}

/**
 * Cache result wrapper for tRPC procedures
 */
export function cacheResult(config: CacheConfig) {
  return function (_target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const [input, ctx] = args
      
      // Skip caching for mutations
      if (propertyName.includes('create') || 
          propertyName.includes('update') || 
          propertyName.includes('delete')) {
        return method.apply(this, args)
      }

      // Check if we should cache this request
      if (config.shouldCache && !config.shouldCache(input, ctx)) {
        return method.apply(this, args)
      }

      // Generate cache key
      const cacheKey = config.keyGenerator(input, ctx)

      try {
        // Try to get from cache
        const cached = cache.get(cacheKey)
        if (cached !== null) {
          logger.debug('Cache hit', { method: propertyName, cacheKey })
          return cached
        }

        // Execute method and cache result
        const result = await method.apply(this, args)
        
        // Cache the result
        cache.set(cacheKey, result, config.ttl)
        logger.debug('Result cached', { method: propertyName, cacheKey, ttl: config.ttl })
        
        return result
      } catch (error) {
        logger.error('Cache result error', error as Error, undefined, {
          method: propertyName,
          cacheKey,
        })
        
        // Fallback to normal execution
        return method.apply(this, args)
      }
    }
  }
}

/**
 * Cache invalidation helper
 */
export class CacheInvalidator {
  /**
   * Invalidate cache by pattern
   */
  static async invalidatePattern(pattern: string): Promise<number> {
    try {
      const deleted = cache.delPattern(pattern)
      logger.info('Cache invalidated by pattern', { pattern, deleted })
      return deleted
    } catch (error) {
      logger.error('Cache invalidation error', error as Error, undefined, { pattern })
      return 0
    }
  }

  /**
   * Invalidate cache by key
   */
  static async invalidateKey(key: string): Promise<boolean> {
    try {
      const deleted = cache.del(key)
      logger.info('Cache invalidated by key', { key, deleted })
      return deleted
    } catch (error) {
      logger.error('Cache invalidation error', error as Error, undefined, { key })
      return false
    }
  }

  /**
   * Invalidate user-related caches
   */
  static async invalidateUser(userId: string): Promise<number> {
    const patterns = [
      `user:${userId}:*`,
      `achievements:user:${userId}:*`,
      `recommendations:${userId}:*`,
    ]

    let totalDeleted = 0
    for (const pattern of patterns) {
      totalDeleted += await this.invalidatePattern(pattern)
    }

    return totalDeleted
  }

  /**
   * Invalidate anime-related caches
   */
  static async invalidateAnime(animeId: string): Promise<number> {
    const patterns = [
      `anime:${animeId}`,
      `anime:list:*`,
      `reviews:${animeId}:*`,
      `recommendations:*:anime:${animeId}`,
    ]

    let totalDeleted = 0
    for (const pattern of patterns) {
      totalDeleted += await this.invalidatePattern(pattern)
    }

    return totalDeleted
  }

  /**
   * Invalidate all caches
   */
  static async invalidateAll(): Promise<number> {
    return this.invalidatePattern('*')
  }

  /**
   * Invalidate caches for specific operation
   */
  static async invalidateForOperation(operation: string, data: any): Promise<number> {
    let totalDeleted = 0

    switch (operation) {
      case 'user.update':
      case 'user.delete':
        if (data.id) {
          totalDeleted += await this.invalidateUser(data.id)
        }
        break

      case 'anime.update':
      case 'anime.delete':
        if (data.id) {
          totalDeleted += await this.invalidateAnime(data.id)
        }
        break

      case 'achievement.unlock':
      case 'achievement.update':
        if (data.userId) {
          totalDeleted += await this.invalidateUser(data.userId)
        }
        totalDeleted += await this.invalidatePattern('achievements:*')
        break

      case 'review.create':
      case 'review.update':
      case 'review.delete':
        if (data.animeId) {
          totalDeleted += await this.invalidateAnime(data.animeId)
        }
        if (data.userId) {
          totalDeleted += await this.invalidateUser(data.userId)
        }
        totalDeleted += await this.invalidatePattern('reviews:*')
        break

      default:
        // For unknown operations, invalidate all caches
        totalDeleted = await this.invalidateAll()
    }

    return totalDeleted
  }
}

/**
 * Cache warming utility
 * 
 * Note: Database queries are now cached via Prisma Accelerate cacheStrategy.
 * This is kept for non-database data (ML embeddings, computed results, etc.)
 */
export class CacheWarmer {
  /**
   * Warm up frequently accessed non-database data
   * Database queries are handled by Prisma Accelerate automatically
   */
  static async warmUp(): Promise<void> {
    try {
      logger.system('Cache warm-up: Database queries are cached by Prisma Accelerate automatically')
      // No manual warm-up needed - Prisma Accelerate handles database query caching
      // This method is kept for potential future use with computed data
    } catch (error) {
      logger.error('Cache warm-up failed', error as Error, undefined, {})
    }
  }
}

export default {
  createCacheMiddleware,
  cacheResult,
  CacheInvalidator,
  CacheWarmer,
  CACHE_CONFIGS,
}
