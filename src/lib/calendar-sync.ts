/**
 * Calendar Sync Service
 * 
 * Keeps currently airing anime data fresh by syncing from Jikan API
 * Updates broadcast schedules, episode counts, and air dates
 */

import { db } from './db.js'
import { logger } from './logger.js'
import { getContentFilter } from '../routers/anime'
import { syncAnimeCalendarDataFromAniList } from './anilist-client.js'
import { syncCalendarDataFromJikanSchedules } from './jikan-schedules-client.js'
import { fetchAllJikanSeasonNow, fetchAllJikanSeasonUpcoming } from './jikan-seasons-client.js'
import { shouldFilterAnimeFromJikanData, shouldFilterAnimeFromJikanFull, type JikanAnimePartial } from './anime-filter-utils.js'
import { fetchAnimeFromJikan as fetchFullAnimeFromJikan, syncAnimeToDatabase } from './anime-sync.js'

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4'
const RATE_LIMIT_DELAY = 1200 // 1200ms = 0.83 req/sec (safe rate)
const MAX_RETRIES = 3
const SYNC_INTERVAL_HOURS = 6 // Only sync anime that haven't been synced in the last 6 hours

/**
 * Shared interface for anime data from any Jikan endpoint
 */
interface JikanAnimeData {
  mal_id: number
  broadcast?: {
    day?: string
    time?: string
    timezone?: string
    string?: string
  }
  aired?: {
    from?: string
    to?: string | null
    prop?: {
      from?: {
        day?: number
        month?: number
        year?: number
      }
      to?: {
        day?: number | null
        month?: number | null
        year?: number | null
      }
    }
    string?: string
  }
  episodes?: number
  status?: string
  airing?: boolean
  season?: string
  year?: number
}

/**
 * Shared helper function to update anime calendar data from any Jikan endpoint
 * Returns the updates object and whether any updates were made
 */
function extractCalendarUpdates(animeData: JikanAnimeData): {
  updates: Record<string, any>
  updateReasons: string[]
} {
  const updates: Record<string, any> = {}
  const updateReasons: string[] = []

  // Update broadcast info
  if (animeData.broadcast?.string) {
    updates.broadcast = animeData.broadcast.string
    updateReasons.push('broadcast')
  } else if (animeData.broadcast?.day && animeData.broadcast?.time) {
    // Construct broadcast string from day and time
    const dayName = animeData.broadcast.day.charAt(0).toUpperCase() + animeData.broadcast.day.slice(1)
    const timezone = animeData.broadcast.timezone || 'JST'
    updates.broadcast = `${dayName}s at ${animeData.broadcast.time} (${timezone})`
    updateReasons.push('broadcast')
  }

  // Update air dates
  if (animeData.aired?.from) {
    updates.startDate = new Date(animeData.aired.from)
    updateReasons.push('startDate')
  }
  if (animeData.aired?.to) {
    updates.endDate = new Date(animeData.aired.to)
    updateReasons.push('endDate')
  } else if (animeData.airing || animeData.status === 'Currently Airing') {
    updates.endDate = null // Clear end date if still airing
    updateReasons.push('endDate cleared')
  }

  // Update episode count
  if (animeData.episodes !== undefined) {
    updates.episodes = animeData.episodes
    updateReasons.push('episodes')
  }

  // Update status and airing flag
  if (animeData.status) {
    updates.status = animeData.status
    updateReasons.push('status')
  }
  if (animeData.airing !== undefined) {
    updates.airing = animeData.airing
    updateReasons.push('airing')
  }

  // Update season/year
  if (animeData.season) {
    updates.season = animeData.season.toLowerCase()
    updateReasons.push('season')
  }
  if (animeData.year) {
    updates.year = animeData.year
    updateReasons.push('year')
  } else if (animeData.aired?.prop?.from?.year) {
    // Extract year from aired prop if year not directly available
    updates.year = animeData.aired.prop.from.year
    updateReasons.push('year')
  }

  // Extract season from month if not directly available
  if (!animeData.season && animeData.aired?.prop?.from?.month) {
    const month = animeData.aired.prop.from.month
    if (month >= 1 && month <= 3) {
      updates.season = 'winter'
      updateReasons.push('season')
    } else if (month >= 4 && month <= 6) {
      updates.season = 'spring'
      updateReasons.push('season')
    } else if (month >= 7 && month <= 9) {
      updates.season = 'summer'
      updateReasons.push('season')
    } else if (month >= 10 && month <= 12) {
      updates.season = 'fall'
      updateReasons.push('season')
    }
  }

  return { updates, updateReasons }
}

interface JikanAnimeResponse {
  data: {
    mal_id: number
    title: string
    title_english?: string
    broadcast?: {
      string?: string
    }
    aired?: {
      from?: string
      to?: string
      string?: string
    }
    episodes?: number
    status?: string
    airing?: boolean
    season?: string
    year?: number
  }
}

/**
 * Fetch anime data from Jikan API with retries
 */
async function fetchAnimeFromJikan(malId: number, retries = 0): Promise<JikanAnimeResponse | null> {
  try {
    const url = `${JIKAN_BASE_URL}/anime/${malId}`
    const response = await fetch(url)

    if (!response.ok) {
      if (response.status === 429 && retries < MAX_RETRIES) {
        // Rate limited - wait longer and retry
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY * 3))
        return fetchAnimeFromJikan(malId, retries + 1)
      }
      throw new Error(`Jikan API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as JikanAnimeResponse
    return data
  } catch (error) {
    if (retries < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY * (retries + 1)))
      return fetchAnimeFromJikan(malId, retries + 1)
    }
    logger.error(`Failed to fetch anime ${malId} from Jikan after ${MAX_RETRIES} retries`, error as Error)
    return null
  }
}

/**
 * Sync a single anime's calendar data
 * Uses Jikan as primary source, AniList as fallback for missing data
 */
async function syncAnimeCalendarData(animeId: string, malId: number): Promise<boolean> {
  try {
    const jikanData = await fetchAnimeFromJikan(malId)
    
    if (!jikanData?.data) {
      logger.debug(`No data returned from Jikan for anime ${animeId}, trying AniList fallback`, {}, {
        animeId,
        malId,
      })
      
      // Try AniList as fallback
      const anilistSuccess = await syncAnimeCalendarDataFromAniList(animeId, malId)
      if (anilistSuccess) {
        logger.debug(`Successfully synced from AniList fallback for anime ${animeId}`, {}, {
          animeId,
          malId,
        })
        return true
      }
      
      return false
    }

    const animeData = jikanData.data
    const updates: any = {}
    const updateReasons: string[] = []

    // Update broadcast info if available
    if (animeData.broadcast?.string) {
      updates.broadcast = animeData.broadcast.string
      updateReasons.push('broadcast')
    }

    // Update air dates
    if (animeData.aired?.from) {
      const newStartDate = new Date(animeData.aired.from)
      updates.startDate = newStartDate
      updateReasons.push('startDate')
    }
    if (animeData.aired?.to) {
      updates.endDate = new Date(animeData.aired.to)
      updateReasons.push('endDate')
    } else if (animeData.status === 'Currently Airing') {
      updates.endDate = null // Clear end date if still airing
      updateReasons.push('endDate cleared')
    }

    // Update episode count
    if (animeData.episodes !== undefined) {
      updates.episodes = animeData.episodes
      updateReasons.push('episodes')
    }

    // Update status and airing flag
    if (animeData.status) {
      updates.status = animeData.status
      updates.airing = animeData.airing || false
      updateReasons.push('status/airing')
    }

    // Update season/year if available
    if (animeData.season) {
      updates.season = animeData.season.toLowerCase()
      updateReasons.push('season')
    }
    if (animeData.year) {
      updates.year = animeData.year
      updateReasons.push('year')
    }

    // Only update if we have changes
    if (Object.keys(updates).length > 0) {
      await db.anime.update({
        where: { id: animeId },
        data: {
          ...updates,
          updatedAt: new Date(),
        },
      })

      logger.debug(`Synced calendar data for anime ${animeId}`, {}, {
        animeId,
        malId,
        title: animeData.title,
        updates: updateReasons,
        fieldsUpdated: Object.keys(updates),
        source: 'Jikan',
      })

      // Check if we're missing critical data and try AniList as supplement
      const currentAnime = await db.anime.findUnique({
        where: { id: animeId },
        select: {
          broadcast: true,
          startDate: true,
          episodes: true,
        },
      })

      // If broadcast is missing, try AniList
      if (!currentAnime?.broadcast) {
        logger.debug(`Broadcast missing for ${animeId}, trying AniList supplement`, {}, {
          animeId,
          malId,
        })
        const anilistSuccess = await syncAnimeCalendarDataFromAniList(animeId, malId)
        if (anilistSuccess) {
          logger.debug(`AniList supplemented missing broadcast data for anime ${animeId}`, {}, {
            animeId,
            malId,
          })
        }
      }

      return true
    } else {
      logger.debug(`No updates needed for anime ${animeId}`, {}, {
        animeId,
        malId,
        title: animeData.title,
      })
      
      // Even if no updates, check if we're missing data and try AniList
      const currentAnime = await db.anime.findUnique({
        where: { id: animeId },
        select: {
          broadcast: true,
          startDate: true,
          episodes: true,
        },
      })

      if (!currentAnime?.broadcast || !currentAnime?.startDate) {
        logger.debug(`Missing critical data for ${animeId}, trying AniList supplement`, {}, {
          animeId,
          malId,
          missingFields: {
            broadcast: !currentAnime?.broadcast,
            startDate: !currentAnime?.startDate,
          },
        })
        const anilistSuccess = await syncAnimeCalendarDataFromAniList(animeId, malId)
        return anilistSuccess
      }
      
      return false
    }
  } catch (error) {
    logger.error(`Error syncing anime ${animeId}`, error as Error, {}, {
      animeId,
      malId,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    return false
  }
}

/**
 * Sync calendar data from Jikan seasons/now endpoint
 * Fetches current season anime and updates database records
 */
export async function syncCalendarDataFromJikanSeasonsNow(): Promise<{
  synced: number
  failed: number
  total: number
  added: number
  filtered: number
}> {
  const startTime = Date.now()
  logger.system('Starting calendar sync from Jikan seasons/now...', {}, {})

  let synced = 0
  let failed = 0
  let added = 0
  let filtered = 0
  const processedMalIds = new Set<number>()

  try {
    const seasonAnime = await fetchAllJikanSeasonNow()
    const totalAnime = seasonAnime.length

    logger.system(`Fetched ${totalAnime} anime from seasons/now`, {}, {
      count: totalAnime,
    })

    for (const anime of seasonAnime) {
      // Skip if already processed
      if (processedMalIds.has(anime.mal_id)) {
        continue
      }
      processedMalIds.add(anime.mal_id)

      try {
        // Find anime in our database by MAL ID
        const existingAnime = await db.anime.findUnique({
          where: { malId: anime.mal_id },
          select: { id: true },
        })

        if (!existingAnime) {
          // Anime not in our database - check if we should add it
          // First, apply filters to partial data
          if (shouldFilterAnimeFromJikanData(anime as JikanAnimePartial)) {
            filtered++
            logger.debug(`Filtered out anime ${anime.mal_id}: ${anime.title}`, {}, {
              malId: anime.mal_id,
              title: anime.title,
            })
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
            continue
          }

          // Fetch full anime details
          const fullAnimeData = await fetchFullAnimeFromJikan(anime.mal_id)
          if (!fullAnimeData) {
            failed++
            logger.warn(`Failed to fetch full details for anime ${anime.mal_id}`, {}, {
              malId: anime.mal_id,
              title: anime.title,
            })
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
            continue
          }

          // Apply filters to full data
          if (shouldFilterAnimeFromJikanFull(fullAnimeData)) {
            filtered++
            logger.debug(`Filtered out anime ${anime.mal_id} (full check): ${fullAnimeData.title}`, {}, {
              malId: anime.mal_id,
              title: fullAnimeData.title,
            })
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
            continue
          }

          // Create new anime
          const result = await syncAnimeToDatabase(fullAnimeData)
          if (result.created) {
            added++
            synced++
            logger.debug(`Added new anime ${anime.mal_id}: ${fullAnimeData.title}`, {}, {
              malId: anime.mal_id,
              title: fullAnimeData.title,
            })
          }

          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
          continue
        }

        // Extract calendar updates using shared helper
        const { updates, updateReasons } = extractCalendarUpdates(anime)

        // Only update if we have changes
        if (Object.keys(updates).length > 0) {
          await db.anime.update({
            where: { id: existingAnime.id },
            data: {
              ...updates,
              updatedAt: new Date(),
            },
          })

          synced++
          logger.debug(`Synced calendar data for anime ${existingAnime.id} from seasons/now`, {}, {
            animeId: existingAnime.id,
            malId: anime.mal_id,
            title: anime.title,
            updates: updateReasons,
          })
        }

        // Rate limit between anime updates
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
      } catch (error) {
        failed++
        logger.error(`Error syncing anime ${anime.mal_id} from seasons/now`, error as Error, {}, {
          malId: anime.mal_id,
          title: anime.title,
        })
      }
    }

    const duration = Date.now() - startTime
    const uniqueAnimeCount = processedMalIds.size

    logger.system('Calendar sync from Jikan seasons/now completed', {}, {
      totalAnime,
      uniqueAnime: uniqueAnimeCount,
      synced,
      added,
      filtered,
      failed,
      duration: `${Math.round(duration / 1000)}s`,
      successRate: uniqueAnimeCount > 0 ? `${((synced / uniqueAnimeCount) * 100).toFixed(1)}%` : '0%',
    })

    return {
      synced,
      failed,
      total: uniqueAnimeCount,
      added,
      filtered,
    }
  } catch (error) {
    logger.error('Calendar sync from Jikan seasons/now failed', error as Error, {}, {})
    throw error
  }
}

/**
 * Sync calendar data from Jikan seasons/upcoming endpoint
 * Fetches upcoming season anime and updates database records
 * Now also adds new anime if they don't exist (after filtering)
 */
export async function syncCalendarDataFromJikanSeasonsUpcoming(): Promise<{
  synced: number
  failed: number
  total: number
  added: number
  filtered: number
}> {
  const startTime = Date.now()
  logger.system('Starting calendar sync from Jikan seasons/upcoming...', {}, {})

  let synced = 0
  let failed = 0
  let added = 0
  let filtered = 0
  const processedMalIds = new Set<number>()

  try {
    const seasonAnime = await fetchAllJikanSeasonUpcoming()
    const totalAnime = seasonAnime.length

    logger.system(`Fetched ${totalAnime} anime from seasons/upcoming`, {}, {
      count: totalAnime,
    })

    for (const anime of seasonAnime) {
      // Skip if already processed
      if (processedMalIds.has(anime.mal_id)) {
        continue
      }
      processedMalIds.add(anime.mal_id)

      try {
        // Find anime in our database by MAL ID
        const existingAnime = await db.anime.findUnique({
          where: { malId: anime.mal_id },
          select: { id: true },
        })

        if (!existingAnime) {
          // Anime not in our database - check if we should add it
          // First, apply filters to partial data
          if (shouldFilterAnimeFromJikanData(anime as JikanAnimePartial)) {
            filtered++
            logger.debug(`Filtered out anime ${anime.mal_id}: ${anime.title}`, {}, {
              malId: anime.mal_id,
              title: anime.title,
            })
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
            continue
          }

          // Fetch full anime details
          const fullAnimeData = await fetchFullAnimeFromJikan(anime.mal_id)
          if (!fullAnimeData) {
            failed++
            logger.warn(`Failed to fetch full details for anime ${anime.mal_id}`, {}, {
              malId: anime.mal_id,
              title: anime.title,
            })
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
            continue
          }

          // Apply filters to full data
          if (shouldFilterAnimeFromJikanFull(fullAnimeData)) {
            filtered++
            logger.debug(`Filtered out anime ${anime.mal_id} (full check): ${fullAnimeData.title}`, {}, {
              malId: anime.mal_id,
              title: fullAnimeData.title,
            })
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
            continue
          }

          // Create new anime
          const result = await syncAnimeToDatabase(fullAnimeData)
          if (result.created) {
            added++
            synced++
            logger.debug(`Added new anime ${anime.mal_id}: ${fullAnimeData.title}`, {}, {
              malId: anime.mal_id,
              title: fullAnimeData.title,
            })
          }

          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
          continue
        }

        // Extract calendar updates using shared helper
        const { updates, updateReasons } = extractCalendarUpdates(anime)

        // Only update if we have changes
        if (Object.keys(updates).length > 0) {
          await db.anime.update({
            where: { id: existingAnime.id },
            data: {
              ...updates,
              updatedAt: new Date(),
            },
          })

          synced++
          logger.debug(`Synced calendar data for anime ${existingAnime.id} from seasons/upcoming`, {}, {
            animeId: existingAnime.id,
            malId: anime.mal_id,
            title: anime.title,
            updates: updateReasons,
          })
        }

        // Rate limit between anime updates
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
      } catch (error) {
        failed++
        logger.error(`Error syncing anime ${anime.mal_id} from seasons/upcoming`, error as Error, {}, {
          malId: anime.mal_id,
          title: anime.title,
        })
      }
    }

    const duration = Date.now() - startTime
    const uniqueAnimeCount = processedMalIds.size

    logger.system('Calendar sync from Jikan seasons/upcoming completed', {}, {
      totalAnime,
      uniqueAnime: uniqueAnimeCount,
      synced,
      added,
      filtered,
      failed,
      duration: `${Math.round(duration / 1000)}s`,
      successRate: uniqueAnimeCount > 0 ? `${((synced / uniqueAnimeCount) * 100).toFixed(1)}%` : '0%',
    })

    return {
      synced,
      failed,
      total: uniqueAnimeCount,
      added,
      filtered,
    }
  } catch (error) {
    logger.error('Calendar sync from Jikan seasons/upcoming failed', error as Error, {}, {})
    throw error
  }
}

/**
 * Sync all currently airing anime
 * This is the main function called by the background job
 * Orchestrates all three Jikan endpoints: seasons/now, schedules, and seasons/upcoming
 */
export async function syncAiringAnimeCalendarData(): Promise<void> {
  const startTime = Date.now()
  logger.system('Starting calendar sync for airing anime...', {}, {})

  const allResults = {
    seasonsNow: { synced: 0, failed: 0, total: 0, added: 0, filtered: 0 },
    schedules: { synced: 0, failed: 0, total: 0, added: 0, filtered: 0 },
    seasonsUpcoming: { synced: 0, failed: 0, total: 0, added: 0, filtered: 0 },
  }

  // Step 1: Sync from seasons/now (current airing anime)
  try {
    logger.system('Step 1: Syncing from Jikan seasons/now endpoint...', {}, {})
    const seasonsNowResult = await syncCalendarDataFromJikanSeasonsNow()
    allResults.seasonsNow = seasonsNowResult
    
    logger.system('Completed sync from seasons/now', {}, {
      synced: seasonsNowResult.synced,
      added: seasonsNowResult.added,
      filtered: seasonsNowResult.filtered,
      failed: seasonsNowResult.failed,
      total: seasonsNowResult.total,
    })

    // Rate limit between endpoint calls
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
  } catch (error) {
    logger.error('Jikan seasons/now endpoint failed, continuing with other endpoints', error as Error, {}, {})
  }

  // Step 2: Sync from schedules (all weekly schedules)
  try {
    logger.system('Step 2: Syncing from Jikan schedules endpoint...', {}, {})
    const schedulesResult = await syncCalendarDataFromJikanSchedules()
    allResults.schedules = schedulesResult
    
    logger.system('Completed sync from schedules', {}, {
      synced: schedulesResult.synced,
      added: schedulesResult.added,
      filtered: schedulesResult.filtered,
      failed: schedulesResult.failed,
      total: schedulesResult.total,
    })

    // Rate limit between endpoint calls
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
  } catch (error) {
    logger.error('Jikan schedules endpoint failed, continuing with other endpoints', error as Error, {}, {})
  }

  // Step 3: Sync from seasons/upcoming (upcoming anime)
  try {
    logger.system('Step 3: Syncing from Jikan seasons/upcoming endpoint...', {}, {})
    const seasonsUpcomingResult = await syncCalendarDataFromJikanSeasonsUpcoming()
    allResults.seasonsUpcoming = seasonsUpcomingResult
    
    logger.system('Completed sync from seasons/upcoming', {}, {
      synced: seasonsUpcomingResult.synced,
      added: seasonsUpcomingResult.added,
      filtered: seasonsUpcomingResult.filtered,
      failed: seasonsUpcomingResult.failed,
      total: seasonsUpcomingResult.total,
    })
  } catch (error) {
    logger.error('Jikan seasons/upcoming endpoint failed', error as Error, {}, {})
  }

  // Aggregate statistics
  const totalSynced = allResults.seasonsNow.synced + allResults.schedules.synced + allResults.seasonsUpcoming.synced
  const totalFailed = allResults.seasonsNow.failed + allResults.schedules.failed + allResults.seasonsUpcoming.failed
  const totalProcessed = allResults.seasonsNow.total + allResults.schedules.total + allResults.seasonsUpcoming.total
  const duration = Date.now() - startTime

  logger.system('Calendar sync completed - all endpoints processed', {}, {
    seasonsNow: {
      synced: allResults.seasonsNow.synced,
      added: allResults.seasonsNow.added,
      filtered: allResults.seasonsNow.filtered,
      failed: allResults.seasonsNow.failed,
      total: allResults.seasonsNow.total,
    },
    schedules: {
      synced: allResults.schedules.synced,
      added: allResults.schedules.added,
      filtered: allResults.schedules.filtered,
      failed: allResults.schedules.failed,
      total: allResults.schedules.total,
    },
    seasonsUpcoming: {
      synced: allResults.seasonsUpcoming.synced,
      added: allResults.seasonsUpcoming.added,
      filtered: allResults.seasonsUpcoming.filtered,
      failed: allResults.seasonsUpcoming.failed,
      total: allResults.seasonsUpcoming.total,
    },
    totals: {
      synced: totalSynced,
      failed: totalFailed,
      total: totalProcessed,
    },
    duration: `${Math.round(duration / 1000)}s`,
    successRate: totalProcessed > 0 ? `${((totalSynced / totalProcessed) * 100).toFixed(1)}%` : '0%',
  })

  // Fallback to individual anime sync if all endpoints failed or results are poor
  if (totalSynced === 0 || (totalFailed > totalSynced * 2)) {
    logger.system('Fallback: Using individual anime sync method due to poor endpoint results...', {}, {})

  const failedAnime: Array<{ id: string; malId: number; title: string; reason?: string }> = []
  const skippedAnime: Array<{ id: string; malId: number; title: string; reason: string }> = []

  try {
    // Calculate cutoff time for incremental sync
    const cutoffTime = new Date()
    cutoffTime.setHours(cutoffTime.getHours() - SYNC_INTERVAL_HOURS)

    // Get all currently airing anime that have MAL IDs
    // For incremental sync: only sync anime that haven't been updated recently
    // or don't have broadcast info (first-time sync)
    const airingAnime = await db.anime.findMany({
      where: {
        status: 'Currently Airing',
        airing: true,
        malId: { not: null },
        OR: [
          // Anime that hasn't been synced recently
          {
            updatedAt: {
              lt: cutoffTime,
            },
          },
          // Anime missing critical calendar data
          {
            broadcast: null,
          },
          {
            startDate: null,
          },
        ],
        ...getContentFilter(),
      },
      select: {
        id: true,
        malId: true,
        title: true,
        updatedAt: true,
        broadcast: true,
        startDate: true,
      },
      orderBy: {
        // Prioritize anime missing data or updated longest ago
        updatedAt: 'asc',
      },
    })

    // Also get count of all airing anime for comparison
    const totalAiringCount = await db.anime.count({
      where: {
        status: 'Currently Airing',
        airing: true,
        malId: { not: null },
        ...getContentFilter(),
      },
    })

    const skippedCount = totalAiringCount - airingAnime.length

    logger.system(`Found ${airingAnime.length} airing anime to sync (${skippedCount} skipped - recently synced)`, {}, {
      count: airingAnime.length,
      totalAiring: totalAiringCount,
      skipped: skippedCount,
      syncIntervalHours: SYNC_INTERVAL_HOURS,
    })

    if (airingAnime.length === 0) {
      logger.system('No airing anime found to sync', {}, {})
      return
    }

    let synced = 0
    let failed = 0
    let skipped = 0
    let alreadyUpToDate = 0

    // Sync each anime with rate limiting
    for (const anime of airingAnime) {
      if (!anime.malId) {
        skipped++
        skippedAnime.push({
          id: anime.id,
          malId: 0,
          title: anime.title,
          reason: 'No MAL ID',
        })
        continue
      }

      try {
        // Quick check: skip if recently updated and has all required data
        const needsSync = !anime.broadcast || 
                         !anime.startDate || 
                         anime.updatedAt < cutoffTime
        
        if (!needsSync) {
          alreadyUpToDate++
          continue
        }

        const success = await syncAnimeCalendarData(anime.id, anime.malId)
        if (success) {
          synced++
        } else {
          failed++
          failedAnime.push({
            id: anime.id,
            malId: anime.malId,
            title: anime.title,
            reason: 'Sync returned false',
          })
        }
      } catch (error) {
        failed++
        failedAnime.push({
          id: anime.id,
          malId: anime.malId,
          title: anime.title,
          reason: error instanceof Error ? error.message : 'Unknown error',
        })
        logger.error(`Failed to sync anime ${anime.id} (MAL: ${anime.malId})`, error as Error, {}, {
          animeId: anime.id,
          malId: anime.malId,
          title: anime.title,
        })
      }

      // Rate limit: wait between requests
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
    }

    const duration = Date.now() - startTime
    const successRate = airingAnime.length > 0 
      ? ((synced / airingAnime.length) * 100).toFixed(1) 
      : '0'
    
    logger.system('Calendar sync completed', {}, {
      total: airingAnime.length,
      synced,
      failed,
      skipped,
      alreadyUpToDate,
      successRate: `${successRate}%`,
      duration: `${Math.round(duration / 1000)}s`,
      avgTimePerAnime: airingAnime.length > 0 ? `${Math.round(duration / airingAnime.length)}ms` : '0ms',
      totalAiringAnime: totalAiringCount,
      efficiency: `${((synced / airingAnime.length) * 100).toFixed(1)}%`,
    })

    // Log failed anime details if any
    if (failedAnime.length > 0) {
      logger.warn(`Calendar sync had ${failedAnime.length} failures`, {}, {
        failedCount: failedAnime.length,
        failedAnime: failedAnime.slice(0, 10).map(a => ({
          title: a.title,
          malId: a.malId,
          reason: a.reason,
        })),
        // Only log first 10 to avoid log spam
        totalFailed: failedAnime.length,
      })
    }

    // Alert if failure rate is high (> 20%)
    const failureRate = (failed / airingAnime.length) * 100
    if (failureRate > 20) {
      logger.error('High calendar sync failure rate detected', new Error(`Failure rate: ${failureRate.toFixed(1)}%`), {}, {
        failureRate: `${failureRate.toFixed(1)}%`,
        failed,
        total: airingAnime.length,
        failedAnime: failedAnime.slice(0, 5).map(a => a.title),
      })
    }

    // Alert if same anime fails repeatedly (would need to track this in DB or cache)
    // For now, just log the failed anime for manual investigation
    if (failedAnime.length > 0) {
      logger.debug('Failed anime list for investigation', {}, {
        failedAnime: failedAnime.map(a => ({
          id: a.id,
          malId: a.malId,
          title: a.title,
          reason: a.reason,
        })),
      })
    }
  } catch (error) {
    logger.error('Calendar sync failed catastrophically', error as Error, {}, {
      failedAnime: failedAnime.length,
      skippedAnime: skippedAnime.length,
    })
    throw error
  }
  }
}

/**
 * Sync a specific anime by ID (for manual refresh)
 */
export async function syncAnimeById(animeId: string): Promise<boolean> {
  const anime = await db.anime.findUnique({
    where: { id: animeId },
    select: { malId: true },
  })

  if (!anime?.malId) {
    logger.warn(`Cannot sync anime ${animeId}: no MAL ID`, {}, { animeId })
    return false
  }

  return syncAnimeCalendarData(animeId, anime.malId)
}

/**
 * Sync seasonal anime for a specific season/year
 */
export async function syncSeasonalAnime(season: string, year: number): Promise<void> {
  logger.system(`Starting seasonal sync for ${season} ${year}...`, {}, { season, year })

  try {
    // Fetch seasonal anime from Jikan
    const url = `${JIKAN_BASE_URL}/seasons/${year}/${season.toLowerCase()}?limit=100`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Jikan API error: ${response.status}`)
    }

    const data = await response.json() as { data: JikanAnimeResponse['data'][] }
    const seasonalAnime = data.data || []

    logger.system(`Found ${seasonalAnime.length} seasonal anime`, {}, {
      season,
      year,
      count: seasonalAnime.length,
    })

    let synced = 0
    let created = 0
    let failed = 0

    for (const animeData of seasonalAnime) {
      try {
        // Check if anime exists by MAL ID
        const existing = await db.anime.findUnique({
          where: { malId: animeData.mal_id },
        })

        if (existing) {
          // Update existing anime
          await syncAnimeCalendarData(existing.id, animeData.mal_id)
          synced++
        } else {
          // Note: Full anime creation should use the import script
          // This just ensures calendar data is up to date
          logger.debug(`Anime ${animeData.mal_id} not in database, skipping`, {}, {
            malId: animeData.mal_id,
            title: animeData.title,
          })
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
      } catch (error) {
        logger.error(`Failed to sync seasonal anime ${animeData.mal_id}`, error as Error, {}, {
          malId: animeData.mal_id,
        })
        failed++
      }
    }

    logger.system('Seasonal sync completed', {}, {
      season,
      year,
      synced,
      created,
      failed,
    })
  } catch (error) {
    logger.error('Seasonal sync failed', error as Error, {}, { season, year })
    throw error
  }
}

