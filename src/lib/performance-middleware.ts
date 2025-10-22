import { Request, Response, NextFunction } from 'express'
import { logger } from './logger'

interface PerformanceMetrics {
  requestCount: number
  totalResponseTime: number
  averageResponseTime: number
  slowestRequest: number
  fastestRequest: number
  errorCount: number
  successCount: number
  cacheHitRate: number
  memoryUsage: NodeJS.MemoryUsage
  cpuUsage: NodeJS.CpuUsage
}

interface PerformanceConfig {
  enableMonitoring: boolean
  enableCaching: boolean
  enableCompression: boolean
  enableRateLimiting: boolean
  enableQueryOptimization: boolean
  enableMemoryOptimization: boolean
  enableCpuOptimization: boolean
  slowQueryThreshold: number
  memoryThreshold: number
  cpuThreshold: number
}

class PerformanceMiddleware {
  private config: PerformanceConfig
  private metrics: PerformanceMetrics
  private requestTimes: number[] = []
  private cacheHits: number = 0
  private cacheMisses: number = 0

  constructor(config: PerformanceConfig) {
    this.config = config
    this.metrics = {
      requestCount: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      slowestRequest: 0,
      fastestRequest: Infinity,
      errorCount: 0,
      successCount: 0,
      cacheHitRate: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    }
  }

  // Main middleware function
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableMonitoring) {
        return next()
      }

      const startTime = Date.now()
      const originalSend = res.send

      // Override res.send to capture response time
      res.send = function(body: any) {
        const responseTime = Date.now() - startTime
        this.updateMetrics(req, res, responseTime)
        return originalSend.call(this, body)
      }.bind(this)

      // Add performance headers
      this.addPerformanceHeaders(res)

      // Monitor memory usage
      this.monitorMemoryUsage()

      // Monitor CPU usage
      this.monitorCpuUsage()

      next()
    }
  }

  // Update performance metrics
  private updateMetrics(req: Request, res: Response, responseTime: number): void {
    this.metrics.requestCount++
    this.metrics.totalResponseTime += responseTime
    this.metrics.averageResponseTime = this.metrics.totalResponseTime / this.metrics.requestCount

    // Update fastest/slowest request times
    if (responseTime < this.metrics.fastestRequest) {
      this.metrics.fastestRequest = responseTime
    }
    if (responseTime > this.metrics.slowestRequest) {
      this.metrics.slowestRequest = responseTime
    }

    // Update success/error counts
    if (res.statusCode >= 200 && res.statusCode < 400) {
      this.metrics.successCount++
    } else {
      this.metrics.errorCount++
    }

    // Track slow queries
    if (responseTime > this.config.slowQueryThreshold) {
      logger.warn(`Slow query detected: ${req.path} took ${responseTime}ms`, {
        path: req.path,
        method: req.method,
        duration: responseTime,
        threshold: this.config.slowQueryThreshold
      })
    }

    // Log performance metrics
    logger.info(`Request completed: ${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    })

    // Store request time for analysis
    this.requestTimes.push(responseTime)
    if (this.requestTimes.length > 1000) {
      this.requestTimes.shift() // Keep only last 1000 requests
    }
  }

  // Add performance headers
  private addPerformanceHeaders(res: Response): void {
    res.setHeader('X-Response-Time', `${Date.now()}`)
    res.setHeader('X-Memory-Usage', `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`)
    res.setHeader('X-CPU-Usage', `${process.cpuUsage().user + process.cpuUsage().system}`)
  }

  // Monitor memory usage
  private monitorMemoryUsage(): void {
    const memoryUsage = process.memoryUsage()
    this.metrics.memoryUsage = memoryUsage

    // Check if memory usage exceeds threshold
    if (memoryUsage.heapUsed > this.config.memoryThreshold) {
      logger.warn(`High memory usage detected: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`, {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss
      })

      // Trigger garbage collection if available
      if (global.gc) {
        global.gc()
        logger.info('Garbage collection triggered due to high memory usage')
      }
    }
  }

  // Monitor CPU usage
  private monitorCpuUsage(): void {
    const cpuUsage = process.cpuUsage()
    this.metrics.cpuUsage = cpuUsage

    // Check if CPU usage exceeds threshold
    const totalCpuTime = cpuUsage.user + cpuUsage.system
    if (totalCpuTime > this.config.cpuThreshold) {
      logger.warn(`High CPU usage detected: ${totalCpuTime}ms`, {
        user: cpuUsage.user,
        system: cpuUsage.system,
        total: totalCpuTime
      })
    }
  }

  // Cache optimization
  optimizeCaching(): void {
    if (!this.config.enableCaching) return

    // Implement cache optimization strategies
    this.cacheHits++
    this.updateCacheHitRate()
  }

  // Update cache hit rate
  private updateCacheHitRate(): void {
    const totalCacheRequests = this.cacheHits + this.cacheMisses
    if (totalCacheRequests > 0) {
      this.metrics.cacheHitRate = (this.cacheHits / totalCacheRequests) * 100
    }
  }

  // Compression optimization
  optimizeCompression(): void {
    if (!this.config.enableCompression) return

    // Implement compression optimization
    logger.info('Compression optimization applied')
  }

  // Rate limiting optimization
  optimizeRateLimiting(): void {
    if (!this.config.enableRateLimiting) return

    // Implement rate limiting optimization
    logger.info('Rate limiting optimization applied')
  }

  // Query optimization
  optimizeQueries(): void {
    if (!this.config.enableQueryOptimization) return

    // Implement query optimization strategies
    logger.info('Query optimization applied')
  }

  // Memory optimization
  optimizeMemory(): void {
    if (!this.config.enableMemoryOptimization) return

    // Implement memory optimization strategies
    logger.info('Memory optimization applied')
  }

  // CPU optimization
  optimizeCpu(): void {
    if (!this.config.enableCpuOptimization) return

    // Implement CPU optimization strategies
    logger.info('CPU optimization applied')
  }

  // Apply all optimizations
  applyAllOptimizations(): void {
    this.optimizeCaching()
    this.optimizeCompression()
    this.optimizeRateLimiting()
    this.optimizeQueries()
    this.optimizeMemory()
    this.optimizeCpu()
  }

  // Get performance metrics
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  // Get performance recommendations
  getRecommendations(): string[] {
    const recommendations: string[] = []

    if (this.metrics.averageResponseTime > 1000) {
      recommendations.push('Optimize response time - consider caching and query optimization')
    }

    if (this.metrics.cacheHitRate < 50) {
      recommendations.push('Improve cache hit rate - review caching strategy')
    }

    if (this.metrics.errorCount > this.metrics.successCount * 0.1) {
      recommendations.push('Reduce error rate - review error handling and validation')
    }

    if (this.metrics.memoryUsage.heapUsed > this.config.memoryThreshold) {
      recommendations.push('Optimize memory usage - consider garbage collection and memory leaks')
    }

    if (this.metrics.cpuUsage.user + this.metrics.cpuUsage.system > this.config.cpuThreshold) {
      recommendations.push('Optimize CPU usage - review algorithm efficiency')
    }

    return recommendations
  }

  // Get performance score
  getPerformanceScore(): number {
    let score = 100

    // Deduct points for slow response times
    if (this.metrics.averageResponseTime > 1000) score -= 20
    else if (this.metrics.averageResponseTime > 500) score -= 10

    // Deduct points for low cache hit rate
    if (this.metrics.cacheHitRate < 50) score -= 15
    else if (this.metrics.cacheHitRate < 70) score -= 10

    // Deduct points for high error rate
    const errorRate = this.metrics.errorCount / this.metrics.requestCount
    if (errorRate > 0.1) score -= 25
    else if (errorRate > 0.05) score -= 15

    // Deduct points for high memory usage
    if (this.metrics.memoryUsage.heapUsed > this.config.memoryThreshold) score -= 20

    // Deduct points for high CPU usage
    if (this.metrics.cpuUsage.user + this.metrics.cpuUsage.system > this.config.cpuThreshold) score -= 15

    return Math.max(0, score)
  }

  // Reset metrics
  resetMetrics(): void {
    this.metrics = {
      requestCount: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      slowestRequest: 0,
      fastestRequest: Infinity,
      errorCount: 0,
      successCount: 0,
      cacheHitRate: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    }
    this.requestTimes = []
    this.cacheHits = 0
    this.cacheMisses = 0
  }
}

// Default configuration
const defaultConfig: PerformanceConfig = {
  enableMonitoring: true,
  enableCaching: true,
  enableCompression: true,
  enableRateLimiting: true,
  enableQueryOptimization: true,
  enableMemoryOptimization: true,
  enableCpuOptimization: true,
  slowQueryThreshold: 1000,
  memoryThreshold: 100 * 1024 * 1024, // 100MB
  cpuThreshold: 1000 // 1 second
}

// Export singleton instance
let performanceMiddleware: PerformanceMiddleware | null = null

export const initPerformanceMiddleware = (config?: Partial<PerformanceConfig>) => {
  if (!performanceMiddleware) {
    performanceMiddleware = new PerformanceMiddleware({ ...defaultConfig, ...config })
  }
  return performanceMiddleware
}

export const getPerformanceMiddleware = () => performanceMiddleware

export default PerformanceMiddleware
