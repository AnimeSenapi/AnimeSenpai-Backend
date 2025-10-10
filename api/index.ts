import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '../src/routers'

// Vercel Serverless Function Handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Get allowed origins from environment
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['*']
  const origin = req.headers.origin || req.headers.referer || ''
  const isAllowed = allowedOrigins.includes('*') || allowedOrigins.some(allowed => origin.includes(allowed))
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? (origin || '*') : allowedOrigins[0])
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
    if (value) {
      headers.set(key, Array.isArray(value) ? value.join(', ') : value)
    }
  })

  // Build fetch request
  const fetchReq = new Request(url, {
    method,
    headers,
    body: method !== 'GET' && method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
  })

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
    res.setHeader('Access-Control-Allow-Origin', isAllowed ? (origin || '*') : allowedOrigins[0])
    
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
