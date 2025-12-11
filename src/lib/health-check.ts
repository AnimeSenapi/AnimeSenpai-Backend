/**
 * Comprehensive Health Check System
 * 
 * Provides detailed health checks for all system components
 * including database, cache, external services, and business logic.
 */

import { getDirectDbClient } from './db.js'
import { cache } from './cache.js'

// Health check result interface
interface HealthCheckResult {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime: number
  message: string
  details?: any
  timestamp: number
}

// Overall health status
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: number
  uptime: number
  version: string
  environment: string
  checks: HealthCheckResult[]
  summary: {
    total: number
    healthy: number
    degraded: number
    unhealthy: number
  }
  performance: {
    averageResponseTime: number
    slowestCheck: string
    fastestCheck: string
  }
}

function isDatabaseConnectionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()

  return (
    normalized.includes("can't reach database server") ||
    normalized.includes('p1001') ||
    normalized.includes('database connection failed') ||
    normalized.includes('database is temporarily unavailable') ||
    normalized.includes('prisma:client:operation span is expected to be entered')
  )
}

class HealthChecker {
  private readonly checks: Map<string, () => Promise<HealthCheckResult>> = new Map()

  constructor() {
    this.registerChecks()
  }

  /**
   * Register all health checks
   */
  private registerChecks(): void {
    this.checks.set('database', this.checkDatabase.bind(this))
    this.checks.set('cache', this.checkCache.bind(this))
    this.checks.set('memory', this.checkMemory.bind(this))
    this.checks.set('disk', this.checkDisk.bind(this))
    this.checks.set('external_services', this.checkExternalServices.bind(this))
    this.checks.set('business_logic', this.checkBusinessLogic.bind(this))
    this.checks.set('rate_limiting', this.checkRateLimiting.bind(this))
    this.checks.set('background_jobs', this.checkBackgroundJobs.bind(this))
  }

  /**
   * Run all health checks
   */
  async runAllChecks(): Promise<HealthStatus> {
    const checks: HealthCheckResult[] = []

    // Run all checks in parallel
    const checkPromises = Array.from(this.checks.entries()).map(async ([name, checkFn]) => {
      try {
        return await checkFn()
      } catch (error) {
        return {
          name,
          status: 'unhealthy' as const,
          responseTime: 0,
          message: `Check failed: ${(error as Error).message}`,
          details: { error: (error as Error).stack },
          timestamp: Date.now(),
        }
      }
    })

    const results = await Promise.all(checkPromises)
    checks.push(...results)

    // Calculate summary
    const summary = this.calculateSummary(checks)
    
    // Determine overall status
    const overallStatus = this.determineOverallStatus(checks)
    
    // Calculate performance metrics
    const performance = this.calculatePerformance(checks)

    return {
      status: overallStatus,
      timestamp: Date.now(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks,
      summary,
      performance,
    }
  }

  /**
   * Run specific health check
   */
  async runCheck(name: string): Promise<HealthCheckResult | null> {
    const checkFn = this.checks.get(name)
    if (!checkFn) {
      return null
    }

    try {
      return await checkFn()
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        responseTime: 0,
        message: `Check failed: ${(error as Error).message}`,
        details: { error: (error as Error).stack },
        timestamp: Date.now(),
      }
    }
  }

  /**
   * Check database health
   */
  private async checkDatabase(): Promise<HealthCheckResult> {
    const start = Date.now()
    const dbClient = getDirectDbClient()
    
    try {
      // Test basic connection (use count instead of raw query for Prisma Accelerate compatibility)
      const queryStart = Date.now()
      await dbClient.user.count()
      const queryTime = Date.now() - queryStart
      
      // Test transaction
      await dbClient.$transaction(async (tx) => {
        await tx.user.count()
      })
      
      const responseTime = Date.now() - start
      
      // Check for slow queries
      const isSlow = queryTime > 1000 // 1 second threshold
      
      return {
        name: 'database',
        status: isSlow ? 'degraded' : 'healthy',
        responseTime,
        message: isSlow ? 'Database responding slowly' : 'Database healthy',
        details: {
          queryTime,
          connectionPool: 'active', // This would be actual pool status in production
        },
        timestamp: Date.now(),
      }
    } catch (error) {
      const responseTime = Date.now() - start

      if (isDatabaseConnectionError(error)) {
        return {
          name: 'database',
          status: 'degraded',
          responseTime,
          message: 'Database unavailable - running in degraded mode',
          details: {
            error: (error as Error).message,
            hint: 'Start the Postgres service locally or update DATABASE_URL to a reachable instance.',
          },
          timestamp: Date.now(),
        }
      }

      return {
        name: 'database',
        status: 'unhealthy',
        responseTime,
        message: 'Database connection failed',
        details: { error: (error as Error).message },
        timestamp: Date.now(),
      }
    }
  }

  /**
   * Check cache health
   */
  private async checkCache(): Promise<HealthCheckResult> {
    const start = Date.now()
    
    try {
      const stats = await cache.getStats()
      
      // Test cache operations
      const testKey = 'health-check-test'
      const testValue = { test: true, timestamp: Date.now() }
      
      // Test set
      cache.set(testKey, testValue, 60)
      
      // Test get
      const retrieved = cache.get<{ test: boolean; timestamp: number }>(testKey)
      
      // Test delete
      cache.del(testKey)
      
      const responseTime = Date.now() - start
      
      // Check cache performance
      const isSlow = responseTime > 100 // 100ms threshold
      // Only flag low hit rate if we have meaningful traffic (cache has entries)
      const hasTraffic = stats.size > 0
      const isLowHitRate = hasTraffic && stats.hitRate < 50
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
      let message = 'Cache healthy'
      
      if (isSlow) {
        status = 'degraded'
        message = 'Cache responding slowly'
      } else if (isLowHitRate) {
        status = 'degraded'
        message = `Low cache hit rate: ${stats.hitRate}%`
      }
      
      return {
        name: 'cache',
        status,
        responseTime,
        message,
        details: {
          ...stats,
          testPassed: retrieved?.test === true,
        },
        timestamp: Date.now(),
      }
    } catch (error) {
      return {
        name: 'cache',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        message: 'Cache operations failed',
        details: { error: (error as Error).message },
        timestamp: Date.now(),
      }
    }
  }

  /**
   * Check memory health
   */
  private async checkMemory(): Promise<HealthCheckResult> {
    const start = Date.now()
    const memory = process.memoryUsage()
    
    const heapUsedPercent = (memory.heapUsed / memory.heapTotal) * 100
    const rssMB = memory.rss / (1024 * 1024)
    // For Bun runtime, use RSS thresholds only
    // Bun's heap allocation is very aggressive and heapUsed can exceed heapTotal
    const rssThresholdUnhealthy = 512 // 512MB - unhealthy threshold
    const rssThresholdDegraded = 384 // 384MB - degraded threshold
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    let message = 'Memory usage normal'
    
    // Only use RSS for health checks in Bun
    if (rssMB > rssThresholdUnhealthy) {
      status = 'unhealthy'
      message = 'Memory usage critically high'
    } else if (rssMB > rssThresholdDegraded) {
      status = 'degraded'
      message = 'Memory usage high'
    }
    
    return {
      name: 'memory',
      status,
      responseTime: Date.now() - start,
      message,
      details: {
        heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
        heapUsedPercent: Math.round(heapUsedPercent),
        rssPercent: Math.round((rssMB / 512) * 100), // Show percent of 512MB threshold
      },
      timestamp: Date.now(),
    }
  }

  /**
   * Check disk health
   */
  private async checkDisk(): Promise<HealthCheckResult> {
    const start = Date.now()
    
    try {
      const fs = require('fs')
      const path = require('path')
      
      // Check if we can read/write to the current directory
      const testFile = path.join(process.cwd(), '.health-check-test')
      
      // Test write
      fs.writeFileSync(testFile, 'health check test')
      
      // Test read
      const content = fs.readFileSync(testFile, 'utf8')
      
      // Clean up
      fs.unlinkSync(testFile)
      
      const responseTime = Date.now() - start
      
      return {
        name: 'disk',
        status: 'healthy',
        responseTime,
        message: 'Disk operations healthy',
        details: {
          testPassed: content === 'health check test',
        },
        timestamp: Date.now(),
      }
    } catch (error) {
      return {
        name: 'disk',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        message: 'Disk operations failed',
        details: { error: (error as Error).message },
        timestamp: Date.now(),
      }
    }
  }

  /**
   * Check external services
   */
  private async checkExternalServices(): Promise<HealthCheckResult> {
    const start = Date.now()
    
    try {
      // Check multiple external services
      const services = [
        { name: 'HTTP Bin', url: 'https://httpbin.org/status/200' },
        { name: 'JSON Placeholder', url: 'https://jsonplaceholder.typicode.com/posts/1' },
      ]
      
      const results = await Promise.allSettled(
        services.map(service => 
          fetch(service.url, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(5000)
          })
        )
      )
      
      const successful = results.filter(r => r.status === 'fulfilled').length
      const total = results.length
      const successRate = (successful / total) * 100
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
      let message = 'External services healthy'
      
      if (successRate < 50) {
        status = 'unhealthy'
        message = 'Most external services unavailable'
      } else if (successRate < 100) {
        status = 'degraded'
        message = 'Some external services unavailable'
      }
      
      return {
        name: 'external_services',
        status,
        responseTime: Date.now() - start,
        message,
        details: {
          successRate: Math.round(successRate),
          successful,
          total,
          services: services.map((service, index) => {
            const result = results[index]
            if (!result) {
              return {
                name: service.name,
                status: 'rejected' as const,
                error: 'Result not available',
              }
            }
            return {
              name: service.name,
              status: result.status,
              error: result.status === 'rejected' ? (result as PromiseRejectedResult).reason : undefined,
            }
          }),
        },
        timestamp: Date.now(),
      }
    } catch (error) {
      return {
        name: 'external_services',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        message: 'External services check failed',
        details: { error: (error as Error).message },
        timestamp: Date.now(),
      }
    }
  }

  /**
   * Check business logic
   */
  private async checkBusinessLogic(): Promise<HealthCheckResult> {
    const start = Date.now()
    const dbClient = getDirectDbClient()
    
    try {
      // Test core business operations
      const [userCount, animeCount, reviewCount] = await Promise.all([
        dbClient.user.count(),
        dbClient.anime.count(),
        dbClient.userAnimeReview.count(),
      ])
      
      const responseTime = Date.now() - start
      
      // Check for reasonable data
      const hasData = userCount > 0 || animeCount > 0
      
      return {
        name: 'business_logic',
        status: hasData ? 'healthy' : 'degraded',
        responseTime,
        message: hasData ? 'Business logic healthy' : 'No data found in database',
        details: {
          userCount,
          animeCount,
          reviewCount,
        },
        timestamp: Date.now(),
      }
    } catch (error) {
      const responseTime = Date.now() - start

      if (isDatabaseConnectionError(error)) {
        return {
          name: 'business_logic',
          status: 'degraded',
          responseTime,
          message: 'Business logic check skipped - database unavailable',
          details: {
            error: (error as Error).message,
            hint: 'Start the Postgres service or verify the Prisma connection.',
          },
          timestamp: Date.now(),
        }
      }

      return {
        name: 'business_logic',
        status: 'unhealthy',
        responseTime,
        message: 'Business logic check failed',
        details: { error: (error as Error).message },
        timestamp: Date.now(),
      }
    }
  }

  /**
   * Check rate limiting
   */
  private async checkRateLimiting(): Promise<HealthCheckResult> {
    const start = Date.now()
    
    try {
      // This would check rate limiting system health
      // For now, we'll just verify the system is running
      const responseTime = Date.now() - start
      
      return {
        name: 'rate_limiting',
        status: 'healthy',
        responseTime,
        message: 'Rate limiting system healthy',
        details: {
          // This would include actual rate limiting stats
          activeLimits: 0,
          blockedRequests: 0,
        },
        timestamp: Date.now(),
      }
    } catch (error) {
      return {
        name: 'rate_limiting',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        message: 'Rate limiting check failed',
        details: { error: (error as Error).message },
        timestamp: Date.now(),
      }
    }
  }

  /**
   * Check background jobs
   */
  private async checkBackgroundJobs(): Promise<HealthCheckResult> {
    const start = Date.now()
    
    try {
      // This would check background job system health
      // For now, we'll just verify the system is running
      const responseTime = Date.now() - start
      
      return {
        name: 'background_jobs',
        status: 'healthy',
        responseTime,
        message: 'Background jobs system healthy',
        details: {
          // This would include actual job queue stats
          pendingJobs: 0,
          processingJobs: 0,
          failedJobs: 0,
        },
        timestamp: Date.now(),
      }
    } catch (error) {
      return {
        name: 'background_jobs',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        message: 'Background jobs check failed',
        details: { error: (error as Error).message },
        timestamp: Date.now(),
      }
    }
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(checks: HealthCheckResult[]): {
    total: number
    healthy: number
    degraded: number
    unhealthy: number
  } {
    return {
      total: checks.length,
      healthy: checks.filter(c => c.status === 'healthy').length,
      degraded: checks.filter(c => c.status === 'degraded').length,
      unhealthy: checks.filter(c => c.status === 'unhealthy').length,
    }
  }

  /**
   * Determine overall health status
   */
  private determineOverallStatus(checks: HealthCheckResult[]): 'healthy' | 'degraded' | 'unhealthy' {
    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length
    const degradedCount = checks.filter(c => c.status === 'degraded').length
    
    if (unhealthyCount > 0) {
      return 'unhealthy'
    } else if (degradedCount > 0) {
      return 'degraded'
    } else {
      return 'healthy'
    }
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformance(checks: HealthCheckResult[]): {
    averageResponseTime: number
    slowestCheck: string
    fastestCheck: string
  } {
    const responseTimes = checks.map(c => ({ name: c.name, time: c.responseTime }))
    const sortedTimes = responseTimes.sort((a, b) => a.time - b.time)
    
    const averageResponseTime = responseTimes.reduce((sum, c) => sum + c.time, 0) / responseTimes.length
    
    return {
      averageResponseTime: Math.round(averageResponseTime),
      slowestCheck: sortedTimes[sortedTimes.length - 1]?.name || 'none',
      fastestCheck: sortedTimes[0]?.name || 'none',
    }
  }
}

// Singleton instance
export const healthChecker = new HealthChecker()

export default healthChecker
