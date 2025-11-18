/**
 * Calendar Sync Service
 * 
 * Keeps currently airing anime data fresh by syncing from Jikan API
 * Updates broadcast schedules, episode counts, and air dates
 */

import { db } from './db'
import { logger } from './logger'
import { getContentFilter } from '../routers/anime'

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4'
const RATE_LIMIT_DELAY = 1200 // 1200ms = 0.83 req/sec (safe rate)
const MAX_RETRIES = 3

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

    const data: JikanAnimeResponse = await response.json()
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
 */
async function syncAnimeCalendarData(animeId: string, malId: number): Promise<boolean> {
  try {
    const jikanData = await fetchAnimeFromJikan(malId)
    if (!jikanData?.data) {
      return false
    }

    const animeData = jikanData.data
    const updates: any = {}

    // Update broadcast info if available
    if (animeData.broadcast?.string) {
      updates.broadcast = animeData.broadcast.string
    }

    // Update air dates
    if (animeData.aired?.from) {
      updates.startDate = new Date(animeData.aired.from)
    }
    if (animeData.aired?.to) {
      updates.endDate = new Date(animeData.aired.to)
    } else if (animeData.status === 'Currently Airing') {
      updates.endDate = null // Clear end date if still airing
    }

    // Update episode count
    if (animeData.episodes !== undefined) {
      updates.episodes = animeData.episodes
    }

    // Update status and airing flag
    if (animeData.status) {
      updates.status = animeData.status
      updates.airing = animeData.airing || false
    }

    // Update season/year if available
    if (animeData.season) {
      updates.season = animeData.season.toLowerCase()
    }
    if (animeData.year) {
      updates.year = animeData.year
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
        updates: Object.keys(updates),
      })

      return true
    }

    return false
  } catch (error) {
    logger.error(`Error syncing anime ${animeId}`, error as Error, {}, { animeId, malId })
    return false
  }
}

/**
 * Sync all currently airing anime
 * This is the main function called by the background job
 */
export async function syncAiringAnimeCalendarData(): Promise<void> {
  const startTime = Date.now()
  logger.system('Starting calendar sync for airing anime...', {}, {})

  try {
    // Get all currently airing anime that have MAL IDs
    const airingAnime = await db.anime.findMany({
      where: {
        status: 'Currently Airing',
        airing: true,
        malId: { not: null },
        ...getContentFilter(),
      },
      select: {
        id: true,
        malId: true,
        title: true,
      },
    })

    logger.system(`Found ${airingAnime.length} airing anime to sync`, {}, {
      count: airingAnime.length,
    })

    let synced = 0
    let failed = 0

    // Sync each anime with rate limiting
    for (const anime of airingAnime) {
      if (!anime.malId) continue

      const success = await syncAnimeCalendarData(anime.id, anime.malId)
      if (success) {
        synced++
      } else {
        failed++
      }

      // Rate limit: wait between requests
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
    }

    const duration = Date.now() - startTime
    logger.system('Calendar sync completed', {}, {
      total: airingAnime.length,
      synced,
      failed,
      duration: `${Math.round(duration / 1000)}s`,
    })
  } catch (error) {
    logger.error('Calendar sync failed', error as Error, {}, {})
    throw error
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

    const data = await response.json()
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

