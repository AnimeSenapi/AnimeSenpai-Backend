import type { VercelRequest, VercelResponse } from '@vercel/node'

export const dynamic = 'force-dynamic'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Redirect to batch-anime with page 31-35
  const batchHandler = (await import('./batch-anime.js')).default
  req.query = { startPage: '31', pages: '5', maxAnime: '100' }
  return batchHandler(req, res)
}

