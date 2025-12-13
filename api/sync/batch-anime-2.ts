import type { VercelRequest, VercelResponse } from '@vercel/node'

export const dynamic = 'force-dynamic'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Redirect to batch-anime with page 8-14 (7 pages = ~175 anime, target ~50 new)
  const batchHandler = (await import('./batch-anime.js')).default
  req.query = { startPage: '8', pages: '7', maxAnime: '150' }
  return batchHandler(req, res)
}

