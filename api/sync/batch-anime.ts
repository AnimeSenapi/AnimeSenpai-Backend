import type { VercelRequest, VercelResponse } from '@vercel/node'

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic'

/**
 * Batch sync endpoint for syncing large numbers of anime
 * Processes top anime pages incrementally to build up the database
 * Designed to run multiple times per day to gradually sync 21k+ anime
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cron Jobs send GET requests by default
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Check if this is a Vercel Cron Job request
  const vercelCronHeader = req.headers['x-vercel-cron'] || req.headers['X-Vercel-Cron']
  const userAgent = req.headers['user-agent'] || ''
  const isVercelCron = vercelCronHeader === '1' || vercelCronHeader === 'true' || userAgent === 'vercel-cron/1.0'
  const authHeader = req.headers.authorization as string | undefined
  const cronSecret = process.env.CRON_SECRET
  const syncSecretToken = process.env.SYNC_SECRET_TOKEN || 'change-me-in-production'

  // Debug logging
  console.log('Batch sync auth check:', {
    isVercelCron,
    vercelCronHeader,
    userAgent,
    hasAuthHeader: !!authHeader,
    hasCronSecret: !!cronSecret,
    hasSyncSecretToken: !!syncSecretToken
  })

  // Verify authentication
  if (!isVercelCron || (isVercelCron && cronSecret)) {
    const providedToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader || (req.query.token as string | undefined)

    if (cronSecret) {
      if (!providedToken || providedToken !== cronSecret) {
        console.log('CRON_SECRET mismatch')
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Invalid CRON_SECRET'
        })
      }
    } else if (!isVercelCron) {
      if (!providedToken || providedToken !== syncSecretToken) {
        console.log('SYNC_SECRET_TOKEN mismatch')
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Invalid SYNC_SECRET_TOKEN'
        })
      }
    }
  }

  try {
    // Get batch parameters from query or use defaults
    // Default: process 5 pages (125 anime), max 100 per run to fit within timeout
    const startPage = parseInt(req.query.startPage as string) || 1
    const pagesToProcess = parseInt(req.query.pages as string) || 5 // Process 5 pages per run (~125 anime)
    const maxAnimePerRun = parseInt(req.query.maxAnime as string) || 100 // Hard limit per run

    console.log('Starting batch anime sync...', {
      startPage,
      pagesToProcess,
      maxAnimePerRun,
    })

    const { syncBatchAnimeData } = await import('../../src/lib/anime-sync.js')
    const startTime = Date.now()
    
    // Execute batch sync
    const result = await syncBatchAnimeData({
      startPage,
      pagesToProcess,
      maxAnimePerRun,
    })
    
    const duration = Date.now() - startTime
    
    console.log('Batch anime sync completed', {
      startPage,
      endPage: startPage + pagesToProcess - 1,
      added: result.added,
      updated: result.updated,
      filtered: result.filtered,
      errors: result.errors,
      skipped: result.skipped,
      duration: `${Math.round(duration / 1000)}s`,
    })

    return res.status(200).json({
      status: 'completed',
      message: 'Batch anime sync completed successfully',
      timestamp: new Date().toISOString(),
      duration: `${Math.round(duration / 1000)}s`,
      nextPage: startPage + pagesToProcess, // Next page to process
      results: {
        added: result.added,
        updated: result.updated,
        filtered: result.filtered,
        errors: result.errors,
        skipped: result.skipped,
      },
    })
  } catch (error: any) {
    console.error('Error during batch anime sync', error)
    return res.status(500).json({
      error: 'Batch sync failed',
      message: error.message,
      timestamp: new Date().toISOString(),
    })
  }
}

