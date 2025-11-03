import { serve } from 'bun'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from './routers'
import { Context } from './lib/trpc'
import { logger, extractLogContext, generateRequestId } from './lib/logger'
import { handleError } from './lib/errors'
import { gzip } from 'zlib'
import { promisify } from 'util'

const gzipAsync = promisify(gzip)

const port = parseInt(process.env.API_PORT || '3001')

// Performance metrics storage (in-memory, no Redis needed)
const performanceMetrics = {
  requests: 0,
  errors: 0,
  totalResponseTime: 0,
  slowQueries: [] as Array<{path: string, duration: number, timestamp: string}>,
  endpoints: new Map<string, {count: number, avgTime: number, errors: number}>()
}

// Function to find available port
async function findAvailablePort(startPort: number): Promise<number> {
  for (let port = startPort; port < startPort + 100; port++) {
    try {
      const server = Bun.serve({
        port,
        fetch: () => new Response('test'),
      })
      server.stop()
      return port
    } catch (error) {
      // Port is in use, try next one
      continue
    }
  }
  throw new Error('No available ports found')
}

// Start server
;(async () => {
  // Initialize cache system
  const { cache } = await import('./lib/cache')
  const { CacheWarmer } = await import('./lib/cache-middleware')
  
  // Warm up cache
  await CacheWarmer.warmUp()
  
  // Initialize monitoring and health check systems
  const { monitoringService } = await import('./lib/monitoring-service')
  const { healthChecker } = await import('./lib/health-check')
  const { errorHandler } = await import('./lib/error-handler')
  const { queryOptimizer } = await import('./lib/query-optimizer')
  const { securityManager } = await import('./lib/security')
  const { performanceMonitor } = await import('./lib/performance-monitor')
  
  // Start monitoring
  await monitoringService.start()
  
  // Start performance monitoring
  performanceMonitor.startProfilingMode()
  
  // Initialize background jobs
  const { initializeBackgroundJobs } = await import('./lib/background-jobs')
  initializeBackgroundJobs()
  
  const availablePort = await findAvailablePort(port)

  const server = serve({
    port: availablePort,
    async fetch(request) {
      const startTime = Date.now()
      const requestId = request.headers.get('x-request-id') || generateRequestId()
      const url = new URL(request.url)
      const logContext = extractLogContext(request)
      
      // Handle CORS with specific origin (required for credentials: 'include')
      const origin = request.headers.get('origin') || ''
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001', 
        'http://localhost:3002',
        'http://localhost:3004',
        'http://localhost:3005',
        'http://localhost:3006',
        'https://animesenpai.app',
        'https://www.animesenpai.app'
      ]
      
      // Allow Vercel preview deployments (*.vercel.app)
      const isVercelPreview = origin.endsWith('.vercel.app')
      const corsOrigin = allowedOrigins.includes(origin) || isVercelPreview ? origin : allowedOrigins[0]!
      
      try {
        // Security analysis
        const securityAnalysis = await securityManager.analyzeRequest(request)
        if (!securityAnalysis.allowed) {
          logger.warn('Request blocked by security', logContext, undefined, {
            reason: securityAnalysis.reason,
            ip: logContext.ipAddress,
            userAgent: request.headers.get('user-agent')
          })
          
          return new Response(JSON.stringify({
            error: 'Request blocked',
            reason: securityAnalysis.reason
          }), {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': corsOrigin,
              'X-Request-ID': requestId,
            } as HeadersInit,
          })
        }

        // Log incoming request
        logger.request(request.method, request.url, logContext, {
          userAgent: request.headers.get('user-agent'),
          contentLength: request.headers.get('content-length'),
          contentType: request.headers.get('content-type'),
        })
      
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': corsOrigin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Credentials': 'true',
            'X-Request-ID': requestId,
          } as HeadersInit,
        })
      }

      // Health check endpoint
      if (url.pathname === '/health' || url.pathname === '/') {
        const { healthChecker } = await import('./lib/health-check')
        const healthStatus = await healthChecker.runAllChecks()
        
        logger.api('Health check requested', logContext, { healthStatus })
        
        return new Response(JSON.stringify(healthStatus, null, 2), {
          status: healthStatus.status === 'unhealthy' ? 503 : 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': corsOrigin,
            'Access-Control-Allow-Credentials': 'true',
            'X-Request-ID': requestId,
          } as HeadersInit,
        })
      }

      // Metrics endpoint
      if (url.pathname === '/metrics') {
        const { queryStats } = await import('./lib/db')
        const { getRateLimitStats } = await import('./lib/rate-limit')
        const { jobQueue } = await import('./lib/background-jobs')
        const { cache } = await import('./lib/cache')
        
        const avgResponseTime = performanceMetrics.requests > 0 
          ? (performanceMetrics.totalResponseTime / performanceMetrics.requests).toFixed(2)
          : 0
        
        const avgQueryTime = queryStats.totalQueries > 0
          ? (queryStats.totalDuration / queryStats.totalQueries).toFixed(2)
          : 0
        
        const cacheStats = await cache.getStats()
        
        const metricsResponse = {
          server: {
            requests: performanceMetrics.requests,
            errors: performanceMetrics.errors,
            avgResponseTime: `${avgResponseTime}ms`,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
          },
          database: {
            totalQueries: queryStats.totalQueries,
            slowQueries: queryStats.slowQueries,
            avgQueryTime: `${avgQueryTime}ms`,
            slowestQuery: {
              duration: `${queryStats.slowestQuery.duration}ms`,
              query: queryStats.slowestQuery.query.substring(0, 100),
            },
          },
          cache: {
            connected: cacheStats.connected,
            size: cacheStats.size,
            maxSize: cacheStats.maxSize,
            memoryUsage: `${cacheStats.memoryUsage.toFixed(2)}MB`,
            hitRate: `${cacheStats.hitRate}%`,
            evicted: cacheStats.evicted,
            expired: cacheStats.expired,
          },
          rateLimit: getRateLimitStats(),
          backgroundJobs: jobQueue.getStats(),
          slowRequests: performanceMetrics.slowQueries.slice(-10), // Last 10 slow requests
          topEndpoints: Array.from(performanceMetrics.endpoints.entries())
            .map(([path, stats]) => ({
              path,
              count: stats.count,
              avgTime: `${stats.avgTime.toFixed(2)}ms`,
              errors: stats.errors,
              errorRate: `${((stats.errors / stats.count) * 100).toFixed(2)}%`
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10),
        }
        
        return new Response(JSON.stringify(metricsResponse, null, 2), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': corsOrigin,
            'Access-Control-Allow-Credentials': 'true',
            'X-Request-ID': requestId,
          } as HeadersInit,
        })
      }

      // Monitoring dashboard endpoint
      if (url.pathname === '/monitoring') {
        const { monitoringService } = await import('./lib/monitoring-service')
        const { errorHandler } = await import('./lib/error-handler')
        
        const monitoringData = {
          system: monitoringService.getSystemStatus(),
          metrics: monitoringService.getMetrics().slice(-10), // Last 10 metrics
          alerts: monitoringService.getAlerts().filter(a => !a.resolved),
          errors: errorHandler.getErrorStats(),
          timestamp: new Date().toISOString(),
        }
        
        return new Response(JSON.stringify(monitoringData, null, 2), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': corsOrigin,
            'Access-Control-Allow-Credentials': 'true',
            'X-Request-ID': requestId,
          } as HeadersInit,
        })
      }

      // Silently handle common browser requests for static files (not API endpoints)
      const staticFileExtensions = ['.ico', '.png', '.jpg', '.svg', '.css', '.js', '.map']
      const isStaticFile = staticFileExtensions.some(ext => url.pathname.endsWith(ext))
      if (isStaticFile) {
        return new Response('Not found', {
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': corsOrigin,
            'X-Request-ID': requestId,
          },
        })
      }

      // Create context with request ID
      const context: Context = {
        req: request
      }

      // Handle tRPC requests (with batching support)
      const response = await fetchRequestHandler({
        endpoint: '/api/trpc',
        req: request,
        router: appRouter,
        createContext: () => context,
        batching: {
          enabled: true, // Enable request batching
        },
        onError: ({ path, error, input, ctx }) => {
          const errorLogContext = extractLogContext(request, ctx?.user?.id)
          
          // Skip logging expected auth failures (missing tokens) - these are normal
          const isExpectedAuthFailure = 
            error.code === 'UNAUTHORIZED' && 
            error.message.includes('No authentication token provided')
          
          if (!isExpectedAuthFailure) {
            // Log all other errors with proper context
            logger.error(`tRPC Error in ${path}`, error, errorLogContext, {
              path,
              input: typeof input === 'object' ? input : { value: input },
              errorCode: error.code,
              errorMessage: error.message,
              stack: error.stack,
            })
            
            // In development, also log to console for immediate visibility
            if (process.env.NODE_ENV === 'development' && path && path.includes('.')) {
              console.error(`❌ tRPC failed on ${path}: ${error.message}`)
            }
          }
        },
      })

      // Clone response to read body for compression
      const responseClone = response.clone()
      let finalResponse = response

      // Apply compression for responses > 1KB
      const acceptEncoding = request.headers.get('accept-encoding') || ''
      if (acceptEncoding.includes('gzip')) {
        const contentLength = parseInt(response.headers.get('content-length') || '0')
        const contentType = response.headers.get('content-type') || ''
        
        // Only compress text-based responses larger than 1KB
        const shouldCompress = contentLength > 1024 && (
          contentType.includes('application/json') ||
          contentType.includes('text/') ||
          contentType.includes('application/javascript')
        )

        if (shouldCompress) {
          try {
            const body = await responseClone.arrayBuffer()
            const compressed = await gzipAsync(Buffer.from(body))
            
            finalResponse = new Response(compressed, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            })
            
            finalResponse.headers.set('Content-Encoding', 'gzip')
            finalResponse.headers.set('Content-Length', compressed.length.toString())
          } catch (error) {
            // If compression fails, use original response
            logger.warn('Compression failed, using original response', logContext, { error })
          }
        }
      }

      // Add comprehensive security headers
      finalResponse.headers.set('Access-Control-Allow-Origin', corsOrigin)
      finalResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      finalResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      finalResponse.headers.set('Access-Control-Allow-Credentials', 'true')
      finalResponse.headers.set('X-Request-ID', requestId)
      
      // Security Headers (OWASP recommendations)
      finalResponse.headers.set('X-Content-Type-Options', 'nosniff')
      finalResponse.headers.set('X-Frame-Options', 'DENY')
      finalResponse.headers.set('X-XSS-Protection', '1; mode=block')
      
      // Strict Transport Security (HSTS) - Force HTTPS
      finalResponse.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
      
      // Content Security Policy (CSP)
      finalResponse.headers.set('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "font-src 'self' data:; " +
        "connect-src 'self' http://localhost:* https:; " +
        "frame-ancestors 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self'"
      )
      
      // Permissions Policy (formerly Feature Policy)
      finalResponse.headers.set('Permissions-Policy', 
        'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
      )
      
      // Referrer Policy
      finalResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
      
      // Remove sensitive headers
      finalResponse.headers.delete('X-Powered-By')
      finalResponse.headers.delete('Server')

      // Track performance metrics
      const duration = Date.now() - startTime
      performanceMetrics.requests++
      performanceMetrics.totalResponseTime += duration

      // Track endpoint-specific metrics
      const endpoint = url.pathname
      const endpointStats = performanceMetrics.endpoints.get(endpoint) || {
        count: 0,
        avgTime: 0,
        errors: 0
      }
      
      endpointStats.count++
      endpointStats.avgTime = (endpointStats.avgTime * (endpointStats.count - 1) + duration) / endpointStats.count
      
      if (response.status >= 400) {
        endpointStats.errors++
        performanceMetrics.errors++
      }
      
      performanceMetrics.endpoints.set(endpoint, endpointStats)

      // Track slow queries (> 500ms)
      if (duration > 500) {
        performanceMetrics.slowQueries.push({
          path: endpoint,
          duration,
          timestamp: new Date().toISOString()
        })
        
        // Keep only last 100 slow queries
        if (performanceMetrics.slowQueries.length > 100) {
          performanceMetrics.slowQueries = performanceMetrics.slowQueries.slice(-100)
        }
        
        logger.warn(`Slow query detected: ${endpoint} took ${duration}ms`, logContext, {
          path: endpoint,
          duration,
          method: request.method,
        })
      }

      // Log response (skip 401 for notification endpoints - expected when not signed in)
      const isExpectedAuthFailure = response.status === 401 && url.pathname.includes('notifications')
      if (!isExpectedAuthFailure) {
        logger.response(
          request.method,
          request.url,
          response.status,
          duration,
          logContext,
          {
            contentLength: finalResponse.headers.get('content-length'),
            contentType: finalResponse.headers.get('content-type'),
            compressed: finalResponse.headers.has('Content-Encoding'),
          }
        )
      }

      return finalResponse
    } catch (error) {
      const duration = Date.now() - startTime
      const errorLogContext = extractLogContext(request)
      
      // Handle unexpected errors
      const appError = handleError(error, errorLogContext)
      
      logger.error(
        `Unexpected error in ${request.method} ${request.url}`,
        appError,
        errorLogContext,
        {
          method: request.method,
          url: request.url,
          duration,
          userAgent: request.headers.get('user-agent'),
        }
      )
      
      // Return error response
      const errorResponse = {
        error: {
          code: appError.code,
          message: appError.message,
          timestamp: appError.timestamp,
          requestId,
        }
      }
      
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': corsOrigin,
          'Access-Control-Allow-Credentials': 'true',
          'X-Request-ID': requestId,
        },
      })
    }
    },
  })

  console.log(`🚀 AnimeSenpai API Server running on port ${availablePort}`)
  console.log(`📡 tRPC endpoint: http://localhost:${availablePort}/api/trpc`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
})()
