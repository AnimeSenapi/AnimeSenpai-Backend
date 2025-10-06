import { serve } from 'bun'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from './routers'
import { Context } from './lib/trpc'
import { logger, extractLogContext, generateRequestId } from './lib/logger'
import { createError, handleError } from './lib/errors'
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

const availablePort = await findAvailablePort(port)

const server = serve({
  port: availablePort,
  async fetch(request) {
    const startTime = Date.now()
    const requestId = request.headers.get('x-request-id') || generateRequestId()
    const url = new URL(request.url)
    const logContext = extractLogContext(request)
    
    try {
      // Log incoming request
      logger.request(request.method, request.url, logContext, {
        userAgent: request.headers.get('user-agent'),
        contentLength: request.headers.get('content-length'),
        contentType: request.headers.get('content-type'),
      })
      
      // Handle CORS
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'X-Request-ID': requestId,
          },
        })
      }

      // Health check endpoint
      if (url.pathname === '/health' || url.pathname === '/') {
        const healthResponse = {
          status: 'ok',
          message: 'AnimeSenpai API Server is running',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          environment: process.env.NODE_ENV || 'development',
        }
        
        logger.info('Health check requested', logContext)
        
        return new Response(JSON.stringify(healthResponse), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'X-Request-ID': requestId,
          },
        })
      }

      // Metrics endpoint
      if (url.pathname === '/metrics') {
        const avgResponseTime = performanceMetrics.requests > 0 
          ? (performanceMetrics.totalResponseTime / performanceMetrics.requests).toFixed(2)
          : 0
        
        const metricsResponse = {
          requests: performanceMetrics.requests,
          errors: performanceMetrics.errors,
          avgResponseTime: `${avgResponseTime}ms`,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          slowQueries: performanceMetrics.slowQueries.slice(-10), // Last 10 slow queries
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
            'Access-Control-Allow-Origin': '*',
            'X-Request-ID': requestId,
          },
        })
      }

      // Create context with request ID
      const context: Context = {
        req: request
      }

      // Handle tRPC requests
      const response = await fetchRequestHandler({
        endpoint: '/api/trpc',
        req: request,
        router: appRouter,
        createContext: () => context,
        onError: ({ path, error, input, ctx }) => {
          const errorLogContext = extractLogContext(request, ctx?.user?.id)
          
          // Log all errors with proper context
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

      // Add security and CORS headers to response
      finalResponse.headers.set('Access-Control-Allow-Origin', '*')
      finalResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      finalResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      finalResponse.headers.set('X-Request-ID', requestId)
      finalResponse.headers.set('X-Content-Type-Options', 'nosniff')
      finalResponse.headers.set('X-Frame-Options', 'DENY')
      finalResponse.headers.set('X-XSS-Protection', '1; mode=block')

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

      // Log response
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
          'Access-Control-Allow-Origin': '*',
          'X-Request-ID': requestId,
        },
      })
    }
  },
})

console.log(`🚀 AnimeSenpai API Server running on port ${availablePort}`)
console.log(`📡 tRPC endpoint: http://localhost:${availablePort}/api/trpc`)
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
