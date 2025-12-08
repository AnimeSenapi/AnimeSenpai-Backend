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
  running?: {
    startTime: number
    estimatedDuration?: number // milliseconds, based on previous runs
  }
}

let hasLoggedTrendingDatabaseUnavailable = false

class BackgroundJobQueue {
  private jobs = new Map<string, Job>()
  private intervals = new Map<string, NodeJS.Timeout>()
  private jobDurations = new Map<string, number[]>() // Track last 5 durations for each job

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
    
    // Mark job as running
    const estimatedDuration = this.getEstimatedDuration(job.name)
    job.running = {
      startTime,
      ...(estimatedDuration !== undefined && { estimatedDuration }),
    }
    
    try {
      logger.debug(`Executing job: ${job.name}`, {}, { jobId: job.id })
      
      await job.handler()
      
      const duration = Date.now() - startTime
      
      // Track duration for future estimates
      this.recordJobDuration(job.name, duration)
      
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
      
      // Clear running state
      delete job.running
    } catch (error) {
      const duration = Date.now() - startTime
      
      // Clear running state on error
      delete job.running
      
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
   * Record job duration for future estimates
   */
  private recordJobDuration(jobName: string, duration: number): void {
    const durations = this.jobDurations.get(jobName) || []
    durations.push(duration)
    // Keep only last 5 durations
    if (durations.length > 5) {
      durations.shift()
    }
    this.jobDurations.set(jobName, durations)
  }

  /**
   * Get estimated duration based on previous runs
   */
  private getEstimatedDuration(jobName: string): number | undefined {
    const durations = this.jobDurations.get(jobName)
    if (!durations || durations.length === 0) {
      return undefined
    }
    // Return average of last 5 runs
    const sum = durations.reduce((a, b) => a + b, 0)
    return Math.round(sum / durations.length)
  }

  /**
   * Get job statistics
   */
  getStats() {
    const now = Date.now()
    
    return {
      totalJobs: this.jobs.size,
      scheduledJobs: this.intervals.size,
      jobs: Array.from(this.jobs.values()).map(job => {
        const isRunning = !!job.running
        const running = job.running
        const runningDuration = isRunning && running ? now - running.startTime : 0
        const estimatedTimeRemaining = isRunning && running && running.estimatedDuration
          ? Math.max(0, running.estimatedDuration - runningDuration)
          : undefined
        
        // Calculate next run time
        let nextRunTime: string | null = null
        if (job.schedule?.lastRun && job.schedule.interval) {
          const nextRun = job.schedule.lastRun + job.schedule.interval
          nextRunTime = new Date(nextRun).toISOString()
        }
        
        return {
          id: job.id,
          name: job.name,
          scheduled: !!job.schedule,
          lastRun: job.schedule?.lastRun ? new Date(job.schedule.lastRun).toISOString() : 'N/A',
          interval: job.schedule?.interval,
          isRunning,
          runningDuration: isRunning ? runningDuration : undefined,
          estimatedTimeRemaining,
          estimatedDuration: running?.estimatedDuration,
          nextRun: nextRunTime,
        }
      }),
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
 * Sync calendar data for airing anime (run daily)
 * Also runs immediately on startup to fetch initial data
 */
export function scheduleCalendarSync() {
  const syncHandler = async () => {
    try {
      const { syncAiringAnimeCalendarData } = await import('./calendar-sync')
      await syncAiringAnimeCalendarData()
    } catch (error) {
      logger.error('Calendar sync job failed', error as Error, {}, {})
    }
  }

  // Run immediately on startup (first fetch) after a short delay to ensure server is ready
  setTimeout(() => {
    logger.system('Starting initial calendar sync...', {}, {})
    syncHandler().catch((error) => {
      logger.error('Initial calendar sync failed', error as Error, {}, {})
    })
  }, 5000) // Wait 5 seconds for server to fully initialize

  // Schedule daily runs
  jobQueue.schedule(
    'calendar-sync',
    syncHandler,
    24 * 60 * 60 * 1000, // Daily
  )
}

/**
 * Schedule daily anime data sync
 * Fetches new anime, updates existing anime, and applies content filters
 */
export function scheduleAnimeDataSync() {
  const syncHandler = async () => {
    try {
      const { syncDailyAnimeData } = await import('./anime-sync')
      await syncDailyAnimeData()
    } catch (error) {
      logger.error('Anime data sync job failed', error as Error, {}, {})
    }
  }

  // Run immediately on startup (first fetch) after a delay to ensure server is ready
  setTimeout(() => {
    logger.system('Starting initial anime data sync...', {}, {})
    syncHandler().catch((error) => {
      logger.error('Initial anime data sync failed', error as Error, {}, {})
    })
  }, 10000) // Wait 10 seconds for server to fully initialize

  // Schedule daily runs
  jobQueue.schedule(
    'anime-data-sync',
    syncHandler,
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
  scheduleCalendarSync()
  scheduleAnimeDataSync()
  
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

