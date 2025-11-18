import './lib/tracing'
import './lib/env'
import { serve } from 'bun'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from './routers'
import { Context } from './lib/trpc'
import { logger, extractLogContext, generateRequestId } from './lib/logger'
import { handleError } from './lib/errors'
import { verifyCsrfToken, RefreshedCsrfToken } from './lib/csrf'
import { gzip } from 'zlib'
import { promisify } from 'util'

const gzipAsync = promisify(gzip)

const port = parseInt(process.env.API_PORT || '3005')

// Performance metrics storage (in-memory, no Redis needed)
const performanceMetrics = {
  requests: 0,
  errors: 0,
  totalResponseTime: 0,
  slowQueries: [] as Array<{path: string, duration: number, timestamp: string}>,
  endpoints: new Map<string, {count: number, avgTime: number, errors: number}>()
}

// Note: Bind to the configured port directly to avoid mismatches with frontend proxy

// Start server
;(async () => {
  // Initialize cache system
  const { CacheWarmer } = await import('./lib/cache-middleware')
  
  // Warm up cache
  await CacheWarmer.warmUp()
  
  // Initialize monitoring and health check systems
  const { monitoringService } = await import('./lib/monitoring-service')
  const { securityManager } = await import('./lib/security')
  const { performanceMonitor } = await import('./lib/performance-monitor')
  
  // Start monitoring
  await monitoringService.start()
  
  // Start performance monitoring
  performanceMonitor.startProfilingMode()
  
  // Initialize background jobs
  const { initializeBackgroundJobs } = await import('./lib/background-jobs')
  initializeBackgroundJobs()
  
  serve({
    port,
    async fetch(request) {
      const startTime = Date.now()
      const requestId = request.headers.get('x-request-id') || generateRequestId()
      const clientTraceId = request.headers.get('x-client-trace-id') || undefined
      const url = new URL(request.url)
      const logContext = extractLogContext(request)
      
      // Handle CORS with strict allowlist
      const origin = request.headers.get('origin') || ''
      const allowedOrigins = new Set<string>([
        'http://localhost:3000',
        'https://animesenpai.app',
        'https://www.animesenpai.app',
      ])
      const isVercelPreview = origin.endsWith('.vercel.app')
      const isAllowedOrigin = allowedOrigins.has(origin) || isVercelPreview
      const corsOrigin = isAllowedOrigin ? origin : ''

      // Build common security headers
      const requestNonce = Math.random().toString(36).slice(2)
      const imgSrc = [
        "'self'",
        "https:",
        "cdn.myanimelist.net",
        "i.ytimg.com",
        "animesenpai.app",
        "www.animesenpai.app",
      ].join(' ')
      const connectSrc = [
        "'self'",
        'http://localhost:3005',
        'https://*.sentry.io',
        'https://*.ingest.sentry.io',
      ].join(' ')
      const csp = [
        `default-src 'self'`,
        `base-uri 'self'`,
        `object-src 'none'`,
        `script-src 'self' 'nonce-${requestNonce}' https: 'strict-dynamic'`,
        `style-src 'self'`,
        `img-src ${imgSrc} data: blob:`,
        `font-src 'self' https: data:`,
        `media-src 'self' https:`,
        `connect-src ${connectSrc}`,
        `frame-ancestors 'none'`,
      ].join('; ')

      const baseHeaders: Record<string, string> = {
        'X-Request-ID': requestId,
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Resource-Policy': 'same-site',
        'X-Frame-Options': 'DENY',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'Content-Security-Policy': csp,
        'Vary': 'Origin',
      }
      
      try {
        // Security analysis
        const securityAnalysis = await securityManager.analyzeRequest(request)
        if (!securityAnalysis.allowed) {
          logger.warn('Request blocked by security', logContext, {
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
              ...baseHeaders,
              'Content-Type': 'application/json',
              ...(corsOrigin && { 'Access-Control-Allow-Origin': corsOrigin }),
              'Access-Control-Allow-Credentials': 'true',
            } as Record<string, string>,
          })
        }

        // Log incoming request
        logger.request(`${request.method} ${request.url}`, logContext, {
          userAgent: request.headers.get('user-agent'),
          contentLength: request.headers.get('content-length'),
          contentType: request.headers.get('content-type'),
        })
      
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 200,
          headers: {
            ...baseHeaders,
            ...(corsOrigin && { 'Access-Control-Allow-Origin': corsOrigin }),
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-trpc-source',
            'Access-Control-Allow-Credentials': 'true',
          } as Record<string, string>,
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
            ...baseHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            ...(corsOrigin && { 'Access-Control-Allow-Origin': corsOrigin }),
            'Access-Control-Allow-Credentials': 'true',
            'X-Request-ID': requestId,
            ...(clientTraceId ? { 'X-Client-Trace-Id': clientTraceId } : {}),
          } as Record<string, string>,
        })
      }

      // Readiness probe endpoint (for Kubernetes/load balancers)
      if (url.pathname === '/ready') {
        const { healthChecker } = await import('./lib/health-check')
        const readinessStatus = await healthChecker.getReadinessStatus()
        const isReady = readinessStatus.ready
        
        logger.api('Readiness check requested', logContext, { readinessStatus })
        
        return new Response(JSON.stringify(readinessStatus, null, 2), {
          status: isReady ? 200 : 503,
          headers: {
            ...baseHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            ...(corsOrigin && { 'Access-Control-Allow-Origin': corsOrigin }),
            'Access-Control-Allow-Credentials': 'true',
            'X-Request-ID': requestId,
          } as Record<string, string>,
        })
      }

      // Liveness probe endpoint (for Kubernetes)
      if (url.pathname === '/live') {
        return new Response(JSON.stringify({
          status: 'alive',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
        }), {
          status: 200,
          headers: {
            ...baseHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            ...(corsOrigin && { 'Access-Control-Allow-Origin': corsOrigin }),
            'Access-Control-Allow-Credentials': 'true',
            'X-Request-ID': requestId,
          } as Record<string, string>,
        })
      }

      // Metrics endpoint
      if (url.pathname === '/metrics') {
        const { queryStats } = await import('./lib/db')
        const { getRateLimitStats } = await import('./lib/rate-limiter')
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
            ...baseHeaders,
            'Content-Type': 'application/json',
            ...(corsOrigin && { 'Access-Control-Allow-Origin': corsOrigin }),
            'Access-Control-Allow-Credentials': 'true',
          } as Record<string, string>,
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
          } as Record<string, string>,
        })
      }

      // Silently handle common browser requests for static files (not API endpoints)
      const staticFileExtensions = ['.ico', '.png', '.jpg', '.svg', '.css', '.js', '.map']
      const isStaticFile = staticFileExtensions.some(ext => url.pathname.endsWith(ext))
      if (isStaticFile) {
        return new Response('Not found', {
          status: 404,
          headers: {
            ...baseHeaders,
            ...(corsOrigin && { 'Access-Control-Allow-Origin': corsOrigin }),
            'X-Request-ID': requestId,
            ...(clientTraceId ? { 'X-Client-Trace-Id': clientTraceId } : {}),
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
      if (clientTraceId) finalResponse.headers.set('X-Client-Trace-Id', clientTraceId)
      
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
            clientTraceId,
            requestId,
          }
        )
      }

      // Intercept auth responses to set httpOnly cookies (tokens also remain in response body for frontend)
      try {
        const isSignin = url.pathname.includes('/api/trpc/auth.signin')
        const isSignup = url.pathname.includes('/api/trpc/auth.signup')
        const isRefresh = url.pathname.includes('/api/trpc/auth.refreshToken')
        if (isSignin || isSignup || isRefresh) {
          const text = await responseClone.text()
          if (text) {
            const json = JSON.parse(text)
            if (json && json.result && json.result.data) {
              const data = json.result.data
              const accessToken = data.accessToken
              const refreshToken = data.refreshToken
              const user = data.user
              if (accessToken && refreshToken) {
                // Build cookies
                const isProd = process.env.NODE_ENV === 'production'
                const cookieBase = `Path=/; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`
                const accessMaxAge = 60 * 15 // 15 minutes
                const refreshMaxAge = 60 * 60 * 24 * 30 // 30 days
                const setCookies = [
                  `access_token=${accessToken}; Max-Age=${accessMaxAge}; ${cookieBase}`,
                  `refresh_token=${refreshToken}; Max-Age=${refreshMaxAge}; ${cookieBase}`,
                  // CSRF double-submit cookie seed
                  `csrf_token_seed=1; Path=/; SameSite=Lax${isProd ? '; Secure' : ''}`,
                ]
                // Keep tokens in response body (frontend needs them for localStorage/sessionStorage)
                // Also set httpOnly cookies as a backup/alternative auth method
                const sanitized = {
                  ...json,
                  result: {
                    ...json.result,
                    data: {
                      user,
                      accessToken,
                      refreshToken,
                      expiresAt: data.expiresAt,
                    },
                  },
                }
                finalResponse = new Response(JSON.stringify(sanitized), {
                  status: response.status,
                  headers: {
                    ...Object.fromEntries(response.headers.entries()),
                    'Set-Cookie': setCookies.join(', '),
                    'Content-Type': 'application/json',
                  },
                })
              }
            }
          }
        }
      } catch {}

      // Enforce CORS denial for disallowed origins on credentialed requests
      if (!isAllowedOrigin && request.headers.get('cookie')) {
        return new Response(JSON.stringify({ error: 'CORS origin not allowed' }), {
          status: 403,
          headers: {
            ...baseHeaders,
            'Content-Type': 'application/json',
          } as Record<string, string>,
        })
      }

      // Set security/CORS headers on final response
      const mergedHeaders = new Headers(finalResponse.headers)
      Object.entries(baseHeaders).forEach(([k, v]) => mergedHeaders.set(k, v))
      if (corsOrigin) {
        mergedHeaders.set('Access-Control-Allow-Origin', corsOrigin)
        mergedHeaders.set('Access-Control-Allow-Credentials', 'true')
      }
      // Add basic rate-limit headers (IP-based)
      try {
        const ipAddr = logContext.ipAddress || ''
        if (ipAddr) {
          const { getRateLimitHeaders } = await import('./lib/rate-limiter')
          const rlHeaders = getRateLimitHeaders(ipAddr, 'public', url.pathname)
          Object.entries(rlHeaders).forEach(([k, v]) => mergedHeaders.set(k, v))
        }
      } catch {}

      // X-Robots-Tag on sensitive paths
      if (
        /^\/api\/(auth|admin|user|gdpr|privacy|messaging|notifications|roleManagement)/.test(url.pathname)
      ) {
        mergedHeaders.set('X-Robots-Tag', 'noindex, nofollow')
      }

      return new Response(finalResponse.body, {
        status: finalResponse.status,
        headers: mergedHeaders,
      })
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

  logger.info('AnimeSenpai API Server started', {
    port,
    trpcEndpoint: `http://localhost:${port}/api/trpc`,
    environment: process.env.NODE_ENV || 'development'
  })
})()
