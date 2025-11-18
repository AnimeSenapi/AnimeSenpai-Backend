/**
 * Comprehensive Monitoring Service
 * 
 * Provides detailed monitoring, metrics collection, alerting, and health checks
 * for the AnimeSenpai backend system.
 * 
 * Includes:
 * - Error rate monitoring
 * - System metrics collection
 * - Health checks
 * - Performance monitoring
 */

import { logger } from './logger'
import { cache } from './cache'
import { db } from './db'
import { sendAlert } from './alerts'

// Monitoring configuration
interface MonitoringConfig {
  metricsInterval: number
  healthCheckInterval: number
  alertThresholds: {
    errorRate: number
    responseTime: number
    memoryUsage: number
    cpuUsage: number
  }
  retentionDays: number
}

// System metrics interface
interface SystemMetrics {
  timestamp: number
  server: {
    uptime: number
    memory: NodeJS.MemoryUsage
    cpu: {
      usage: number
      loadAverage: number[]
    }
    requests: {
      total: number
      errors: number
      avgResponseTime: number
    }
  }
  database: {
    connections: number
    queryCount: number
    avgQueryTime: number
    slowQueries: number
  }
  cache: {
    size: number
    hitRate: number
    memoryUsage: number
    evictions: number
  }
  business: {
    activeUsers: number
    totalAnime: number
    totalReviews: number
    newUsersToday: number
  }
}

// Health check status
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: number
  checks: {
    database: HealthCheck
    cache: HealthCheck
    memory: HealthCheck
    disk: HealthCheck
    external: HealthCheck
  }
  overall: {
    score: number
    issues: string[]
    recommendations: string[]
  }
}

interface HealthCheck {
  status: 'pass' | 'fail' | 'warn'
  message: string
  responseTime?: number
  details?: any
}

// Alert types
interface Alert {
  id: string
  type: 'error' | 'performance' | 'resource' | 'business'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  timestamp: number
  resolved: boolean
  resolvedAt?: number
  metadata: any
}

class MonitoringService {
  private config: MonitoringConfig
  private metrics: SystemMetrics[] = []
  private alerts: Alert[] = []
  private isRunning = false
  private intervals: NodeJS.Timeout[] = []

  constructor() {
    this.config = {
      metricsInterval: parseInt(process.env.MONITORING_METRICS_INTERVAL || '60000'), // 1 minute
      healthCheckInterval: parseInt(process.env.MONITORING_HEALTH_INTERVAL || '30000'), // 30 seconds
      alertThresholds: {
        errorRate: parseFloat(process.env.MONITORING_ERROR_RATE_THRESHOLD || '5.0'),
        responseTime: parseInt(process.env.MONITORING_RESPONSE_TIME_THRESHOLD || '1000'),
        memoryUsage: parseInt(process.env.MONITORING_MEMORY_THRESHOLD || '80'),
        cpuUsage: parseInt(process.env.MONITORING_CPU_THRESHOLD || '80'),
      },
      retentionDays: parseInt(process.env.MONITORING_RETENTION_DAYS || '7'),
    }
  }

  /**
   * Start monitoring service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return
    }

    this.isRunning = true
    logger.monitoring('Starting monitoring service', {
      metricsInterval: this.config.metricsInterval,
      healthCheckInterval: this.config.healthCheckInterval,
    })

    // Start metrics collection
    this.intervals.push(
      setInterval(() => this.collectMetrics(), this.config.metricsInterval)
    )

    // Start health checks
    this.intervals.push(
      setInterval(() => this.performHealthChecks(), this.config.healthCheckInterval)
    )

    // Start cleanup
    this.intervals.push(
      setInterval(() => this.cleanup(), 24 * 60 * 60 * 1000) // Daily cleanup
    )

    // Initial health check
    await this.performHealthChecks()
  }

  /**
   * Stop monitoring service
   */
  stop(): void {
    this.isRunning = false
    this.intervals.forEach(interval => clearInterval(interval))
    this.intervals = []
    logger.info('Monitoring service stopped')
  }

  /**
   * Collect system metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = Date.now()
      
      // Server metrics
      const memory = process.memoryUsage()
      const cpu = await this.getCpuUsage()
      
      // Database metrics
      const dbMetrics = await this.getDatabaseMetrics()
      
      // Cache metrics
      const cacheStats = await cache.getStats()
      
      // Business metrics
      const businessMetrics = await this.getBusinessMetrics()

      const metrics: SystemMetrics = {
        timestamp,
        server: {
          uptime: process.uptime(),
          memory,
          cpu,
          requests: {
            total: 0, // Will be updated by request middleware
            errors: 0,
            avgResponseTime: 0,
          },
        },
        database: dbMetrics,
        cache: {
          size: cacheStats.size,
          hitRate: cacheStats.hitRate,
          memoryUsage: cacheStats.memoryUsage,
          evictions: cacheStats.evicted,
        },
        business: businessMetrics,
      }

      this.metrics.push(metrics)
      
      // Keep only last 24 hours of metrics
      const cutoff = timestamp - (24 * 60 * 60 * 1000)
      this.metrics = this.metrics.filter(m => m.timestamp > cutoff)

      // Check for alerts
      await this.checkAlerts(metrics)

    } catch (error) {
      logger.error('Failed to collect metrics', error as Error, undefined, {})
    }
  }

  /**
   * Get CPU usage
   */
  private async getCpuUsage(): Promise<{ usage: number; loadAverage: number[] }> {
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
   * Get database metrics
   */
  private async getDatabaseMetrics(): Promise<{
    connections: number
    queryCount: number
    avgQueryTime: number
    slowQueries: number
  }> {
    try {
      // This would need to be implemented based on your database setup
      // For now, return mock data
      return {
        connections: 1,
        queryCount: 0,
        avgQueryTime: 0,
        slowQueries: 0,
      }
    } catch (error) {
      logger.error('Failed to get database metrics', error as Error, undefined, {})
      return {
        connections: 0,
        queryCount: 0,
        avgQueryTime: 0,
        slowQueries: 0,
      }
    }
  }

  /**
   * Get business metrics
   */
  private async getBusinessMetrics(): Promise<{
    activeUsers: number
    totalAnime: number
    totalReviews: number
    newUsersToday: number
  }> {
    try {
      // Use client without Optimize to avoid tracing issues in monitoring context
      const { getDbWithoutOptimize } = await import('./db')
      const dbWithoutOptimize = getDbWithoutOptimize()
      
      const [activeUsers, totalAnime, totalReviews, newUsersToday] = await Promise.all([
        dbWithoutOptimize.user.count({ where: { lastLoginAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
        dbWithoutOptimize.anime.count(),
        dbWithoutOptimize.userAnimeReview.count(),
        dbWithoutOptimize.user.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
      ])

      return {
        activeUsers,
        totalAnime,
        totalReviews,
        newUsersToday,
      }
    } catch (error) {
      logger.error('Failed to get business metrics', error as Error, undefined, {})
      return {
        activeUsers: 0,
        totalAnime: 0,
        totalReviews: 0,
        newUsersToday: 0,
      }
    }
  }

  /**
   * Perform comprehensive health checks
   */
  private async performHealthChecks(): Promise<void> {
    try {
      const checks = await Promise.all([
        this.checkDatabase(),
        this.checkCache(),
        this.checkMemory(),
        this.checkDisk(),
        this.checkExternalServices(),
      ])

      const healthStatus: HealthStatus = {
        status: 'healthy',
        timestamp: Date.now(),
        checks: {
          database: checks[0],
          cache: checks[1],
          memory: checks[2],
          disk: checks[3],
          external: checks[4],
        },
        overall: {
          score: 100,
          issues: [],
          recommendations: [],
        },
      }

      // Calculate overall health score
      const failedChecks = Object.values(checks).filter(check => check.status === 'fail')
      const warningChecks = Object.values(checks).filter(check => check.status === 'warn')

      if (failedChecks.length > 0) {
        healthStatus.status = 'unhealthy'
        healthStatus.overall.score = Math.max(0, 100 - (failedChecks.length * 25))
        healthStatus.overall.issues = failedChecks.map(check => check.message)
      } else if (warningChecks.length > 0) {
        healthStatus.status = 'degraded'
        healthStatus.overall.score = Math.max(50, 100 - (warningChecks.length * 10))
        healthStatus.overall.issues = warningChecks.map(check => check.message)
      }

      // Store health status
      await this.storeHealthStatus(healthStatus)

    } catch (error) {
      logger.error('Health check failed', error as Error, undefined, {})
    }
  }

  /**
   * Check database health
   */
  private async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now()
    try {
      // Use count instead of raw query for Prisma Accelerate compatibility
      await db.user.count()
      const responseTime = Date.now() - start

      return {
        status: 'pass',
        message: 'Database connection healthy',
        responseTime,
      }
    } catch (error) {
      return {
        status: 'fail',
        message: 'Database connection failed',
        details: { error: (error as Error).message },
      }
    }
  }

  /**
   * Check cache health
   */
  private async checkCache(): Promise<HealthCheck> {
    try {
      const stats = await cache.getStats()
      if (!stats.connected) {
        return {
          status: 'warn',
          message: 'Cache not connected',
        }
      }

      if (stats.hitRate < 50) {
        return {
          status: 'warn',
          message: `Low cache hit rate: ${stats.hitRate}%`,
          details: stats,
        }
      }

      return {
        status: 'pass',
        message: 'Cache healthy',
        details: stats,
      }
    } catch (error) {
      return {
        status: 'fail',
        message: 'Cache check failed',
        details: { error: (error as Error).message },
      }
    }
  }

  /**
   * Check memory health
   */
  private async checkMemory(): Promise<HealthCheck> {
    const memory = process.memoryUsage()
    const usagePercent = (memory.heapUsed / memory.heapTotal) * 100

    if (usagePercent > this.config.alertThresholds.memoryUsage) {
      return {
        status: 'warn',
        message: `High memory usage: ${usagePercent.toFixed(1)}%`,
        details: memory,
      }
    }

    return {
      status: 'pass',
      message: 'Memory usage normal',
      details: memory,
    }
  }

  /**
   * Check disk health
   */
  private async checkDisk(): Promise<HealthCheck> {
    try {
      const fs = require('fs')
      fs.statSync('.') // Basic disk check - in production, you'd want more sophisticated checks
      return {
        status: 'pass',
        message: 'Disk accessible',
      }
    } catch (error) {
      return {
        status: 'fail',
        message: 'Disk check failed',
        details: { error: (error as Error).message },
      }
    }
  }

  /**
   * Check external services
   */
  private async checkExternalServices(): Promise<HealthCheck> {
    try {
      // Check if we can make external requests
      const response = await fetch('https://httpbin.org/status/200', { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      })
      
      if (response.ok) {
        return {
          status: 'pass',
          message: 'External services accessible',
        }
      } else {
        return {
          status: 'warn',
          message: 'External services degraded',
          details: { status: response.status },
        }
      }
    } catch (error) {
      return {
        status: 'warn',
        message: 'External services check failed',
        details: { error: (error as Error).message },
      }
    }
  }

  /**
   * Check for alerts based on metrics
   */
  private async checkAlerts(metrics: SystemMetrics): Promise<void> {
    const alerts: Alert[] = []

    // Check error rate
    if (metrics.server.requests.total > 0) {
      const errorRate = (metrics.server.requests.errors / metrics.server.requests.total) * 100
      if (errorRate > this.config.alertThresholds.errorRate) {
        alerts.push({
          id: `error-rate-${Date.now()}`,
          type: 'error',
          severity: 'high',
          title: 'High Error Rate',
          message: `Error rate is ${errorRate.toFixed(2)}%, threshold is ${this.config.alertThresholds.errorRate}%`,
          timestamp: Date.now(),
          resolved: false,
          metadata: { errorRate, threshold: this.config.alertThresholds.errorRate },
        })
      }
    }

    // Check response time
    if (metrics.server.requests.avgResponseTime > this.config.alertThresholds.responseTime) {
      alerts.push({
        id: `response-time-${Date.now()}`,
        type: 'performance',
        severity: 'medium',
        title: 'Slow Response Time',
        message: `Average response time is ${metrics.server.requests.avgResponseTime}ms, threshold is ${this.config.alertThresholds.responseTime}ms`,
        timestamp: Date.now(),
        resolved: false,
        metadata: { responseTime: metrics.server.requests.avgResponseTime, threshold: this.config.alertThresholds.responseTime },
      })
    }

    // Check memory usage
    const memoryUsagePercent = (metrics.server.memory.heapUsed / metrics.server.memory.heapTotal) * 100
    if (memoryUsagePercent > this.config.alertThresholds.memoryUsage) {
      alerts.push({
        id: `memory-usage-${Date.now()}`,
        type: 'resource',
        severity: 'high',
        title: 'High Memory Usage',
        message: `Memory usage is ${memoryUsagePercent.toFixed(1)}%, threshold is ${this.config.alertThresholds.memoryUsage}%`,
        timestamp: Date.now(),
        resolved: false,
        metadata: { memoryUsage: memoryUsagePercent, threshold: this.config.alertThresholds.memoryUsage },
      })
    }

    // Check cache hit rate
    if (metrics.cache.hitRate < 50) {
      alerts.push({
        id: `cache-hit-rate-${Date.now()}`,
        type: 'performance',
        severity: 'low',
        title: 'Low Cache Hit Rate',
        message: `Cache hit rate is ${metrics.cache.hitRate}%, consider optimizing cache strategy`,
        timestamp: Date.now(),
        resolved: false,
        metadata: { hitRate: metrics.cache.hitRate },
      })
    }

    // Store new alerts
    for (const alert of alerts) {
      this.alerts.push(alert)
      logger.warn('Alert triggered', { alert })
    }
  }

  /**
   * Store health status
   */
  private async storeHealthStatus(healthStatus: HealthStatus): Promise<void> {
    // In a real implementation, you'd store this in a database
    // For now, we'll just log it
    logger.monitoring('Health check completed', { healthStatus })
  }

  /**
   * Cleanup old data
   */
  private cleanup(): void {
    const cutoff = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000)
    
    // Clean up old metrics
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff)
    
    // Clean up old alerts
    this.alerts = this.alerts.filter(a => a.timestamp > cutoff)
    
    logger.debug('Monitoring cleanup completed', {
      metricsCount: this.metrics.length,
      alertsCount: this.alerts.length,
    })
  }

  /**
   * Get current metrics
   */
  getMetrics(): SystemMetrics[] {
    return [...this.metrics]
  }

  /**
   * Get current alerts
   */
  getAlerts(): Alert[] {
    return [...this.alerts]
  }

  /**
   * Get system status
   */
  getSystemStatus(): {
    isRunning: boolean
    metricsCount: number
    alertsCount: number
    activeAlerts: number
  } {
    return {
      isRunning: this.isRunning,
      metricsCount: this.metrics.length,
      alertsCount: this.alerts.length,
      activeAlerts: this.alerts.filter(a => !a.resolved).length,
    }
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.resolved = true
      alert.resolvedAt = Date.now()
      return true
    }
    return false
  }
}

// Singleton instance
export const monitoringService = new MonitoringService()

export default monitoringService

// ============================================================================
// Error Rate Monitoring (integrated from monitoring.ts)
// ============================================================================

interface ErrorMetrics {
  timestamp: number
  errorCount: number
  totalRequests: number
  errorRate: number
  endpoint?: string
  statusCode?: number
  errorType?: string
}

interface AlertThresholds {
  errorRateThreshold: number // percentage
  timeWindow: number // minutes
  minRequests: number // minimum requests to trigger alert
}

class ErrorRateMonitor {
  private errorMetrics: ErrorMetrics[] = []
  private thresholds: AlertThresholds
  private lastAlertTime: number = 0
  private alertCooldown: number = 5 * 60 * 1000 // 5 minutes

  constructor(thresholds: AlertThresholds = {
    errorRateThreshold: 5, // 5% error rate
    timeWindow: 5, // 5 minutes
    minRequests: 10 // minimum 10 requests
  }) {
    this.thresholds = thresholds
  }

  recordError(endpoint?: string, statusCode?: number, errorType?: string) {
    const now = Date.now()
    const errorMetric: ErrorMetrics = {
      timestamp: now,
      errorCount: 1,
      totalRequests: 1,
      errorRate: 100,
      ...(endpoint !== undefined && { endpoint }),
      ...(statusCode !== undefined && { statusCode }),
      ...(errorType !== undefined && { errorType })
    }

    this.errorMetrics.push(errorMetric)
    this.cleanupOldMetrics()
    this.checkErrorRate()
  }

  recordRequest(endpoint?: string, statusCode?: number) {
    const now = Date.now()
    const isError = statusCode && statusCode >= 400
    
    const metric: ErrorMetrics = {
      timestamp: now,
      errorCount: isError ? 1 : 0,
      totalRequests: 1,
      errorRate: isError ? 100 : 0,
      ...(endpoint !== undefined && { endpoint }),
      ...(statusCode !== undefined && { statusCode })
    }

    this.errorMetrics.push(metric)
    this.cleanupOldMetrics()
    this.checkErrorRate()
  }

  private cleanupOldMetrics() {
    const cutoff = Date.now() - (this.thresholds.timeWindow * 60 * 1000)
    this.errorMetrics = this.errorMetrics.filter(metric => metric.timestamp > cutoff)
  }

  private checkErrorRate() {
    const now = Date.now()
    const timeWindow = this.thresholds.timeWindow * 60 * 1000
    const windowStart = now - timeWindow

    // Get metrics within the time window
    const recentMetrics = this.errorMetrics.filter(metric => metric.timestamp >= windowStart)
    
    if (recentMetrics.length === 0) return

    // Calculate aggregated error rate
    const totalErrors = recentMetrics.reduce((sum, metric) => sum + metric.errorCount, 0)
    const totalRequests = recentMetrics.reduce((sum, metric) => sum + metric.totalRequests, 0)
    
    if (totalRequests < this.thresholds.minRequests) return

    const errorRate = (totalErrors / totalRequests) * 100

    // Check if error rate exceeds threshold
    if (errorRate > this.thresholds.errorRateThreshold) {
      // Check cooldown to avoid spam
      if (now - this.lastAlertTime > this.alertCooldown) {
        this.sendErrorRateAlert(errorRate, totalErrors, totalRequests, recentMetrics)
        this.lastAlertTime = now
      }
    }
  }

  private async sendErrorRateAlert(
    errorRate: number, 
    totalErrors: number, 
    totalRequests: number, 
    recentMetrics: ErrorMetrics[]
  ) {
    const alertMessage = {
      title: '🚨 High Error Rate Detected',
      message: `Error rate: ${errorRate.toFixed(2)}% (${totalErrors}/${totalRequests} requests)`,
      details: {
        errorRate: errorRate.toFixed(2),
        totalErrors,
        totalRequests,
        timeWindow: `${this.thresholds.timeWindow} minutes`,
        threshold: `${this.thresholds.errorRateThreshold}%`
      },
      topErrors: this.getTopErrors(recentMetrics),
      timestamp: new Date().toISOString()
    }

    logger.error('High error rate detected', undefined, undefined, alertMessage)

    try {
      // Send alerts using the unified API
      await sendAlert(
        {
          to: process.env.ALERT_EMAIL || 'admin@animesenpai.com',
          subject: `High Error Rate Alert - ${errorRate.toFixed(2)}%`,
          html: this.formatEmailAlert(alertMessage),
          text: this.formatTextAlert(alertMessage)
        },
        {
          webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
          channel: '#alerts',
          message: `🚨 *High Error Rate Alert*\n\n` +
                  `*Error Rate:* ${errorRate.toFixed(2)}%\n` +
                  `*Errors:* ${totalErrors}/${totalRequests} requests\n` +
                  `*Time Window:* ${this.thresholds.timeWindow} minutes\n` +
                  `*Threshold:* ${this.thresholds.errorRateThreshold}%\n\n` +
                  `*Top Errors:*\n${this.formatTopErrors(recentMetrics)}`,
          color: 'danger'
        }
      )
    } catch (error) {
      logger.error('Failed to send error rate alert', error instanceof Error ? error : new Error(String(error)))
    }
  }

  private getTopErrors(metrics: ErrorMetrics[]): Record<string, number> {
    const errorCounts: Record<string, number> = {}
    
    metrics.forEach(metric => {
      if (metric.errorCount > 0) {
        const key = `${metric.endpoint || 'unknown'}:${metric.statusCode || 'unknown'}`
        errorCounts[key] = (errorCounts[key] || 0) + metric.errorCount
      }
    })

    return Object.entries(errorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .reduce((obj, [key, count]) => ({ ...obj, [key]: count }), {})
  }

  private formatTopErrors(metrics: ErrorMetrics[]): string {
    const topErrors = this.getTopErrors(metrics)
    return Object.entries(topErrors)
      .map(([key, count]) => `• ${key}: ${count} errors`)
      .join('\n')
  }

  private formatTextAlert(alert: { details: any; topErrors: Record<string, number>; timestamp: string }): string {
    return `
🚨 High Error Rate Alert

Error Rate: ${alert.details.errorRate}%
Total Errors: ${alert.details.totalErrors}
Total Requests: ${alert.details.totalRequests}
Time Window: ${alert.details.timeWindow}
Threshold: ${alert.details.threshold}

Top Errors:
${Object.entries(alert.topErrors)
  .map(([key, count]) => `• ${key}: ${count} errors`)
  .join('\n')}

Alert generated at: ${alert.timestamp}
    `.trim()
  }

  private formatEmailAlert(alert: { details: any; topErrors: Record<string, number>; timestamp: string }): string {
    return `
      <h2>🚨 High Error Rate Alert</h2>
      <p><strong>Error Rate:</strong> ${alert.details.errorRate}%</p>
      <p><strong>Total Errors:</strong> ${alert.details.totalErrors}</p>
      <p><strong>Total Requests:</strong> ${alert.details.totalRequests}</p>
      <p><strong>Time Window:</strong> ${alert.details.timeWindow}</p>
      <p><strong>Threshold:</strong> ${alert.details.threshold}</p>
      
      <h3>Top Errors:</h3>
      <ul>
        ${Object.entries(alert.topErrors)
          .map(([key, count]) => `<li>${key}: ${count} errors</li>`)
          .join('')}
      </ul>
      
      <p><em>Alert generated at: ${alert.timestamp}</em></p>
    `
  }

  getCurrentMetrics(): {
    errorRate: number
    totalErrors: number
    totalRequests: number
    timeWindow: number
  } {
    const now = Date.now()
    const timeWindow = this.thresholds.timeWindow * 60 * 1000
    const windowStart = now - timeWindow
    const recentMetrics = this.errorMetrics.filter(metric => metric.timestamp >= windowStart)
    
    const totalErrors = recentMetrics.reduce((sum, metric) => sum + metric.errorCount, 0)
    const totalRequests = recentMetrics.reduce((sum, metric) => sum + metric.totalRequests, 0)
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0

    return {
      errorRate,
      totalErrors,
      totalRequests,
      timeWindow: this.thresholds.timeWindow
    }
  }
}

// Global error rate monitor instance
export const errorRateMonitor = new ErrorRateMonitor()

// Middleware to automatically track requests and errors
export function errorRateMiddleware() {
  return (req: any, res: any, next: any) => {
    // Track the request
    res.on('finish', () => {
      const endpoint = `${req.method} ${req.path}`
      const statusCode = res.statusCode
      
      if (statusCode >= 400) {
        errorRateMonitor.recordError(endpoint, statusCode, 'HTTP_ERROR')
      } else {
        errorRateMonitor.recordRequest(endpoint, statusCode)
      }
    })
    
    next()
  }
}

// Function to manually record errors
export function recordError(endpoint?: string, statusCode?: number, errorType?: string) {
  errorRateMonitor.recordError(endpoint, statusCode, errorType)
}

// Function to get current error metrics
export function getErrorMetrics() {
  return errorRateMonitor.getCurrentMetrics()
}
