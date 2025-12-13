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
  const userAgent = req.headers['user-agent'] || ''
  const isVercelCron = vercelCronHeader === '1' || vercelCronHeader === 'true' || userAgent === 'vercel-cron/1.0'
  const authHeader = req.headers.authorization as string | undefined
  const cronSecret = process.env.CRON_SECRET
  const syncSecretToken = process.env.SYNC_SECRET_TOKEN || 'change-me-in-production'

  // Debug logging (remove in production if needed)
  console.log('Cron job auth check:', {
    isVercelCron,
    vercelCronHeader,
    userAgent,
    hasAuthHeader: !!authHeader,
    hasCronSecret: !!cronSecret,
    hasSyncSecretToken: !!syncSecretToken
  })

  // Verify authentication
  // Vercel sends CRON_SECRET as Authorization header value (not "Bearer <token>")
  // If x-vercel-cron header is present, trust it. Otherwise verify CRON_SECRET
  if (!isVercelCron || (isVercelCron && cronSecret)) {
    // Extract token from Authorization header (could be "Bearer <token>" or just "<token>")
    const providedToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader || (req.query.token as string | undefined)

    // If CRON_SECRET is set, Vercel sends it as Authorization header value
    if (cronSecret) {
      if (!providedToken || providedToken !== cronSecret) {
        console.log('CRON_SECRET mismatch:', {
          provided: providedToken ? providedToken.substring(0, 10) + '...' : 'none',
          expected: cronSecret.substring(0, 10) + '...',
          isVercelCron
        })
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Invalid CRON_SECRET'
        })
      }
    } else if (!isVercelCron) {
      // Only check SYNC_SECRET_TOKEN if not a Vercel cron and CRON_SECRET is not set
      if (!providedToken || providedToken !== syncSecretToken) {
        console.log('SYNC_SECRET_TOKEN mismatch:', {
          provided: providedToken ? providedToken.substring(0, 10) + '...' : 'none',
          expected: syncSecretToken.substring(0, 10) + '...'
        })
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Invalid SYNC_SECRET_TOKEN'
        })
      }
    }
  }

  try {
    // Run sync and wait for completion (Vercel cron jobs can run up to 5 minutes)
    const { syncDailyAnimeData } = await import('../../src/lib/anime-sync.js')
    
    console.log('Starting anime data sync...')
    const startTime = Date.now()
    
    // Execute sync and wait for it to complete
    const result = await syncDailyAnimeData()
    
    const duration = Date.now() - startTime
    
    console.log('Anime data sync completed', {
      added: result.added,
      updated: result.updated,
      filtered: result.filtered,
      errors: result.errors,
      duration: `${Math.round(duration / 1000)}s`,
    })

    return res.status(200).json({
      status: 'completed',
      message: 'Anime data sync completed successfully',
      timestamp: new Date().toISOString(),
      duration: `${Math.round(duration / 1000)}s`,
      results: {
        added: result.added,
        updated: result.updated,
        filtered: result.filtered,
        errors: result.errors,
      },
    })
  } catch (error: any) {
    console.error('Error during anime data sync', error)
    return res.status(500).json({
      error: 'Sync failed',
      message: error.message,
      timestamp: new Date().toISOString(),
    })
  }
}

