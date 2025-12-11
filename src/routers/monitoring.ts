import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { publicProcedure, router } from '../lib/trpc.js'
import { logger } from '../lib/logger.js'
import { errorRateMonitor, getErrorMetrics } from '../lib/monitoring-service.js'
import { getQueryStats, getSlowQueries } from '../lib/query-monitor.js'
import { sendUptimeAlert, sendPerformanceAlert } from '../lib/alerts.js'

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
          sessionId: input.sessionId,
          url: input.url,
          ...(input.userId !== undefined && { userId: input.userId })
        }, {
          metric: input.name,
          value: input.value
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
            sessionId: input.sessionId,
            url: input.url
          }, {
            metric: input.name,
            value: input.value,
            threshold
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
        logger.error('Failed to record web vital', error instanceof Error ? error : new Error(String(error)), undefined, { input })
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
        logger.warn('Performance alert received', {
          sessionId: input.sessionId,
          url: input.url,
          ...(input.userId !== undefined && { userId: input.userId })
        }, {
          type: input.type,
          metric: input.metric,
          value: input.value,
          threshold: input.threshold,
          timestamp: input.timestamp
        })

        // Send Slack alert
        await sendPerformanceAlert(
          input.metric,
          input.value,
          input.threshold,
          'ms'
        )

        return { success: true }
      } catch (error) {
        logger.error('Failed to record performance alert', error instanceof Error ? error : new Error(String(error)), undefined, { input })
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
        logger.info('Health check received', undefined, input)

        // Send health check alert if status is down
        if (input.status === 'down') {
          await sendUptimeAlert(
            input.service,
            input.status,
            input.details ? parseFloat(input.details) : undefined
          )
        }

        return { success: true }
      } catch (error) {
        logger.error('Failed to process health check', error instanceof Error ? error : new Error(String(error)), undefined, { input })
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
        logger.error('Failed to get error metrics', error instanceof Error ? error : new Error(String(error)))
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
        logger.error('Failed to get query stats', error instanceof Error ? error : new Error(String(error)))
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
        logger.error('Failed to get slow queries', error instanceof Error ? error : new Error(String(error)))
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
            database: 'healthy', // Database health check via health-check service
            api: 'healthy'
          }
        }

        return {
          success: true,
          status
        }
      } catch (error) {
        logger.error('Failed to get system status', error instanceof Error ? error : new Error(String(error)))
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

        logger.error('Manual error recorded', undefined, undefined, input)

        return { success: true }
      } catch (error) {
        logger.error('Failed to record manual error', error instanceof Error ? error : new Error(String(error)), undefined, { input })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to record error'
        })
      }
    })
})
