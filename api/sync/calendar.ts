import type { VercelRequest, VercelResponse } from '@vercel/node'

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cron Jobs send GET requests by default
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Check if this is a Vercel Cron Job request
  const isVercelCron = req.headers['x-vercel-cron'] === '1'
  const authHeader = req.headers.authorization as string | undefined
  const cronSecret = process.env.CRON_SECRET
  const syncSecretToken = process.env.SYNC_SECRET_TOKEN || 'change-me-in-production'

  // Verify authentication
  // Vercel sends CRON_SECRET as Authorization header, or we check x-vercel-cron header
  if (!isVercelCron) {
    const providedToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : (req.query.token as string | undefined)

    // Check CRON_SECRET first (Vercel's recommended method)
    if (cronSecret && providedToken !== cronSecret) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Fallback to SYNC_SECRET_TOKEN if CRON_SECRET is not set
    if (!cronSecret && providedToken !== syncSecretToken) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  try {
    // Run sync in background (don't wait for completion)
    const { syncAiringAnimeCalendarData } = await import('../../src/lib/calendar-sync.js')
    syncAiringAnimeCalendarData()
      .then(() => {
        console.log('Calendar sync completed')
      })
      .catch((error: unknown) => {
        console.error('Calendar sync failed', error)
      })

    return res.status(202).json({
      status: 'started',
      message: 'Calendar sync started',
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Error starting calendar sync', error)
    return res.status(500).json({
      error: 'Failed to start sync',
      message: error.message,
    })
  }
}

