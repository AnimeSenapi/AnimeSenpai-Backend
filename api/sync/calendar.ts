import type { VercelRequest, VercelResponse } from '@vercel/node'

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cron Jobs send GET requests by default
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Check if this is a Vercel Cron Job request
  // Check header case-insensitively
  const vercelCronHeader = req.headers['x-vercel-cron'] || req.headers['X-Vercel-Cron']
  const isVercelCron = vercelCronHeader === '1' || vercelCronHeader === 'true'
  const authHeader = req.headers.authorization as string | undefined
  const cronSecret = process.env.CRON_SECRET
  const syncSecretToken = process.env.SYNC_SECRET_TOKEN || 'change-me-in-production'

  // Debug logging (remove in production if needed)
  console.log('Cron job auth check:', {
    isVercelCron,
    vercelCronHeader,
    hasAuthHeader: !!authHeader,
    hasCronSecret: !!cronSecret,
    hasSyncSecretToken: !!syncSecretToken,
    userAgent: req.headers['user-agent']
  })

  // Verify authentication
  // Vercel sends CRON_SECRET as Authorization header value (not "Bearer <token>")
  // Or we check x-vercel-cron header
  if (!isVercelCron) {
    // Extract token from Authorization header (could be "Bearer <token>" or just "<token>")
    const providedToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader || (req.query.token as string | undefined)

    // If CRON_SECRET is set, Vercel sends it as Authorization header value
    if (cronSecret) {
      if (providedToken !== cronSecret) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Invalid CRON_SECRET'
        })
      }
    } else {
      // Fallback to SYNC_SECRET_TOKEN if CRON_SECRET is not set
      if (!providedToken || providedToken !== syncSecretToken) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Invalid SYNC_SECRET_TOKEN'
        })
      }
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

