/**
 * Simple background job system (no external dependencies)
 * For production with multiple servers, consider BullMQ with Redis
 */

import { logger } from './logger'

function isDatabaseConnectionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()

  return (
    normalized.includes("can't reach database server") ||
    normalized.includes('p1001') ||
    normalized.includes('database is temporarily unavailable')
  )
}

type JobHandler = () => Promise<void>

interface Job {
  id: string
  name: string
  handler: JobHandler
  schedule?: {
    interval: number // milliseconds
    lastRun?: number
  }
  retries?: number
  maxRetries?: number
}

let hasLoggedTrendingDatabaseUnavailable = false

class BackgroundJobQueue {
  private jobs = new Map<string, Job>()
  private intervals = new Map<string, NodeJS.Timeout>()

  /**
   * Register a one-time job
   */
  async enqueue(name: string, handler: JobHandler, retries = 3): Promise<string> {
    const id = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const job: Job = {
      id,
      name,
      handler,
      maxRetries: retries,
      retries: 0,
    }
    
    this.jobs.set(id, job)
    
    // Execute immediately in background
    this.executeJob(job).catch(error => {
      logger.error(`Failed to execute job ${name}`, error, {}, {
        jobId: id,
        jobName: name,
      })
    })
    
    return id
  }

  /**
   * Register a recurring job
   */
  schedule(name: string, handler: JobHandler, intervalMs: number) {
    const id = `scheduled-${name}`
    
    const job: Job = {
      id,
      name,
      handler,
      schedule: {
        interval: intervalMs,
        lastRun: Date.now(),
      },
    }
    
    this.jobs.set(id, job)
    
    // Execute immediately
    this.executeJob(job).catch(error => {
      logger.error(`Failed to execute scheduled job ${name}`, error, {}, {
        jobId: id,
        jobName: name,
      })
    })
    
    // Schedule recurring execution
    const interval = setInterval(() => {
      this.executeJob(job).catch(error => {
        logger.error(`Failed to execute scheduled job ${name}`, error, {}, {
          jobId: id,
          jobName: name,
        })
      })
    }, intervalMs)
    
    this.intervals.set(id, interval)
    
    logger.system(`Scheduled recurring job: ${name} (every ${intervalMs}ms)`, {}, {
      jobId: id,
      interval: intervalMs,
    })
    
    return id
  }

  /**
   * Execute a job
   */
  private async executeJob(job: Job): Promise<void> {
    const startTime = Date.now()
    
    try {
      logger.debug(`Executing job: ${job.name}`, {}, { jobId: job.id })
      
      await job.handler()
      
      const duration = Date.now() - startTime
      logger.system(`Job completed: ${job.name}`, {}, {
        jobId: job.id,
        duration,
      })
      
      // Remove one-time jobs after successful execution
      if (!job.schedule) {
        this.jobs.delete(job.id)
      } else {
        job.schedule.lastRun = Date.now()
      }
    } catch (error) {
      const duration = Date.now() - startTime
      
      logger.error(
        `Job failed: ${job.name}`,
        error instanceof Error ? error : new Error(String(error)),
        {},
        {
        jobId: job.id,
        duration,
        retries: job.retries,
        maxRetries: job.maxRetries,
        }
      )
      
      // Retry logic for one-time jobs
      if (!job.schedule && job.maxRetries && job.retries !== undefined) {
        job.retries++
        
        if (job.retries < job.maxRetries) {
          logger.info(`Retrying job: ${job.name} (${job.retries}/${job.maxRetries})`, {}, {
            jobId: job.id,
          })
          
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, job.retries), 30000)
          setTimeout(() => {
            this.executeJob(job).catch(() => {
              // Already logged
            })
          }, delay)
        } else {
          logger.error(
            `Job failed after ${job.maxRetries} retries: ${job.name}`,
            error instanceof Error ? error : new Error(String(error)),
            {},
            {
            jobId: job.id,
            }
          )
          this.jobs.delete(job.id)
        }
      }
    }
  }

  /**
   * Cancel a scheduled job
   */
  cancel(jobId: string): boolean {
    const interval = this.intervals.get(jobId)
    if (interval) {
      clearInterval(interval)
      this.intervals.delete(jobId)
      this.jobs.delete(jobId)
      logger.info(`Cancelled job: ${jobId}`, {}, { jobId })
      return true
    }
    return false
  }

  /**
   * Get job statistics
   */
  getStats() {
    return {
      totalJobs: this.jobs.size,
      scheduledJobs: this.intervals.size,
      jobs: Array.from(this.jobs.values()).map(job => ({
        id: job.id,
        name: job.name,
        scheduled: !!job.schedule,
        lastRun: job.schedule?.lastRun ? new Date(job.schedule.lastRun).toISOString() : 'N/A',
        interval: job.schedule?.interval,
      })),
    }
  }

  /**
   * Shutdown gracefully
   */
  async shutdown() {
    logger.info('Shutting down background job queue...', {}, {
      totalJobs: this.jobs.size,
      scheduledJobs: this.intervals.size,
    })
    
    // Clear all intervals
    for (const interval of this.intervals.values()) {
      clearInterval(interval)
    }
    
    this.intervals.clear()
    this.jobs.clear()
  }
}

// Singleton instance
export const jobQueue = new BackgroundJobQueue()

export async function resetBackgroundJobStateForTests(): Promise<void> {
  await jobQueue.shutdown()
  hasLoggedTrendingDatabaseUnavailable = false
}

// Example jobs

/**
 * Clean up old sessions (run daily)
 */
export function scheduleSessionCleanup() {
  jobQueue.schedule(
    'session-cleanup',
    async () => {
      try {
        const { getDbWithoutOptimize } = await import('./db')
        const db = getDbWithoutOptimize() // Use client without Optimize to avoid tracing issues
        
        // Delete sessions older than 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        
        const result = await db.session.deleteMany({
          where: {
            expiresAt: {
              lt: thirtyDaysAgo,
            },
          },
        })
        
        logger.system(`Cleaned up ${result.count} old sessions`, {}, {
          deletedCount: result.count,
        })
      } catch (error) {
        // Session table might not exist yet, that's okay
        logger.debug('Session cleanup skipped (table may not exist)', {}, {})
      }
    },
    24 * 60 * 60 * 1000, // Daily
  )
}

/**
 * Update trending anime (run every hour)
 */
export function scheduleTrendingUpdate() {
  jobQueue.schedule(
    'trending-update',
    async () => {
      const { getDbWithoutOptimize } = await import('./db')
      const db = getDbWithoutOptimize() // Use client without Optimize to avoid tracing issues
      
      // This is a placeholder - implement your trending algorithm
      // For example: count list additions in last 7 days, weight by recency
      
      try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      
      const trending = await db.userAnimeList.groupBy({
        by: ['animeId'],
        where: {
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
        _count: {
          animeId: true,
        },
        orderBy: {
          _count: {
            animeId: 'desc',
          },
        },
        take: 100,
      })
      
      logger.system(`Updated trending anime`, {}, {
        trendingCount: trending.length,
      })
        hasLoggedTrendingDatabaseUnavailable = false
      } catch (error) {
        if (isDatabaseConnectionError(error)) {
          if (!hasLoggedTrendingDatabaseUnavailable) {
            logger.warn('Skipping trending update because database is unavailable', {
              job: 'trending-update',
            }, {
              job: 'trending-update',
              reason: (error as Error)?.message,
            })
            hasLoggedTrendingDatabaseUnavailable = true
          } else {
            logger.debug('Trending update still skipped - database unavailable', {
              job: 'trending-update',
            })
          }
          return
        }

        logger.error('Failed to update trending anime', error as Error, {}, {
          job: 'trending-update',
        })
      }
    },
    60 * 60 * 1000, // Hourly
  )
}

/**
 * Clean up old verification tokens (run daily)
 */
export function scheduleTokenCleanup() {
  jobQueue.schedule(
    'token-cleanup',
    async () => {
      try {
        const { getDbWithoutOptimize } = await import('./db')
        const db = getDbWithoutOptimize() // Use client without Optimize to avoid tracing issues
        
        const now = new Date()
        
        const result = await db.verificationToken.deleteMany({
          where: {
            expiresAt: {
              lt: now,
            },
          },
        })
        
        logger.system(`Cleaned up ${result.count} expired tokens`, {}, {
          deletedCount: result.count,
        })
      } catch (error) {
        // VerificationToken table might not exist yet, that's okay
        logger.debug('Token cleanup skipped (table may not exist)', {}, {})
      }
    },
    24 * 60 * 60 * 1000, // Daily
  )
}


/**
 * Initialize all scheduled jobs
 */
export function initializeBackgroundJobs() {
  logger.system('Initializing background jobs...', {}, {})
  
  scheduleSessionCleanup()
  scheduleTrendingUpdate()
  scheduleTokenCleanup()
  
  logger.system('Background jobs initialized', {}, {
    jobs: jobQueue.getStats(),
  })
}

// Graceful shutdown
process.on('SIGTERM', () => {
  jobQueue.shutdown()
})

process.on('SIGINT', () => {
  jobQueue.shutdown()
})

