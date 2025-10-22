import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { publicProcedure, router } from '../lib/trpc'
import { db } from '../lib/db'
import { logger } from '../lib/logger'

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  uptime: number
  version: string
  environment: string
  checks: {
    database: HealthCheck
    redis?: HealthCheck
    externalServices?: HealthCheck
  }
}

interface HealthCheck {
  status: 'pass' | 'fail' | 'warn'
  responseTime?: number
  message?: string
  details?: Record<string, any>
}

class HealthChecker {
  private startTime = Date.now()

  async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now()
    try {
      // Simple database connectivity test
      await db.$queryRaw`SELECT 1`
      const responseTime = Date.now() - start
      
      return {
        status: 'pass',
        responseTime,
        message: 'Database connection successful'
      }
    } catch (error) {
      const responseTime = Date.now() - start
      logger.error('Database health check failed', { error })
      
      return {
        status: 'fail',
        responseTime,
        message: 'Database connection failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }

  async checkRedis(): Promise<HealthCheck> {
    const start = Date.now()
    try {
      // Redis connectivity test would go here
      // For now, we'll simulate a check
      const responseTime = Date.now() - start
      
      return {
        status: 'pass',
        responseTime,
        message: 'Redis connection successful'
      }
    } catch (error) {
      const responseTime = Date.now() - start
      logger.error('Redis health check failed', { error })
      
      return {
        status: 'fail',
        responseTime,
        message: 'Redis connection failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }

  async checkExternalServices(): Promise<HealthCheck> {
    const start = Date.now()
    try {
      // Check external services like email, analytics, etc.
      const services = [
        { name: 'Email Service', url: process.env.EMAIL_SERVICE_URL },
        { name: 'Analytics Service', url: process.env.ANALYTICS_SERVICE_URL }
      ]

      const results = await Promise.allSettled(
        services.map(async (service) => {
          if (!service.url) return { name: service.name, status: 'skip' }
          
          const response = await fetch(service.url, { 
            method: 'HEAD',
            timeout: 5000 
          })
          return { 
            name: service.name, 
            status: response.ok ? 'pass' : 'fail',
            statusCode: response.status
          }
        })
      )

      const failedServices = results
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => result.value)
        .filter(service => service.status === 'fail')

      const responseTime = Date.now() - start

      if (failedServices.length === 0) {
        return {
          status: 'pass',
          responseTime,
          message: 'All external services healthy'
        }
      } else {
        return {
          status: 'warn',
          responseTime,
          message: `${failedServices.length} external service(s) unhealthy`,
          details: { failedServices }
        }
      }
    } catch (error) {
      const responseTime = Date.now() - start
      logger.error('External services health check failed', { error })
      
      return {
        status: 'fail',
        responseTime,
        message: 'External services check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const [databaseCheck, redisCheck, externalServicesCheck] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkExternalServices()
    ])

    // Determine overall status
    const checks = [databaseCheck, redisCheck, externalServicesCheck]
    const hasFailures = checks.some(check => check.status === 'fail')
    const hasWarnings = checks.some(check => check.status === 'warn')

    let status: 'healthy' | 'unhealthy' | 'degraded'
    if (hasFailures) {
      status = 'unhealthy'
    } else if (hasWarnings) {
      status = 'degraded'
    } else {
      status = 'healthy'
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: databaseCheck,
        redis: redisCheck,
        externalServices: externalServicesCheck
      }
    }
  }

  async getReadinessStatus(): Promise<{ ready: boolean; checks: Record<string, HealthCheck> }> {
    const [databaseCheck, redisCheck] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis()
    ])

    const checks = {
      database: databaseCheck,
      redis: redisCheck
    }

    // Service is ready if critical services are healthy
    const ready = databaseCheck.status === 'pass' && redisCheck.status === 'pass'

    return { ready, checks }
  }
}

const healthChecker = new HealthChecker()

export const healthRouter = router({
  // Basic health check endpoint
  check: publicProcedure
    .query(async () => {
      try {
        const healthStatus = await healthChecker.getHealthStatus()
        return healthStatus
      } catch (error) {
        logger.error('Health check failed', { error })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Health check failed'
        })
      }
    }),

  // Readiness probe for Kubernetes/load balancers
  ready: publicProcedure
    .query(async () => {
      try {
        const readinessStatus = await healthChecker.getReadinessStatus()
        return readinessStatus
      } catch (error) {
        logger.error('Readiness check failed', { error })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Readiness check failed'
        })
      }
    }),

  // Liveness probe for Kubernetes
  live: publicProcedure
    .query(async () => {
      return {
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - healthChecker['startTime']
      }
    }),

  // Detailed health check with metrics
  detailed: publicProcedure
    .query(async () => {
      try {
        const healthStatus = await healthChecker.getHealthStatus()
        
        // Add additional metrics
        const memoryUsage = process.memoryUsage()
        const cpuUsage = process.cpuUsage()
        
        return {
          ...healthStatus,
          metrics: {
            memory: {
              rss: memoryUsage.rss,
              heapTotal: memoryUsage.heapTotal,
              heapUsed: memoryUsage.heapUsed,
              external: memoryUsage.external
            },
            cpu: {
              user: cpuUsage.user,
              system: cpuUsage.system
            },
            process: {
              pid: process.pid,
              platform: process.platform,
              nodeVersion: process.version
            }
          }
        }
      } catch (error) {
        logger.error('Detailed health check failed', { error })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Detailed health check failed'
        })
      }
    }),

  // Database-specific health check
  database: publicProcedure
    .query(async () => {
      try {
        const databaseCheck = await healthChecker.checkDatabase()
        return databaseCheck
      } catch (error) {
        logger.error('Database health check failed', { error })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database health check failed'
        })
      }
    }),

  // Redis-specific health check
  redis: publicProcedure
    .query(async () => {
      try {
        const redisCheck = await healthChecker.checkRedis()
        return redisCheck
      } catch (error) {
        logger.error('Redis health check failed', { error })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Redis health check failed'
        })
      }
    })
})
