import { logger } from './logger'
import { sendHealthCheckAlert } from './alerts'

interface HealthCheck {
  service: string
  status: 'up' | 'down'
  timestamp: number
  responseTime?: number
  details?: string
}

interface UptimeConfig {
  checkInterval: number // milliseconds
  timeout: number // milliseconds
  retries: number
  endpoints: Array<{
    name: string
    url: string
    expectedStatus?: number
    timeout?: number
  }>
}

class UptimeMonitor {
  private config: UptimeConfig
  private healthChecks: Map<string, HealthCheck> = new Map()
  private intervals: Map<string, NodeJS.Timeout> = new Map()
  private isRunning = false

  constructor(config: Partial<UptimeConfig> = {}) {
    this.config = {
      checkInterval: 60000, // 1 minute
      timeout: 10000, // 10 seconds
      retries: 3,
      endpoints: [
        {
          name: 'API Health',
          url: process.env.API_URL + '/health' || 'http://localhost:3001/health',
          expectedStatus: 200
        },
        {
          name: 'Database',
          url: process.env.DATABASE_URL ? 'internal://database' : 'http://localhost:5432',
          expectedStatus: 200
        }
      ],
      ...config
    }
  }

  start() {
    if (this.isRunning) return

    this.isRunning = true
    logger.info('Starting uptime monitoring', { 
      endpoints: this.config.endpoints.length,
      interval: this.config.checkInterval 
    })

    // Start monitoring each endpoint
    this.config.endpoints.forEach(endpoint => {
      this.startEndpointMonitoring(endpoint)
    })
  }

  stop() {
    this.isRunning = false
    
    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval))
    this.intervals.clear()
    
    logger.info('Stopped uptime monitoring')
  }

  private startEndpointMonitoring(endpoint: any) {
    const checkEndpoint = async () => {
      try {
        const startTime = Date.now()
        const healthCheck = await this.performHealthCheck(endpoint)
        const responseTime = Date.now() - startTime

        healthCheck.responseTime = responseTime
        this.healthChecks.set(endpoint.name, healthCheck)

        // Log the health check
        logger.info('Health check completed', {
          service: endpoint.name,
          status: healthCheck.status,
          responseTime,
          url: endpoint.url
        })

        // Send alert if service is down
        if (healthCheck.status === 'down') {
          await sendHealthCheckAlert(
            endpoint.name,
            healthCheck.status,
            healthCheck.details
          )
        }
      } catch (error) {
        logger.error('Health check failed', { 
          error, 
          service: endpoint.name,
          url: endpoint.url 
        })
      }
    }

    // Perform initial check
    checkEndpoint()

    // Set up interval
    const interval = setInterval(checkEndpoint, this.config.checkInterval)
    this.intervals.set(endpoint.name, interval)
  }

  private async performHealthCheck(endpoint: any): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      if (endpoint.url === 'internal://database') {
        return await this.checkDatabaseHealth()
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), endpoint.timeout || this.config.timeout)

      const response = await fetch(endpoint.url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'AnimeSenpai-UptimeMonitor/1.0'
        }
      })

      clearTimeout(timeoutId)

      const expectedStatus = endpoint.expectedStatus || 200
      const isHealthy = response.status === expectedStatus

      return {
        service: endpoint.name,
        status: isHealthy ? 'up' : 'down',
        timestamp: Date.now(),
        details: isHealthy 
          ? `HTTP ${response.status}` 
          : `Expected ${expectedStatus}, got ${response.status}`
      }
    } catch (error) {
      return {
        service: endpoint.name,
        status: 'down',
        timestamp: Date.now(),
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private async checkDatabaseHealth(): Promise<HealthCheck> {
    try {
      // Import Prisma client dynamically to avoid circular dependencies
      const { PrismaClient } = await import('@prisma/client')
      const prisma = new PrismaClient()
      
      // Simple query to check database connectivity (use count instead of raw query for Prisma Accelerate compatibility)
      await prisma.user.count()
      await prisma.$disconnect()

      return {
        service: 'Database',
        status: 'up',
        timestamp: Date.now(),
        details: 'Database connection successful'
      }
    } catch (error) {
      return {
        service: 'Database',
        status: 'down',
        timestamp: Date.now(),
        details: error instanceof Error ? error.message : 'Database connection failed'
      }
    }
  }

  getHealthStatus(): Record<string, HealthCheck> {
    return Object.fromEntries(this.healthChecks)
  }

  getOverallStatus(): 'healthy' | 'degraded' | 'down' {
    const checks = Array.from(this.healthChecks.values())
    
    if (checks.length === 0) return 'unknown'
    
    const downServices = checks.filter(check => check.status === 'down')
    
    if (downServices.length === 0) return 'healthy'
    if (downServices.length < checks.length) return 'degraded'
    return 'down'
  }

  // Add custom endpoint to monitor
  addEndpoint(endpoint: any) {
    this.config.endpoints.push(endpoint)
    
    if (this.isRunning) {
      this.startEndpointMonitoring(endpoint)
    }
  }

  // Remove endpoint from monitoring
  removeEndpoint(serviceName: string) {
    this.config.endpoints = this.config.endpoints.filter(ep => ep.name !== serviceName)
    
    const interval = this.intervals.get(serviceName)
    if (interval) {
      clearInterval(interval)
      this.intervals.delete(serviceName)
    }
    
    this.healthChecks.delete(serviceName)
  }
}

// Global uptime monitor instance
export const uptimeMonitor = new UptimeMonitor()

// Start monitoring when the module is imported
if (process.env.NODE_ENV === 'production') {
  uptimeMonitor.start()
}

export default uptimeMonitor
