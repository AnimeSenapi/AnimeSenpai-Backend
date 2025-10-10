import type { VercelRequest, VercelResponse } from '@vercel/node'
import { appRouter } from '../src/routers'
import { createContext } from '../src/lib/trpc'

// Vercel Serverless Function Handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // Health check
  if (req.url === '/health') {
    res.status(200).json({
      status: 'ok',
      message: 'AnimeSenpai API Server is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'production'
    })
    return
  }

  try {
    // Import tRPC caller
    const caller = appRouter.createCaller(await createContext({ req: req as any, res: res as any }))
    
    // Parse tRPC request
    const path = req.url?.replace('/api/trpc/', '') || ''
    const [router, procedure] = path.split('.')
    
    if (!router || !procedure) {
      res.status(400).json({ error: 'Invalid tRPC endpoint' })
      return
    }

    // Get the procedure from router
    const routerObj = (caller as any)[router]
    if (!routerObj || !routerObj[procedure]) {
      res.status(404).json({ error: 'Procedure not found' })
      return
    }

    // Execute procedure
    const input = req.method === 'GET' ? req.query : req.body
    const result = await routerObj[procedure](input)
    
    res.status(200).json({ result: { data: result } })
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
