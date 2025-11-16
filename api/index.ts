import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '../src/routers'

// Vercel Serverless Function Handler
export default async function handler(req: any, res: any) {
  // Get allowed origins from environment
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) || []
  const origin = req.headers.origin || ''
  
  // Log CORS configuration for debugging
  console.log('🔧 CORS Debug:', {
    requestOrigin: origin,
    allowedOrigins: allowedOrigins,
    corsEnvVar: process.env.CORS_ORIGINS
  })
  
  // Check if origin is allowed
  const isAllowed = allowedOrigins.length === 0 || 
                    allowedOrigins.includes('*') || 
                    allowedOrigins.some(allowed => origin === allowed || origin.includes(allowed.replace('https://', '')))
  
  // Set CORS headers - must use specific origin with credentials, not '*'
  if (isAllowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else if (allowedOrigins.length > 0 && allowedOrigins[0]) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0])
  } else {
    // Fallback: if no CORS_ORIGINS set, allow the requesting origin
    res.setHeader('Access-Control-Allow-Origin', origin || 'https://animesenpai.app')
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-trpc-source')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Max-Age', '86400')

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // Health check
  if (req.url === '/health' || req.url === '/') {
    res.status(200).json({
      status: 'ok',
      message: 'AnimeSenpai API Server is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'production'
    })
    return
  }

  // Convert Vercel Request to Fetch Request
  const url = `https://${req.headers.host}${req.url}`
  const method = req.method || 'GET'
  
  // Build headers
  const headers = new Headers()
  Object.entries(req.headers).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      const headerValue = Array.isArray(value) ? value.join(', ') : String(value)
      headers.set(key, headerValue)
    }
  })

  // Build fetch request
  const fetchReq = new Request(
    url,
    method !== 'GET' && method !== 'HEAD'
      ? { method, headers, body: JSON.stringify(req.body ?? null) }
      : { method, headers }
  )

  try {
    // Use tRPC's fetch adapter
    const response = await fetchRequestHandler({
      endpoint: '/api/trpc',
      req: fetchReq,
      router: appRouter,
      createContext: ({ req }) => ({
        req: req as any,
      }),
    })

    // Copy response to Vercel response
    const data = await response.text()
    
    // Set response headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })
    
    // Ensure CORS headers are set
    res.setHeader('Access-Control-Allow-Origin', isAllowed ? (origin || '*') : (allowedOrigins[0] || '*'))
    
    res.status(response.status).send(data)
  } catch (error: any) {
    console.error('tRPC error:', error)
    res.status(500).json({ 
      error: { 
        message: error.message || 'Internal server error',
        code: error.code || 'INTERNAL_SERVER_ERROR'
      } 
    })
  }
}
