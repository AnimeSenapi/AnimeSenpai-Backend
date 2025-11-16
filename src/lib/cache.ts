/**
 * In-Memory Caching System
 * 
 * Provides a comprehensive caching layer for the AnimeSenpai backend
 * with support for different cache strategies and TTL management.
 * Uses in-memory storage with automatic cleanup.
 */

import { logger } from './logger'

// Cache entry interface
interface CacheEntry<T = any> {
  value: T
  expiresAt: number
  createdAt: number
  accessCount: number
  lastAccessed: number
}

// Cache configuration
interface CacheConfig {
  maxSize: number
  defaultTtl: number
  cleanupInterval: number
  maxMemoryUsage: number // in MB
}

// Cache key prefixes for organization
export const CACHE_KEYS = {
  ANIME: 'anime',
  USER: 'user',
  ACHIEVEMENT: 'achievement',
  REVIEW: 'review',
  GENRE: 'genre',
  SESSION: 'session',
  RATE_LIMIT: 'rate_limit',
  RECOMMENDATION: 'recommendation',
} as const

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  ANIME: 3600, // 1 hour
  USER: 1800, // 30 minutes
  ACHIEVEMENT: 7200, // 2 hours
  REVIEW: 1800, // 30 minutes
  GENRE: 86400, // 24 hours
  SESSION: 86400, // 24 hours
  RATE_LIMIT: 900, // 15 minutes
  RECOMMENDATION: 1800, // 30 minutes
  SHORT: 300, // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 3600, // 1 hour
} as const

// Cache strategies
export enum CacheStrategy {
  CACHE_FIRST = 'cache_first',
  CACHE_ASIDE = 'cache_aside',
  WRITE_THROUGH = 'write_through',
  WRITE_BEHIND = 'write_behind',
}

class InMemoryCacheManager {
  private cache = new Map<string, CacheEntry>()
  private config: CacheConfig
  private cleanupTimer: NodeJS.Timeout | null = null
  private isInitialized = false

  constructor() {
    this.config = {
      maxSize: parseInt(process.env.CACHE_MAX_SIZE || '10000'),
      defaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL || '1800'),
      cleanupInterval: parseInt(process.env.CACHE_CLEANUP_INTERVAL || '300000'), // 5 minutes
      maxMemoryUsage: parseInt(process.env.CACHE_MAX_MEMORY_MB || '100'),
    }
  }

  /**
   * Initialize the cache system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupInterval)

    this.isInitialized = true
    logger.system('In-memory cache system initialized', {
      maxSize: this.config.maxSize,
      defaultTtl: this.config.defaultTtl,
      cleanupInterval: this.config.cleanupInterval,
    })
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return this.isInitialized
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    if (!this.isAvailable()) {
      return null
    }

    const entry = this.cache.get(key)
    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    // Update access statistics
    entry.accessCount++
    entry.lastAccessed = Date.now()

    return entry.value as T
  }

  /**
   * Set value in cache with TTL
   */
  set(key: string, value: any, ttl: number = this.config.defaultTtl): boolean {
    if (!this.isAvailable()) {
      return false
    }

    // Check memory usage and evict if necessary
    if (this.cache.size >= this.config.maxSize) {
      this.evictLeastRecentlyUsed()
    }

    const now = Date.now()
    const entry: CacheEntry = {
      value,
      expiresAt: now + (ttl * 1000),
      createdAt: now,
      accessCount: 0,
      lastAccessed: now,
    }

    this.cache.set(key, entry)
    return true
  }

  /**
   * Delete key from cache
   */
  del(key: string): boolean {
    if (!this.isAvailable()) {
      return false
    }

    return this.cache.delete(key)
  }

  /**
   * Delete multiple keys matching pattern
   */
  delPattern(pattern: string): number {
    if (!this.isAvailable()) {
      return 0
    }

    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    let deleted = 0

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
        deleted++
      }
    }

    return deleted
  }

  /**
   * Check if key exists
   */
  exists(key: string): boolean {
    if (!this.isAvailable()) {
      return false
    }

    const entry = this.cache.get(key)
    if (!entry) {
      return false
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  /**
   * Get TTL for key
   */
  ttl(key: string): number {
    if (!this.isAvailable()) {
      return -1
    }

    const entry = this.cache.get(key)
    if (!entry) {
      return -1
    }

    const now = Date.now()
    if (now > entry.expiresAt) {
      this.cache.delete(key)
      return -1
    }

    return Math.ceil((entry.expiresAt - now) / 1000)
  }

  /**
   * Get or set a value in cache
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl: number = this.config.defaultTtl): Promise<T> {
    if (!this.isAvailable()) {
      return await factory()
    }

    // Try to get from cache first
    const cached = this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Generate value using factory function
    const value = await factory()
    
    // Cache the result
    this.set(key, value, ttl)
    
    return value
  }

  /**
   * Increment counter (for rate limiting, etc.)
   */
  incr(key: string, ttl?: number): number {
    if (!this.isAvailable()) {
      return 0
    }

    const entry = this.cache.get(key)
    let count = 1

    if (entry && Date.now() <= entry.expiresAt) {
      count = (entry.value as number) + 1
    }

    this.set(key, count, ttl || this.config.defaultTtl)
    return count
  }

  /**
   * Set expiration for key
   */
  expire(key: string, ttl: number): boolean {
    if (!this.isAvailable()) {
      return false
    }

    const entry = this.cache.get(key)
    if (!entry) {
      return false
    }

    entry.expiresAt = Date.now() + (ttl * 1000)
    return true
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean
    size: number
    maxSize: number
    memoryUsage: number
    hitRate: number
    evicted: number
    expired: number
  }> {
    const now = Date.now()
    let expired = 0
    let totalAccess = 0
    let totalHits = 0

    // Count expired entries and calculate hit rate
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        expired++
        this.cache.delete(key)
      } else {
        totalAccess += entry.accessCount
        totalHits += entry.accessCount
      }
    }

    const memoryUsage = this.getMemoryUsage()
    const hitRate = totalAccess > 0 ? (totalHits / totalAccess) * 100 : 0

    return {
      connected: this.isAvailable(),
      size: this.cache.size,
      maxSize: this.config.maxSize,
      memoryUsage,
      hitRate: Math.round(hitRate * 100) / 100,
      evicted: 0, // Track this if needed
      expired,
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.debug('Cache cleanup completed', { cleaned, remaining: this.cache.size })
    }

    // Check memory usage and evict if necessary
    if (this.getMemoryUsage() > this.config.maxMemoryUsage) {
      this.evictLeastRecentlyUsed()
    }
  }

  /**
   * Evict least recently used entries
   */
  private evictLeastRecentlyUsed(): void {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)

    const toEvict = Math.ceil(entries.length * 0.1) // Evict 10% of entries
    let evicted = 0

    for (let i = 0; i < toEvict && i < entries.length; i++) {
      const entry = entries[i]
      if (entry) {
        this.cache.delete(entry[0])
        evicted++
      }
    }

    if (evicted > 0) {
      logger.debug('Cache eviction completed', { evicted, remaining: this.cache.size })
    }
  }

  /**
   * Get approximate memory usage in MB
   */
  private getMemoryUsage(): number {
    let totalSize = 0

    for (const [key, entry] of this.cache.entries()) {
      totalSize += key.length * 2 // UTF-16 characters
      totalSize += JSON.stringify(entry.value).length * 2
      totalSize += 32 // Entry overhead
    }

    return totalSize / (1024 * 1024) // Convert to MB
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear()
    logger.info('Cache cleared')
  }

  /**
   * Close cache system
   */
  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    this.cache.clear()
    this.isInitialized = false
    logger.info('Cache system closed')
  }
}

// Cache utility functions
export class CacheUtils {
  /**
   * Generate cache key with prefix
   */
  static key(prefix: string, ...parts: (string | number)[]): string {
    return `${prefix}:${parts.join(':')}`
  }

  /**
   * Generate anime cache key
   */
  static animeKey(id: string): string {
    return this.key(CACHE_KEYS.ANIME, id)
  }

  /**
   * Generate user cache key
   */
  static userKey(id: string): string {
    return this.key(CACHE_KEYS.USER, id)
  }

  /**
   * Generate achievement cache key
   */
  static achievementKey(id: string): string {
    return this.key(CACHE_KEYS.ACHIEVEMENT, id)
  }

  /**
   * Generate review cache key
   */
  static reviewKey(id: string): string {
    return this.key(CACHE_KEYS.REVIEW, id)
  }

  /**
   * Generate genre cache key
   */
  static genreKey(id: string): string {
    return this.key(CACHE_KEYS.GENRE, id)
  }

  /**
   * Generate session cache key
   */
  static sessionKey(id: string): string {
    return this.key(CACHE_KEYS.SESSION, id)
  }

  /**
   * Generate rate limit cache key
   */
  static rateLimitKey(identifier: string, endpoint: string): string {
    return this.key(CACHE_KEYS.RATE_LIMIT, identifier, endpoint)
  }

  /**
   * Generate recommendation cache key
   */
  static recommendationKey(userId: string, type: string): string {
    return this.key(CACHE_KEYS.RECOMMENDATION, userId, type)
  }
}

// Cache decorator for methods
export function Cacheable(
  keyGenerator: (...args: any[]) => string,
  ttl: number = CACHE_TTL.MEDIUM,
  strategy: CacheStrategy = CacheStrategy.CACHE_ASIDE
) {
  return function (_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const cacheKey = keyGenerator(...args)
      
      // Try cache first
      if (strategy === CacheStrategy.CACHE_FIRST || strategy === CacheStrategy.CACHE_ASIDE) {
        const cached = cache.get(cacheKey)
        if (cached !== null) {
          return cached
        }
      }

      // Execute method
      const result = await method.apply(this, args)

      // Cache result
      if (strategy === CacheStrategy.CACHE_ASIDE || strategy === CacheStrategy.WRITE_THROUGH) {
        cache.set(cacheKey, result, ttl)
      }

      return result
    }
  }
}

// Singleton cache instance
export const cache = new InMemoryCacheManager()

// Initialize cache on module load
cache.initialize().catch((error) => {
  logger.error('Failed to initialize cache', error as Error, undefined, {})
})

// Export cache keys and TTL for backward compatibility
export const cacheKeys = CacheUtils
export const cacheTTL = CACHE_TTL

export default cache