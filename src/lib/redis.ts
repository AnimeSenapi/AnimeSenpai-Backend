import { createClient, RedisClientType } from 'redis'
import { logger } from './logger'

interface RedisConfig {
  url: string
  password?: string
  db?: number
  retryDelayOnFailover?: number
  maxRetriesPerRequest?: number
  lazyConnect?: boolean
}

class RedisCache {
  private client: RedisClientType | null = null
  private config: RedisConfig
  private isConnected = false

  constructor(config: RedisConfig) {
    this.config = config
  }

  async connect(): Promise<void> {
    try {
      this.client = createClient({
        url: this.config.url,
        password: this.config.password,
        database: this.config.db || 0,
        retryDelayOnFailover: this.config.retryDelayOnFailover || 100,
        maxRetriesPerRequest: this.config.maxRetriesPerRequest || 3,
        lazyConnect: this.config.lazyConnect || true
      })

      this.client.on('error', (error) => {
        logger.error('Redis client error', { error: error.message })
        this.isConnected = false
      })

      this.client.on('connect', () => {
        logger.info('Redis client connected')
        this.isConnected = true
      })

      this.client.on('disconnect', () => {
        logger.warn('Redis client disconnected')
        this.isConnected = false
      })

      await this.client.connect()
      logger.info('Redis cache initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize Redis cache', { error })
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect()
      this.client = null
      this.isConnected = false
      logger.info('Redis cache disconnected')
    }
  }

  private ensureConnected(): void {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client not connected')
    }
  }

  // Basic cache operations
  async get(key: string): Promise<string | null> {
    try {
      this.ensureConnected()
      const value = await this.client!.get(key)
      return value
    } catch (error) {
      logger.error('Redis get operation failed', { key, error })
      return null
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      this.ensureConnected()
      if (ttlSeconds) {
        await this.client!.setEx(key, ttlSeconds, value)
      } else {
        await this.client!.set(key, value)
      }
      return true
    } catch (error) {
      logger.error('Redis set operation failed', { key, error })
      return false
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      this.ensureConnected()
      const result = await this.client!.del(key)
      return result > 0
    } catch (error) {
      logger.error('Redis delete operation failed', { key, error })
      return false
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      this.ensureConnected()
      const result = await this.client!.exists(key)
      return result === 1
    } catch (error) {
      logger.error('Redis exists operation failed', { key, error })
      return false
    }
  }

  // JSON operations
  async getJSON<T>(key: string): Promise<T | null> {
    try {
      const value = await this.get(key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      logger.error('Redis getJSON operation failed', { key, error })
      return null
    }
  }

  async setJSON(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const jsonString = JSON.stringify(value)
      return await this.set(key, jsonString, ttlSeconds)
    } catch (error) {
      logger.error('Redis setJSON operation failed', { key, error })
      return false
    }
  }

  // Hash operations
  async hget(key: string, field: string): Promise<string | null> {
    try {
      this.ensureConnected()
      return await this.client!.hGet(key, field)
    } catch (error) {
      logger.error('Redis hget operation failed', { key, field, error })
      return null
    }
  }

  async hset(key: string, field: string, value: string): Promise<boolean> {
    try {
      this.ensureConnected()
      await this.client!.hSet(key, field, value)
      return true
    } catch (error) {
      logger.error('Redis hset operation failed', { key, field, error })
      return false
    }
  }

  async hgetall(key: string): Promise<Record<string, string> | null> {
    try {
      this.ensureConnected()
      return await this.client!.hGetAll(key)
    } catch (error) {
      logger.error('Redis hgetall operation failed', { key, error })
      return null
    }
  }

  async hdel(key: string, field: string): Promise<boolean> {
    try {
      this.ensureConnected()
      const result = await this.client!.hDel(key, field)
      return result > 0
    } catch (error) {
      logger.error('Redis hdel operation failed', { key, field, error })
      return false
    }
  }

  // List operations
  async lpush(key: string, ...values: string[]): Promise<number> {
    try {
      this.ensureConnected()
      return await this.client!.lPush(key, values)
    } catch (error) {
      logger.error('Redis lpush operation failed', { key, error })
      return 0
    }
  }

  async rpop(key: string): Promise<string | null> {
    try {
      this.ensureConnected()
      return await this.client!.rPop(key)
    } catch (error) {
      logger.error('Redis rpop operation failed', { key, error })
      return null
    }
  }

  async llen(key: string): Promise<number> {
    try {
      this.ensureConnected()
      return await this.client!.lLen(key)
    } catch (error) {
      logger.error('Redis llen operation failed', { key, error })
      return 0
    }
  }

  // Set operations
  async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      this.ensureConnected()
      return await this.client!.sAdd(key, members)
    } catch (error) {
      logger.error('Redis sadd operation failed', { key, error })
      return 0
    }
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    try {
      this.ensureConnected()
      return await this.client!.sRem(key, members)
    } catch (error) {
      logger.error('Redis srem operation failed', { key, error })
      return 0
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      this.ensureConnected()
      return await this.client!.sMembers(key)
    } catch (error) {
      logger.error('Redis smembers operation failed', { key, error })
      return []
    }
  }

  async sismember(key: string, member: string): Promise<boolean> {
    try {
      this.ensureConnected()
      return await this.client!.sIsMember(key, member)
    } catch (error) {
      logger.error('Redis sismember operation failed', { key, member, error })
      return false
    }
  }

  // Expiration operations
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      this.ensureConnected()
      return await this.client!.expire(key, seconds)
    } catch (error) {
      logger.error('Redis expire operation failed', { key, seconds, error })
      return false
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      this.ensureConnected()
      return await this.client!.ttl(key)
    } catch (error) {
      logger.error('Redis ttl operation failed', { key, error })
      return -1
    }
  }

  // Pattern operations
  async keys(pattern: string): Promise<string[]> {
    try {
      this.ensureConnected()
      return await this.client!.keys(pattern)
    } catch (error) {
      logger.error('Redis keys operation failed', { pattern, error })
      return []
    }
  }

  async delPattern(pattern: string): Promise<number> {
    try {
      this.ensureConnected()
      const keys = await this.keys(pattern)
      if (keys.length === 0) return 0
      
      return await this.client!.del(keys)
    } catch (error) {
      logger.error('Redis delPattern operation failed', { pattern, error })
      return 0
    }
  }

  // Cache helpers
  async cacheOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = 3600
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.getJSON<T>(key)
      if (cached !== null) {
        logger.debug('Cache hit', { key })
        return cached
      }

      // Fetch fresh data
      logger.debug('Cache miss, fetching fresh data', { key })
      const data = await fetchFn()
      
      // Store in cache
      await this.setJSON(key, data, ttlSeconds)
      
      return data
    } catch (error) {
      logger.error('Cache or fetch operation failed', { key, error })
      // Fallback to direct fetch
      return await fetchFn()
    }
  }

  // Session management
  async setSession(sessionId: string, data: any, ttlSeconds: number = 86400): Promise<boolean> {
    const key = `session:${sessionId}`
    return await this.setJSON(key, data, ttlSeconds)
  }

  async getSession<T>(sessionId: string): Promise<T | null> {
    const key = `session:${sessionId}`
    return await this.getJSON<T>(key)
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const key = `session:${sessionId}`
    return await this.del(key)
  }

  // Rate limiting
  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<{
    allowed: boolean
    remaining: number
    resetTime: number
  }> {
    try {
      this.ensureConnected()
      const now = Date.now()
      const window = windowSeconds * 1000
      const resetTime = now + window

      // Get current count
      const current = await this.get(key)
      const count = current ? parseInt(current) : 0

      if (count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          resetTime
        }
      }

      // Increment counter
      if (count === 0) {
        await this.set(key, '1', windowSeconds)
      } else {
        await this.client!.incr(key)
      }

      return {
        allowed: true,
        remaining: limit - count - 1,
        resetTime
      }
    } catch (error) {
      logger.error('Rate limit check failed', { key, error })
      // Allow request on error (fail open)
      return {
        allowed: true,
        remaining: limit,
        resetTime: Date.now() + windowSeconds * 1000
      }
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number }> {
    try {
      const start = Date.now()
      await this.client!.ping()
      const latency = Date.now() - start
      
      return { status: 'healthy', latency }
    } catch (error) {
      logger.error('Redis health check failed', { error })
      return { status: 'unhealthy' }
    }
  }

  // Get connection status
  isHealthy(): boolean {
    return this.isConnected && this.client !== null
  }
}

// Redis configuration
const redisConfig: RedisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true
}

export const redisCache = new RedisCache(redisConfig)

// Initialize Redis connection
export async function initializeRedis(): Promise<void> {
  try {
    await redisCache.connect()
  } catch (error) {
    logger.error('Failed to initialize Redis cache', { error })
    // Don't throw error - app should work without Redis
  }
}

export default redisCache
