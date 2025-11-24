/**
 * Jikan Schedules API Client
 * 
 * Fetches weekly anime schedules directly from Jikan API
 * Uses /schedules endpoint which provides actual episode airing times
 */

import { logger } from './logger'
import { db } from './db'

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4'
const RATE_LIMIT_DELAY = 1200 // 1200ms = 0.83 req/sec (safe rate)
const MAX_RETRIES = 3

interface JikanScheduleAnime {
  mal_id: number
  url: string
  title: string
  title_english?: string
  title_japanese?: string
  images: {
    jpg?: {
      image_url?: string
      small_image_url?: string
      large_image_url?: string
    }
    webp?: {
      image_url?: string
      small_image_url?: string
      large_image_url?: string
    }
  }
  synopsis?: string
  type?: string
  airing: boolean
  aired: {
    from?: string
    to?: string | null
    prop: {
      from: {
        day?: number
        month?: number
        year?: number
      }
      to: {
        day?: number | null
        month?: number | null
        year?: number | null
      }
    }
    string?: string
  }
  episodes?: number
  score?: number
  scored_by?: number
  rank?: number
  popularity?: number
  members?: number
  favorites?: number
  genres: Array<{
    mal_id: number
    type: string
    name: string
    url: string
  }>
  studios: Array<{
    mal_id: number
    type: string
    name: string
    url: string
  }>
  broadcast?: {
    day?: string
    time?: string
    timezone?: string
    string?: string
  }
  producers: Array<{
    mal_id: number
    type: string
    name: string
    url: string
  }>
  licensors: Array<{
    mal_id: number
    type: string
    name: string
    url: string
  }>
}

interface JikanScheduleResponse {
  data: JikanScheduleAnime[]
  pagination?: {
    last_visible_page: number
    has_next_page: boolean
  }
}

/**
 * Fetch weekly schedule from Jikan API
 * @param day - Day of week: 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'other', 'unknown'. If not provided, fetches all schedules.
 * @param page - Page number (default: 1)
 * @param retries - Number of retries attempted
 */
async function fetchJikanSchedule(
  day?: string,
  page: number = 1,
  retries = 0
): Promise<JikanScheduleResponse | null> {
  try {
    const url = day 
      ? `${JIKAN_BASE_URL}/schedules?filter=${day}&page=${page}`
      : `${JIKAN_BASE_URL}/schedules?page=${page}`
    const response = await fetch(url)

    if (!response.ok) {
      if (response.status === 429 && retries < MAX_RETRIES) {
        // Rate limited - wait longer and retry
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY * 3))
        return fetchJikanSchedule(day, page, retries + 1)
      }
      throw new Error(`Jikan API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as JikanScheduleResponse
    return data
  } catch (error) {
    if (retries < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY * (retries + 1)))
      return fetchJikanSchedule(day, page, retries + 1)
    }
    logger.error(`Failed to fetch Jikan schedule${day ? ` for ${day}` : ''} (page ${page}) after ${MAX_RETRIES} retries`, error as Error, {}, {
      day,
      page,
    })
    return null
  }
}

/**
 * Fetch all schedules from Jikan API (without day filter)
 * Handles pagination automatically
 */
export async function fetchAllJikanSchedules(): Promise<JikanScheduleAnime[]> {
  const allAnime: JikanScheduleAnime[] = []
  const processedMalIds = new Set<number>()
  let page = 1
  let hasMore = true

  while (hasMore) {
    const response = await fetchJikanSchedule(undefined, page)
    
    if (!response?.data) {
      logger.warn(`No data returned for schedules page ${page}`, {}, { page })
      break
    }

    // Deduplicate anime by MAL ID
    for (const anime of response.data) {
      if (!processedMalIds.has(anime.mal_id)) {
        allAnime.push(anime)
        processedMalIds.add(anime.mal_id)
      }
    }
    
    // Check if there are more pages
    hasMore = response.pagination?.has_next_page ?? false
    page++

    // Rate limit between pages
    if (hasMore) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
    }
  }

  return allAnime
}

/**
 * Sync calendar data from Jikan schedules endpoint
 * This fetches all currently airing anime with their actual broadcast times
 */
export async function syncCalendarDataFromJikanSchedules(): Promise<{
  synced: number
  failed: number
  total: number
}> {
  const startTime = Date.now()
  logger.system('Starting calendar sync from Jikan schedules...', {}, {})

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  let synced = 0
  let failed = 0
  let totalAnime = 0
  const processedMalIds = new Set<number>()

  try {
    // Fetch schedules for each day of the week
    for (const day of days) {
      logger.debug(`Fetching schedule for ${day}...`, {}, { day })

      const scheduleData = await fetchJikanSchedule(day)
      if (!scheduleData?.data) {
        logger.warn(`No schedule data returned for ${day}`, {}, { day })
        continue
      }

      const dayAnime = scheduleData.data
      totalAnime += dayAnime.length

      logger.debug(`Found ${dayAnime.length} anime airing on ${day}`, {}, {
        day,
        count: dayAnime.length,
      })

      // Process each anime
      for (const anime of dayAnime) {
        // Skip if we've already processed this anime
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
            // Anime not in our database, skip it
            logger.debug(`Anime ${anime.mal_id} (${anime.title}) not in database, skipping`, {}, {
              malId: anime.mal_id,
              title: anime.title,
            })
            continue
          }

          // Prepare updates
          const updates: any = {}

          // Update broadcast info
          if (anime.broadcast?.string) {
            updates.broadcast = anime.broadcast.string
          } else if (anime.broadcast?.day && anime.broadcast?.time) {
            // Construct broadcast string from day and time
            const dayName = anime.broadcast.day.charAt(0).toUpperCase() + anime.broadcast.day.slice(1)
            const timezone = anime.broadcast.timezone || 'JST'
            updates.broadcast = `${dayName}s at ${anime.broadcast.time} (${timezone})`
          }

          // Update air dates
          if (anime.aired?.from) {
            updates.startDate = new Date(anime.aired.from)
          }
          if (anime.aired?.to) {
            updates.endDate = new Date(anime.aired.to)
          } else if (anime.airing) {
            updates.endDate = null // Clear end date if still airing
          }

          // Update episode count
          if (anime.episodes !== undefined) {
            updates.episodes = anime.episodes
          }

          // Update status
          if (anime.airing) {
            updates.status = 'Currently Airing'
            updates.airing = true
          }

          // Update season/year from aired dates if available
          if (anime.aired?.prop?.from?.year) {
            updates.year = anime.aired.prop.from.year
          }
          if (anime.aired?.prop?.from?.month) {
            const month = anime.aired.prop.from.month
            if (month >= 1 && month <= 3) {
              updates.season = 'winter'
            } else if (month >= 4 && month <= 6) {
              updates.season = 'spring'
            } else if (month >= 7 && month <= 9) {
              updates.season = 'summer'
            } else if (month >= 10 && month <= 12) {
              updates.season = 'fall'
            }
          }

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
            logger.debug(`Synced calendar data for anime ${existingAnime.id} from schedules`, {}, {
              animeId: existingAnime.id,
              malId: anime.mal_id,
              title: anime.title,
              updates: Object.keys(updates),
            })
          }

          // Rate limit between anime updates
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
        } catch (error) {
          failed++
          logger.error(`Error syncing anime ${anime.mal_id} from schedules`, error as Error, {}, {
            malId: anime.mal_id,
            title: anime.title,
          })
        }
      }

      // Rate limit between days
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
    }

    const duration = Date.now() - startTime
    const uniqueAnimeCount = processedMalIds.size

    logger.system('Calendar sync from Jikan schedules completed', {}, {
      totalAnime,
      uniqueAnime: uniqueAnimeCount,
      synced,
      failed,
      duration: `${Math.round(duration / 1000)}s`,
      successRate: uniqueAnimeCount > 0 ? `${((synced / uniqueAnimeCount) * 100).toFixed(1)}%` : '0%',
    })

    return {
      synced,
      failed,
      total: uniqueAnimeCount,
    }
  } catch (error) {
    logger.error('Calendar sync from Jikan schedules failed', error as Error, {}, {})
    throw error
  }
}

