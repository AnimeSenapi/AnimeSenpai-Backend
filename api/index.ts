import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '../src/routers'
import type { Context } from '../src/lib/trpc'

// Vercel Serverless Function Handler
export default async function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: (): Context => ({
      req
    }),
  })
}

// Export for Vercel Edge Runtime (optional)
export const config = {
  runtime: 'nodejs',
}
