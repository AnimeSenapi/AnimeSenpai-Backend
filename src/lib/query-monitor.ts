import { logger } from './logger.js'
import { sendAlert, sendPerformanceAlert } from './alerts.js'

interface QueryMetrics {
  timestamp: number
  query: string
  duration: number
  endpoint?: string
  userId?: string
  queryType?: string
  table?: string
}

interface QueryThresholds {
  slowQueryThreshold: number // milliseconds
  alertCooldown: number // milliseconds
  minQueries: number // minimum queries to trigger alert
}

class QueryMonitor {
  private queryMetrics: QueryMetrics[] = []
  private thresholds: QueryThresholds
  private lastAlertTime: number = 0
  private slowQueries: Map<string, number> = new Map() // query hash -> count

  constructor(thresholds: QueryThresholds = {
    slowQueryThreshold: 100, // 100ms
    alertCooldown: 5 * 60 * 1000, // 5 minutes
    minQueries: 3 // minimum 3 slow queries
  }) {
    this.thresholds = thresholds
  }

  recordQuery(
    query: string, 
    duration: number, 
    endpoint?: string, 
    userId?: string,
    queryType?: string,
    table?: string
  ) {
    const now = Date.now()
    
    const queryMetric: QueryMetrics = {
      timestamp: now,
      query: this.sanitizeQuery(query),
      duration,
      ...(endpoint !== undefined && { endpoint }),
      ...(userId !== undefined && { userId }),
      ...(queryType !== undefined && { queryType }),
      ...(table !== undefined && { table })
    }

    this.queryMetrics.push(queryMetric)
    this.cleanupOldMetrics()

    // Check if query is slow
    if (duration > this.thresholds.slowQueryThreshold) {
      this.recordSlowQuery(query, duration, endpoint)
    }
  }

  private sanitizeQuery(query: string): string {
    // Remove sensitive data and normalize query
    return query
      .replace(/\$\d+/g, '$?') // Replace parameter placeholders
      .replace(/'.*?'/g, "'?'") // Replace string literals
      .replace(/\d+/g, '?') // Replace numbers
      .trim()
      .substring(0, 200) // Limit length
  }

  private recordSlowQuery(query: string, duration: number, endpoint?: string) {
    const queryHash = this.getQueryHash(query)
    const count = this.slowQueries.get(queryHash) || 0
    this.slowQueries.set(queryHash, count + 1)

    logger.warn('Slow query detected', {
      query: this.sanitizeQuery(query),
      duration,
      endpoint,
      count: count + 1
    })

    // Check if we should send an alert
    if (count + 1 >= this.thresholds.minQueries) {
      this.checkSlowQueryAlert(queryHash, query, duration, endpoint)
    }
  }

  private getQueryHash(query: string): string {
    // Create a hash of the normalized query
    const normalized = this.sanitizeQuery(query)
    return Buffer.from(normalized).toString('base64').substring(0, 16)
  }

  private async checkSlowQueryAlert(
    queryHash: string, 
    query: string, 
    duration: number, 
    endpoint?: string
  ) {
    const now = Date.now()
    
    // Check cooldown to avoid spam
    if (now - this.lastAlertTime < this.thresholds.alertCooldown) {
      return
    }

    const slowQueryCount = this.slowQueries.get(queryHash) || 0
    
    try {
      await sendPerformanceAlert(
        'Slow Query',
        duration,
        this.thresholds.slowQueryThreshold,
        'ms'
      )

      await sendAlert(
        undefined, // No email alert for slow queries
        {
          webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
          channel: '#alerts',
          message: `🐌 *Slow Query Alert*\n\n` +
                  `*Query:* \`${this.sanitizeQuery(query)}\`\n` +
                  `*Duration:* ${duration}ms (threshold: ${this.thresholds.slowQueryThreshold}ms)\n` +
                  `*Occurrences:* ${slowQueryCount}\n` +
                  `*Endpoint:* ${endpoint || 'unknown'}\n` +
                  `*Time:* ${new Date().toISOString()}`,
          color: 'warning'
        }
      )

      this.lastAlertTime = now
      this.slowQueries.delete(queryHash) // Reset counter after alert
    } catch (error) {
      logger.error('Failed to send slow query alert', error instanceof Error ? error : new Error(String(error)))
    }
  }

  private cleanupOldMetrics() {
    const cutoff = Date.now() - (60 * 60 * 1000) // Keep 1 hour of data
    this.queryMetrics = this.queryMetrics.filter(metric => metric.timestamp > cutoff)
  }

  getSlowQueries(timeWindow: number = 15): QueryMetrics[] {
    const cutoff = Date.now() - (timeWindow * 60 * 1000)
    return this.queryMetrics
      .filter(metric => 
        metric.timestamp > cutoff && 
        metric.duration > this.thresholds.slowQueryThreshold
      )
      .sort((a, b) => b.duration - a.duration)
  }

  getQueryStats(timeWindow: number = 15): {
    totalQueries: number
    slowQueries: number
    averageDuration: number
    slowestQuery: QueryMetrics | null
    topSlowQueries: Array<{ query: string; count: number; avgDuration: number }>
  } {
    const cutoff = Date.now() - (timeWindow * 60 * 1000)
    const recentMetrics = this.queryMetrics.filter(metric => metric.timestamp > cutoff)
    
    const totalQueries = recentMetrics.length
    const slowQueries = recentMetrics.filter(m => m.duration > this.thresholds.slowQueryThreshold)
    const averageDuration = totalQueries > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / totalQueries 
      : 0
    const slowestQuery = recentMetrics.length > 0 
      ? recentMetrics.reduce((max, m) => m.duration > max.duration ? m : max)
      : null

    // Group slow queries by normalized query
    const slowQueryGroups = new Map<string, { count: number; totalDuration: number }>()
    slowQueries.forEach(metric => {
      const normalized = this.sanitizeQuery(metric.query)
      const existing = slowQueryGroups.get(normalized) || { count: 0, totalDuration: 0 }
      slowQueryGroups.set(normalized, {
        count: existing.count + 1,
        totalDuration: existing.totalDuration + metric.duration
      })
    })

    const topSlowQueries = Array.from(slowQueryGroups.entries())
      .map(([query, stats]) => ({
        query,
        count: stats.count,
        avgDuration: stats.totalDuration / stats.count
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10)

    return {
      totalQueries,
      slowQueries: slowQueries.length,
      averageDuration,
      slowestQuery,
      topSlowQueries
    }
  }

  // Database query interceptor
  static interceptDatabaseQuery(originalQuery: any) {
    return async (...args: any[]) => {
      const startTime = Date.now()
      try {
        const result = await originalQuery(...args)
        const duration = Date.now() - startTime
        
        // Record the query
        queryMonitor.recordQuery(
          args[0] || 'unknown query',
          duration,
          undefined,
          undefined,
          'database'
        )
        
        return result
      } catch (error) {
        const duration = Date.now() - startTime
        
        // Record failed query
        queryMonitor.recordQuery(
          args[0] || 'unknown query',
          duration,
          undefined,
          undefined,
          'database'
        )
        
        throw error
      }
    }
  }
}

// Global query monitor instance
export const queryMonitor = new QueryMonitor()

// Middleware for Express.js
export function queryMonitoringMiddleware() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now()
    
    res.on('finish', () => {
      const duration = Date.now() - startTime
      const endpoint = `${req.method} ${req.path}`
      
      // Record API endpoint performance
      queryMonitor.recordQuery(
        `API: ${endpoint}`,
        duration,
        endpoint,
        req.user?.id
      )
    })
    
    next()
  }
}

// Prisma query interceptor
export function setupPrismaQueryMonitoring(prisma: any) {
  const originalQuery = prisma.$queryRaw
  const originalExecute = prisma.$executeRaw
  
  prisma.$queryRaw = QueryMonitor.interceptDatabaseQuery(originalQuery)
  prisma.$executeRaw = QueryMonitor.interceptDatabaseQuery(originalExecute)
  
  // Intercept all model queries
  Object.keys(prisma).forEach(model => {
    if (typeof prisma[model] === 'object' && prisma[model].findMany) {
      const originalFindMany = prisma[model].findMany
      const originalFindFirst = prisma[model].findFirst
      const originalCreate = prisma[model].create
      const originalUpdate = prisma[model].update
      const originalDelete = prisma[model].delete
      
      prisma[model].findMany = QueryMonitor.interceptDatabaseQuery(originalFindMany)
      prisma[model].findFirst = QueryMonitor.interceptDatabaseQuery(originalFindFirst)
      prisma[model].create = QueryMonitor.interceptDatabaseQuery(originalCreate)
      prisma[model].update = QueryMonitor.interceptDatabaseQuery(originalUpdate)
      prisma[model].delete = QueryMonitor.interceptDatabaseQuery(originalDelete)
    }
  })
}

// Function to get current query statistics
export function getQueryStats(timeWindow?: number) {
  return queryMonitor.getQueryStats(timeWindow)
}

// Function to get slow queries
export function getSlowQueries(timeWindow?: number) {
  return queryMonitor.getSlowQueries(timeWindow)
}
