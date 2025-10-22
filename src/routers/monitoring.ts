import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { publicProcedure, router } from '../lib/trpc'
import { logger } from '../lib/logger'
import { errorRateMonitor, getErrorMetrics } from '../lib/monitoring'
import { queryMonitor, getQueryStats, getSlowQueries } from '../lib/query-monitor'
import { sendUptimeAlert, sendPerformanceAlert } from '../lib/alerts'

// Web Vitals Schema
const WebVitalSchema = z.object({
  name: z.string(),
  value: z.number(),
  delta: z.number(),
  id: z.string(),
  navigationType: z.string().optional(),
  timestamp: z.number(),
  sessionId: z.string(),
  userId: z.string().optional(),
  url: z.string(),
  userAgent: z.string(),
  connectionType: z.string(),
  deviceMemory: z.number(),
  viewport: z.object({
    width: z.number(),
    height: z.number()
  })
})

// Health Check Schema
const HealthCheckSchema = z.object({
  service: z.string(),
  status: z.enum(['up', 'down']),
  details: z.string().optional(),
  timestamp: z.number().optional()
})

export const monitoringRouter = router({
  // Web Vitals endpoint
  recordWebVital: publicProcedure
    .input(WebVitalSchema)
    .mutation(async ({ input }) => {
      try {
        // Log the web vital
        logger.info('Web vital recorded', {
          metric: input.name,
          value: input.value,
          sessionId: input.sessionId,
          userId: input.userId,
          url: input.url
        })

        // Check if it's a performance issue
        const thresholds = {
          LCP: 2500,
          FID: 100,
          CLS: 0.1,
          FCP: 1800,
          TTFB: 600
        }

        const threshold = thresholds[input.name as keyof typeof thresholds]
        if (threshold && input.value > threshold) {
          logger.warn('Web vital threshold exceeded', {
            metric: input.name,
            value: input.value,
            threshold,
            sessionId: input.sessionId,
            url: input.url
          })

          // Send performance alert
          await sendPerformanceAlert(
            `Web Vital: ${input.name}`,
            input.value,
            threshold,
            'ms'
          )
        }

        return { success: true }
      } catch (error) {
        logger.error('Failed to record web vital', { error, input })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to record web vital'
        })
      }
    }),

  // Performance alert endpoint
  recordPerformanceAlert: publicProcedure
    .input(z.object({
      type: z.string(),
      metric: z.string(),
      value: z.number(),
      threshold: z.number(),
      url: z.string(),
      sessionId: z.string(),
      userId: z.string().optional(),
      timestamp: z.number()
    }))
    .mutation(async ({ input }) => {
      try {
        logger.warn('Performance alert received', input)

        // Send Slack alert
        await sendPerformanceAlert(
          input.metric,
          input.value,
          input.threshold,
          'ms'
        )

        return { success: true }
      } catch (error) {
        logger.error('Failed to record performance alert', { error, input })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to record performance alert'
        })
      }
    }),

  // Health check endpoint
  healthCheck: publicProcedure
    .input(HealthCheckSchema)
    .mutation(async ({ input }) => {
      try {
        logger.info('Health check received', input)

        // Send health check alert if status is down
        if (input.status === 'down') {
          await sendUptimeAlert(
            input.service,
            input.status,
            input.details
          )
        }

        return { success: true }
      } catch (error) {
        logger.error('Failed to process health check', { error, input })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process health check'
        })
      }
    }),

  // Get error metrics
  getErrorMetrics: publicProcedure
    .query(async () => {
      try {
        const metrics = getErrorMetrics()
        return {
          success: true,
          metrics
        }
      } catch (error) {
        logger.error('Failed to get error metrics', { error })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get error metrics'
        })
      }
    }),

  // Get query statistics
  getQueryStats: publicProcedure
    .input(z.object({
      timeWindow: z.number().optional().default(15) // minutes
    }))
    .query(async ({ input }) => {
      try {
        const stats = getQueryStats(input.timeWindow)
        return {
          success: true,
          stats
        }
      } catch (error) {
        logger.error('Failed to get query stats', { error })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get query stats'
        })
      }
    }),

  // Get slow queries
  getSlowQueries: publicProcedure
    .input(z.object({
      timeWindow: z.number().optional().default(15) // minutes
    }))
    .query(async ({ input }) => {
      try {
        const slowQueries = getSlowQueries(input.timeWindow)
        return {
          success: true,
          slowQueries
        }
      } catch (error) {
        logger.error('Failed to get slow queries', { error })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get slow queries'
        })
      }
    }),

  // System status endpoint
  getSystemStatus: publicProcedure
    .query(async () => {
      try {
        const errorMetrics = getErrorMetrics()
        const queryStats = getQueryStats(15)
        
        const status = {
          timestamp: Date.now(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          errorRate: errorMetrics.errorRate,
          totalErrors: errorMetrics.totalErrors,
          totalRequests: errorMetrics.totalRequests,
          slowQueries: queryStats.slowQueries,
          averageQueryDuration: queryStats.averageDuration,
          health: {
            database: 'healthy', // TODO: Add actual database health check
            redis: 'healthy',    // TODO: Add actual Redis health check
            api: 'healthy'
          }
        }

        return {
          success: true,
          status
        }
      } catch (error) {
        logger.error('Failed to get system status', { error })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get system status'
        })
      }
    }),

  // Manual error recording
  recordError: publicProcedure
    .input(z.object({
      endpoint: z.string().optional(),
      statusCode: z.number().optional(),
      errorType: z.string().optional(),
      message: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      try {
        // Record the error in our monitoring system
        errorRateMonitor.recordError(
          input.endpoint,
          input.statusCode,
          input.errorType
        )

        logger.error('Manual error recorded', input)

        return { success: true }
      } catch (error) {
        logger.error('Failed to record manual error', { error, input })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to record error'
        })
      }
    })
})
