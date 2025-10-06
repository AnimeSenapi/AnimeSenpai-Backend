/**
 * Simple in-memory cache implementation (no Redis needed)
 * Perfect for caching frequently accessed data like genres, tags, etc.
 */

interface CacheEntry<T> {
  data: T
  expires: number
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>>
  private defaultTTL: number

  constructor(defaultTTL: number = 300000) { // 5 minutes default
    this.cache = new Map()
    this.defaultTTL = defaultTTL
    
    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000)
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }
    
    // Check if expired
    if (Date.now() > entry.expires) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data as T
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const expires = Date.now() + (ttl || this.defaultTTL)
    
    this.cache.set(key, {
      data,
      expires,
    })
  }

  /**
   * Delete value from cache
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  stats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        keysToDelete.push(key)
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key))
    
    if (keysToDelete.length > 0) {
      console.log(`🧹 Cache cleanup: removed ${keysToDelete.length} expired entries`)
    }
  }

  /**
   * Get or set cache value with a factory function
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache
    const cached = this.get<T>(key)
    if (cached !== null) {
      return cached
    }
    
    // If not in cache, call factory function
    const data = await factory()
    
    // Store in cache
    this.set(key, data, ttl)
    
    return data
  }
}

// Export singleton instance
export const cache = new SimpleCache(300000) // 5 minutes default TTL

// Helper functions for common cache keys
export const cacheKeys = {
  genres: () => 'genres:all',
  genreById: (id: string) => `genre:${id}`,
  anime: (slug: string) => `anime:${slug}`,
  animeList: (params: any) => `anime:list:${JSON.stringify(params)}`,
  trending: () => 'anime:trending',
  userProfile: (userId: string) => `user:${userId}`,
} as const

// Cache TTLs
export const cacheTTL = {
  short: 60000,      // 1 minute
  medium: 300000,    // 5 minutes
  long: 900000,      // 15 minutes
  veryLong: 3600000, // 1 hour
} as const

