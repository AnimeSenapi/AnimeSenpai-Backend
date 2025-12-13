import type { VercelRequest, VercelResponse } from '@vercel/node'

export const dynamic = 'force-dynamic'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Redirect to batch-anime with page 11-15, process up to 150 anime per run
  const batchHandler = (await import('./batch-anime.js')).default
  req.query = { startPage: '11', pages: '5', maxAnime: '150' }
  return batchHandler(req, res)
}

