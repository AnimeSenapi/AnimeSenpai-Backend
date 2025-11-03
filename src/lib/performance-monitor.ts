/**
 * Advanced Performance Monitoring
 * 
 * Comprehensive performance monitoring, profiling, and optimization
 * for the AnimeSenpai backend system.
 */

import { logger } from './logger'
import { cache } from './cache'
import { db } from './db'

// Performance metrics interface
interface PerformanceMetrics {
  timestamp: number
  requestId: string
  endpoint: string
  method: string
  duration: number
  memory: {
    heapUsed: number
    heapTotal: number
    rss: number
    external: number
  }
  cpu: {
    usage: number
    loadAverage: number[]
  }
  database: {
    queryCount: number
    queryTime: number
    slowQueries: number
  }
  cache: {
    hits: number
    misses: number
    hitRate: number
  }
  response: {
    statusCode: number
    size: number
    compressed: boolean
  }
  errors: number
  warnings: number
}

// Performance profile
interface PerformanceProfile {
  functionName: string
  duration: number
  memoryDelta: number
  callCount: number
  averageDuration: number
  minDuration: number
  maxDuration: number
  stackTrace?: string
}

// Performance bottleneck
interface PerformanceBottleneck {
  type: 'database' | 'cache' | 'memory' | 'cpu' | 'network' | 'io'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  impact: number
  recommendations: string[]
  metrics: any
}

// Performance alert
interface PerformanceAlert {
  id: string
  type: 'slow_response' | 'high_memory' | 'cpu_spike' | 'database_slow' | 'cache_miss' | 'error_spike'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  timestamp: number
  metrics: PerformanceMetrics
  resolved: boolean
  resolvedAt?: number
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = []
  private profiles: Map<string, PerformanceProfile> = new Map()
  private alerts: PerformanceAlert[] = []
  private bottlenecks: PerformanceBottleneck[] = []
  private isProfiling = false
  private profilingInterval: NodeJS.Timeout | null = null

  // Performance thresholds
  private thresholds = {
    slowResponse: 1000, // 1 second
    highMemory: 80, // 80% of heap
    cpuSpike: 90, // 90% CPU usage
    databaseSlow: 500, // 500ms
    cacheMissRate: 50, // 50% miss rate
    errorRate: 5 // 5% error rate
  }

  constructor() {
    this.startMonitoring()
  }

  /**
   * Start performance monitoring
   */
  private startMonitoring(): void {
    // Monitor system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics()
    }, 30000)

    // Analyze performance every 5 minutes
    setInterval(() => {
      this.analyzePerformance()
    }, 300000)

    // Clean up old data every hour
    setInterval(() => {
      this.cleanupOldData()
    }, 3600000)
  }

  /**
   * Start profiling a function
   */
  startProfiling(functionName: string): () => PerformanceProfile {
    const startTime = process.hrtime.bigint()
    const startMemory = process.memoryUsage()

    return () => {
      const endTime = process.hrtime.bigint()
      const endMemory = process.memoryUsage()
      
      const duration = Number(endTime - startTime) / 1000000 // Convert to milliseconds
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed

      const profile: PerformanceProfile = {
        functionName,
        duration,
        memoryDelta,
        callCount: 1,
        averageDuration: duration,
        minDuration: duration,
        maxDuration: duration
      }

      this.updateProfile(profile)
      return profile
    }
  }

  /**
   * Update performance profile
   */
  private updateProfile(newProfile: PerformanceProfile): void {
    const existing = this.profiles.get(newProfile.functionName)
    
    if (existing) {
      existing.callCount++
      existing.averageDuration = (existing.averageDuration * (existing.callCount - 1) + newProfile.duration) / existing.callCount
      existing.minDuration = Math.min(existing.minDuration, newProfile.duration)
      existing.maxDuration = Math.max(existing.maxDuration, newProfile.duration)
      existing.memoryDelta += newProfile.memoryDelta
    } else {
      this.profiles.set(newProfile.functionName, newProfile)
    }
  }

  /**
   * Record request performance metrics
   */
  async recordRequestMetrics(
    requestId: string,
    endpoint: string,
    method: string,
    duration: number,
    statusCode: number,
    responseSize: number,
    compressed: boolean = false
  ): Promise<void> {
    const memory = process.memoryUsage()
    const cpu = await this.getCPUUsage()
    const cacheStats = await cache.getStats()

    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      requestId,
      endpoint,
      method,
      duration,
      memory: {
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        rss: memory.rss,
        external: memory.external
      },
      cpu: {
        usage: cpu.usage,
        loadAverage: cpu.loadAverage
      },
      database: {
        queryCount: 0, // This would be tracked by query monitor
        queryTime: 0,
        slowQueries: 0
      },
      cache: {
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: cacheStats.hitRate
      },
      response: {
        statusCode,
        size: responseSize,
        compressed
      },
      errors: statusCode >= 400 ? 1 : 0,
      warnings: 0
    }

    this.metrics.push(metrics)

    // Check for performance issues
    await this.checkPerformanceIssues(metrics)
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    const memory = process.memoryUsage()
    const cpu = await this.getCPUUsage()
    const cacheStats = await cache.getStats()

    // Check for system-level issues
    const memoryUsagePercent = (memory.heapUsed / memory.heapTotal) * 100
    
    if (memoryUsagePercent > this.thresholds.highMemory) {
      await this.createAlert({
        type: 'high_memory',
        severity: 'high',
        message: `High memory usage: ${memoryUsagePercent.toFixed(1)}%`,
        metrics: {
          timestamp: Date.now(),
          requestId: 'system',
          endpoint: 'system',
          method: 'SYSTEM',
          duration: 0,
          memory: {
            heapUsed: memory.heapUsed,
            heapTotal: memory.heapTotal,
            rss: memory.rss,
            external: memory.external
          },
          cpu: { usage: cpu.usage, loadAverage: cpu.loadAverage },
          database: { queryCount: 0, queryTime: 0, slowQueries: 0 },
          cache: { hits: cacheStats.hits, misses: cacheStats.misses, hitRate: cacheStats.hitRate },
          response: { statusCode: 200, size: 0, compressed: false },
          errors: 0,
          warnings: 0
        }
      })
    }

    if (cpu.usage > this.thresholds.cpuSpike) {
      await this.createAlert({
        type: 'cpu_spike',
        severity: 'high',
        message: `High CPU usage: ${cpu.usage.toFixed(1)}%`,
        metrics: {
          timestamp: Date.now(),
          requestId: 'system',
          endpoint: 'system',
          method: 'SYSTEM',
          duration: 0,
          memory: {
            heapUsed: memory.heapUsed,
            heapTotal: memory.heapTotal,
            rss: memory.rss,
            external: memory.external
          },
          cpu: { usage: cpu.usage, loadAverage: cpu.loadAverage },
          database: { queryCount: 0, queryTime: 0, slowQueries: 0 },
          cache: { hits: cacheStats.hits, misses: cacheStats.misses, hitRate: cacheStats.hitRate },
          response: { statusCode: 200, size: 0, compressed: false },
          errors: 0,
          warnings: 0
        }
      })
    }
  }

  /**
   * Get CPU usage
   */
  private async getCPUUsage(): Promise<{ usage: number; loadAverage: number[] }> {
    const cpus = require('os').cpus()
    let totalIdle = 0
    let totalTick = 0

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times]
      }
      totalIdle += cpu.times.idle
    }

    const usage = 100 - ~~(100 * totalIdle / totalTick)
    const loadAverage = require('os').loadavg()

    return { usage, loadAverage }
  }

  /**
   * Check for performance issues
   */
  private async checkPerformanceIssues(metrics: PerformanceMetrics): Promise<void> {
    // Check for slow responses
    if (metrics.duration > this.thresholds.slowResponse) {
      await this.createAlert({
        type: 'slow_response',
        severity: metrics.duration > 5000 ? 'critical' : 'high',
        message: `Slow response: ${metrics.duration}ms for ${metrics.endpoint}`,
        metrics
      })
    }

    // Check for high error rate
    const recentMetrics = this.metrics.filter(m => m.timestamp > Date.now() - 300000) // Last 5 minutes
    const errorRate = (recentMetrics.filter(m => m.errors > 0).length / recentMetrics.length) * 100
    
    if (errorRate > this.thresholds.errorRate) {
      await this.createAlert({
        type: 'error_spike',
        severity: 'high',
        message: `High error rate: ${errorRate.toFixed(1)}%`,
        metrics
      })
    }

    // Check for cache miss rate
    if (metrics.cache.hitRate < (100 - this.thresholds.cacheMissRate)) {
      await this.createAlert({
        type: 'cache_miss',
        severity: 'medium',
        message: `Low cache hit rate: ${metrics.cache.hitRate}%`,
        metrics
      })
    }
  }

  /**
   * Create performance alert
   */
  private async createAlert(alert: Omit<PerformanceAlert, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    const performanceAlert: PerformanceAlert = {
      ...alert,
      id: `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      resolved: false
    }

    this.alerts.push(performanceAlert)

    // Log alert
    const logLevel = alert.severity === 'critical' || alert.severity === 'high' ? 'error' : 'warn'
    logger[logLevel](`Performance alert: ${alert.type}`, undefined, {
      requestId: alert.metrics.requestId,
      endpoint: alert.metrics.endpoint
    }, {
      alertId: performanceAlert.id,
      severity: alert.severity,
      message: alert.message,
      duration: alert.metrics.duration,
      memoryUsage: alert.metrics.memory.heapUsed
    })
  }

  /**
   * Analyze performance patterns
   */
  private analyzePerformance(): void {
    const recentMetrics = this.metrics.filter(m => m.timestamp > Date.now() - 3600000) // Last hour
    
    if (recentMetrics.length === 0) return

    // Analyze bottlenecks
    this.analyzeBottlenecks(recentMetrics)

    // Analyze trends
    this.analyzeTrends(recentMetrics)

    // Generate recommendations
    this.generateRecommendations()
  }

  /**
   * Analyze performance bottlenecks
   */
  private analyzeBottlenecks(metrics: PerformanceMetrics[]): void {
    this.bottlenecks = []

    // Database bottlenecks
    const avgQueryTime = metrics.reduce((sum, m) => sum + m.database.queryTime, 0) / metrics.length
    if (avgQueryTime > this.thresholds.databaseSlow) {
      this.bottlenecks.push({
        type: 'database',
        severity: 'high',
        description: 'Slow database queries detected',
        impact: Math.round((avgQueryTime / this.thresholds.databaseSlow) * 100),
        recommendations: [
          'Add database indexes',
          'Optimize query patterns',
          'Consider query caching',
          'Review database connection pool settings'
        ],
        metrics: { avgQueryTime, threshold: this.thresholds.databaseSlow }
      })
    }

    // Memory bottlenecks
    const avgMemoryUsage = metrics.reduce((sum, m) => sum + (m.memory.heapUsed / m.memory.heapTotal), 0) / metrics.length * 100
    if (avgMemoryUsage > this.thresholds.highMemory) {
      this.bottlenecks.push({
        type: 'memory',
        severity: 'high',
        description: 'High memory usage detected',
        impact: Math.round(avgMemoryUsage),
        recommendations: [
          'Review memory leaks',
          'Optimize data structures',
          'Implement memory pooling',
          'Consider garbage collection tuning'
        ],
        metrics: { avgMemoryUsage, threshold: this.thresholds.highMemory }
      })
    }

    // Cache bottlenecks
    const avgCacheHitRate = metrics.reduce((sum, m) => sum + m.cache.hitRate, 0) / metrics.length
    if (avgCacheHitRate < (100 - this.thresholds.cacheMissRate)) {
      this.bottlenecks.push({
        type: 'cache',
        severity: 'medium',
        description: 'Low cache hit rate detected',
        impact: Math.round(100 - avgCacheHitRate),
        recommendations: [
          'Review cache strategy',
          'Increase cache TTL',
          'Implement cache warming',
          'Optimize cache keys'
        ],
        metrics: { avgCacheHitRate, threshold: 100 - this.thresholds.cacheMissRate }
      })
    }
  }

  /**
   * Analyze performance trends
   */
  private analyzeTrends(metrics: PerformanceMetrics[]): void {
    // Group metrics by 10-minute intervals
    const intervals = new Map<number, PerformanceMetrics[]>()
    
    metrics.forEach(metric => {
      const interval = Math.floor(metric.timestamp / 600000) * 600000 // 10-minute intervals
      if (!intervals.has(interval)) {
        intervals.set(interval, [])
      }
      intervals.get(interval)!.push(metric)
    })

    // Calculate trends
    const sortedIntervals = Array.from(intervals.keys()).sort()
    if (sortedIntervals.length < 2) return

    const firstInterval = intervals.get(sortedIntervals[0])!
    const lastInterval = intervals.get(sortedIntervals[sortedIntervals.length - 1])!

    const firstAvgDuration = firstInterval.reduce((sum, m) => sum + m.duration, 0) / firstInterval.length
    const lastAvgDuration = lastInterval.reduce((sum, m) => sum + m.duration, 0) / lastInterval.length

    const durationTrend = ((lastAvgDuration - firstAvgDuration) / firstAvgDuration) * 100

    if (Math.abs(durationTrend) > 20) {
      logger.info('Performance trend detected', undefined, undefined, {
        trend: durationTrend > 0 ? 'degrading' : 'improving',
        change: `${Math.abs(durationTrend).toFixed(1)}%`,
        firstAvg: Math.round(firstAvgDuration),
        lastAvg: Math.round(lastAvgDuration)
      })
    }
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): void {
    const recommendations: string[] = []

    // Based on bottlenecks
    this.bottlenecks.forEach(bottleneck => {
      recommendations.push(...bottleneck.recommendations)
    })

    // Based on profiles
    const slowestFunctions = Array.from(this.profiles.values())
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, 5)

    slowestFunctions.forEach(profile => {
      if (profile.averageDuration > 100) {
        recommendations.push(`Optimize function: ${profile.functionName} (avg: ${profile.averageDuration.toFixed(1)}ms)`)
      }
    })

    // Based on alerts
    const recentAlerts = this.alerts.filter(a => a.timestamp > Date.now() - 3600000) // Last hour
    const alertTypes = new Map<string, number>()
    
    recentAlerts.forEach(alert => {
      alertTypes.set(alert.type, (alertTypes.get(alert.type) || 0) + 1)
    })

    if (alertTypes.get('slow_response') && alertTypes.get('slow_response')! > 10) {
      recommendations.push('Consider implementing response caching for frequently accessed endpoints')
    }

    if (alertTypes.get('high_memory') && alertTypes.get('high_memory')! > 5) {
      recommendations.push('Review memory usage patterns and implement memory optimization')
    }

    if (recommendations.length > 0) {
      logger.info('Performance recommendations generated', undefined, undefined, {
        count: recommendations.length,
        recommendations: recommendations.slice(0, 10) // Top 10
      })
    }
  }

  /**
   * Clean up old data
   */
  private cleanupOldData(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000) // 24 hours
    
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff)
    this.alerts = this.alerts.filter(a => a.timestamp > cutoff)
    this.bottlenecks = this.bottlenecks.filter(b => b.severity === 'critical' || b.severity === 'high')

    logger.debug('Performance data cleanup completed', {
      remainingMetrics: this.metrics.length,
      remainingAlerts: this.alerts.length,
      remainingBottlenecks: this.bottlenecks.length
    })
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    metrics: {
      totalRequests: number
      averageResponseTime: number
      slowestEndpoint: string
      errorRate: number
      memoryUsage: number
      cacheHitRate: number
    }
    profiles: PerformanceProfile[]
    alerts: {
      total: number
      unresolved: number
      byType: Record<string, number>
    }
    bottlenecks: PerformanceBottleneck[]
    recommendations: string[]
  } {
    const totalRequests = this.metrics.length
    const averageResponseTime = this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests || 0
    
    const endpointStats = new Map<string, { count: number; totalTime: number }>()
    this.metrics.forEach(m => {
      const existing = endpointStats.get(m.endpoint) || { count: 0, totalTime: 0 }
      endpointStats.set(m.endpoint, {
        count: existing.count + 1,
        totalTime: existing.totalTime + m.duration
      })
    })

    const slowestEndpoint = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({ endpoint, avgTime: stats.totalTime / stats.count }))
      .sort((a, b) => b.avgTime - a.avgTime)[0]?.endpoint || 'unknown'

    const errorRate = (this.metrics.filter(m => m.errors > 0).length / totalRequests) * 100 || 0
    const memoryUsage = this.metrics.length > 0 ? 
      (this.metrics[this.metrics.length - 1].memory.heapUsed / this.metrics[this.metrics.length - 1].memory.heapTotal) * 100 : 0
    const cacheHitRate = this.metrics.length > 0 ? 
      this.metrics[this.metrics.length - 1].cache.hitRate : 0

    const alertTypes: Record<string, number> = {}
    this.alerts.forEach(alert => {
      alertTypes[alert.type] = (alertTypes[alert.type] || 0) + 1
    })

    const recommendations: string[] = []
    this.bottlenecks.forEach(bottleneck => {
      recommendations.push(...bottleneck.recommendations.slice(0, 2)) // Top 2 per bottleneck
    })

    return {
      metrics: {
        totalRequests,
        averageResponseTime: Math.round(averageResponseTime),
        slowestEndpoint,
        errorRate: Math.round(errorRate * 100) / 100,
        memoryUsage: Math.round(memoryUsage * 100) / 100,
        cacheHitRate: Math.round(cacheHitRate * 100) / 100
      },
      profiles: Array.from(this.profiles.values()).sort((a, b) => b.averageDuration - a.averageDuration),
      alerts: {
        total: this.alerts.length,
        unresolved: this.alerts.filter(a => !a.resolved).length,
        byType: alertTypes
      },
      bottlenecks: this.bottlenecks,
      recommendations: [...new Set(recommendations)].slice(0, 10) // Unique, top 10
    }
  }

  /**
   * Start profiling mode
   */
  startProfilingMode(): void {
    this.isProfiling = true
    this.profilingInterval = setInterval(() => {
      this.collectProfilingData()
    }, 1000) // Collect every second

    logger.monitoring('Performance profiling started')
  }

  /**
   * Stop profiling mode
   */
  stopProfilingMode(): void {
    this.isProfiling = false
    if (this.profilingInterval) {
      clearInterval(this.profilingInterval)
      this.profilingInterval = null
    }

    logger.info('Performance profiling stopped')
  }

  /**
   * Collect profiling data
   */
  private collectProfilingData(): void {
    if (!this.isProfiling) return

    const memory = process.memoryUsage()
    const cpu = this.getCPUUsage()

    // Log profiling data
    logger.debug('Profiling data collected', undefined, undefined, {
      memory: {
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
        rss: Math.round(memory.rss / 1024 / 1024)
      },
      profiles: this.profiles.size,
      activeAlerts: this.alerts.filter(a => !a.resolved).length
    })
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()

export default performanceMonitor
