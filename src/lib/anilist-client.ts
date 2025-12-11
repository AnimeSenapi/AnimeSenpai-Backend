/**
 * AniList API Client
 * 
 * Provides backup/verification data source for calendar sync
 * AniList GraphQL API: https://anilist.co/graphiql
 */

import { logger } from './logger.js'
import { db } from './db.js'

const ANILIST_API_URL = 'https://graphql.anilist.co'
const RATE_LIMIT_DELAY = 700 // 700ms = ~85 req/min (under 90 req/min limit)
const MAX_RETRIES = 3

interface AniListAnimeResponse {
  data: {
    Media: {
      id: number
      idMal: number | null
      title: {
        romaji?: string
        english?: string
        native?: string
      }
      startDate: {
        year: number | null
        month: number | null
        day: number | null
      } | null
      endDate: {
        year: number | null
        month: number | null
        day: number | null
      } | null
      episodes: number | null
      status: string | null
      airingSchedule: {
        nodes: Array<{
          airingAt: number
          episode: number
        }>
      } | null
      nextAiringEpisode: {
        airingAt: number
        episode: number
      } | null
      season: string | null
      seasonYear: number | null
    } | null
  }
}

interface AniListCalendarData {
  broadcast: string | null
  startDate: Date | null
  endDate: Date | null
  episodes: number | null
  status: string | null
  airing: boolean
  season: string | null
  year: number | null
}

/**
 * GraphQL query to fetch anime calendar data by MAL ID
 * Includes airing schedule for better episode timing
 */
const ANIME_QUERY = `
  query ($idMal: Int) {
    Media(idMal: $idMal, type: ANIME) {
      id
      idMal
      title {
        romaji
        english
        native
      }
      startDate {
        year
        month
        day
      }
      endDate {
        year
        month
        day
      }
      episodes
      status
      airingSchedule(notYetAired: true, perPage: 5) {
        nodes {
          airingAt
          episode
          timeUntilAiring
        }
      }
      nextAiringEpisode {
        airingAt
        episode
        timeUntilAiring
      }
      season
      seasonYear
    }
  }
`

/**
 * Fetch anime data from AniList API by MAL ID
 */
async function fetchAnimeFromAniList(malId: number, retries = 0): Promise<AniListAnimeResponse | null> {
  try {
    const response = await fetch(ANILIST_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: ANIME_QUERY,
        variables: { idMal: malId },
      }),
    })

    if (!response.ok) {
      if (response.status === 429 && retries < MAX_RETRIES) {
        // Rate limited - wait longer and retry
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY * 3))
        return fetchAnimeFromAniList(malId, retries + 1)
      }
      throw new Error(`AniList API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as AniListAnimeResponse
    
    // Check for GraphQL errors
    if ('errors' in data && data.errors) {
      logger.warn(`AniList GraphQL errors for MAL ${malId}`, {}, {
        malId,
        errors: data.errors,
      })
      return null
    }

    return data
  } catch (error) {
    if (retries < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY * (retries + 1)))
      return fetchAnimeFromAniList(malId, retries + 1)
    }
    logger.error(`Failed to fetch anime ${malId} from AniList after ${MAX_RETRIES} retries`, error as Error, {}, {
      malId,
    })
    return null
  }
}

/**
 * Convert AniList date object to Date
 */
function parseAniListDate(dateObj: { year: number | null; month: number | null; day: number | null } | null): Date | null {
  if (!dateObj || dateObj.year === null || dateObj.month === null || dateObj.day === null) {
    return null
  }
  return new Date(dateObj.year, dateObj.month - 1, dateObj.day)
}

/**
 * Generate broadcast string from next airing episode
 * Uses actual airing times from AniList for accuracy
 */
function generateBroadcastString(
  nextEpisode: { airingAt: number; episode: number } | null,
  scheduleNodes?: Array<{ airingAt: number; episode: number }>
): string | null {
  // Use next episode if available, otherwise use first schedule node
  const episode = nextEpisode || (scheduleNodes && scheduleNodes.length > 0 ? scheduleNodes[0] : null)
  if (!episode) return null
  
  const airDate = new Date(episode.airingAt * 1000) // AniList uses Unix timestamp in seconds
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayName = dayNames[airDate.getDay()]
  
  // AniList times are typically in JST (Japan Standard Time)
  // Convert to JST if needed (AniList returns UTC timestamps)
  const jstDate = new Date(airDate.getTime() + (9 * 60 * 60 * 1000)) // UTC+9 for JST
  const jstHours = jstDate.getUTCHours().toString().padStart(2, '0')
  const jstMinutes = jstDate.getUTCMinutes().toString().padStart(2, '0')
  
  return `${dayName}s at ${jstHours}:${jstMinutes} (JST)`
}

/**
 * Fetch calendar data from AniList for a given MAL ID
 * Returns null if data is unavailable or incomplete
 */
export async function fetchAniListCalendarData(malId: number): Promise<AniListCalendarData | null> {
  try {
    const response = await fetchAnimeFromAniList(malId)
    if (!response?.data?.Media) {
      return null
    }

    const media = response.data.Media
    
    // Convert AniList status to our format
    const statusMap: Record<string, string> = {
      'RELEASING': 'Currently Airing',
      'FINISHED': 'Finished Airing',
      'NOT_YET_RELEASED': 'Not yet aired',
      'CANCELLED': 'Cancelled',
      'HIATUS': 'On Hiatus',
    }
    
    const status = media.status ? statusMap[media.status] || media.status : null
    const airing = media.status === 'RELEASING' || media.nextAiringEpisode !== null
    
    // Generate broadcast string from next airing episode or schedule
    const broadcast = generateBroadcastString(
      media.nextAiringEpisode,
      media.airingSchedule?.nodes || undefined
    )
    
    // Parse dates
    const startDate = parseAniListDate(media.startDate)
    const endDate = parseAniListDate(media.endDate)
    
    // Map season
    const seasonMap: Record<string, string> = {
      'WINTER': 'winter',
      'SPRING': 'spring',
      'SUMMER': 'summer',
      'FALL': 'fall',
    }
    const season = media.season ? seasonMap[media.season] || media.season.toLowerCase() : null

    return {
      broadcast,
      startDate,
      endDate,
      episodes: media.episodes,
      status,
      airing,
      season,
      year: media.seasonYear,
    }
  } catch (error) {
    logger.error(`Error fetching AniList calendar data for MAL ${malId}`, error as Error, {}, {
      malId,
    })
    return null
  }
}

/**
 * Sync calendar data from AniList as fallback when Jikan data is missing/incomplete
 */
export async function syncAnimeCalendarDataFromAniList(
  animeId: string,
  malId: number
): Promise<boolean> {
  try {
    const anilistData = await fetchAniListCalendarData(malId)
    if (!anilistData) {
      return false
    }

    const updates: any = {}

    // Only update fields that are missing or null in current data
    // This is a fallback, so we don't overwrite existing good data
    if (anilistData.broadcast) {
      updates.broadcast = anilistData.broadcast
    }
    if (anilistData.startDate) {
      updates.startDate = anilistData.startDate
    }
    if (anilistData.endDate !== null) {
      updates.endDate = anilistData.endDate
    }
    if (anilistData.episodes !== null) {
      updates.episodes = anilistData.episodes
    }
    if (anilistData.status) {
      updates.status = anilistData.status
      updates.airing = anilistData.airing
    }
    if (anilistData.season) {
      updates.season = anilistData.season
    }
    if (anilistData.year) {
      updates.year = anilistData.year
    }

    if (Object.keys(updates).length > 0) {
      // Get current anime data to check what's missing
      const currentAnime = await db.anime.findUnique({
        where: { id: animeId },
        select: {
          broadcast: true,
          startDate: true,
          endDate: true,
          episodes: true,
          status: true,
          airing: true,
          season: true,
          year: true,
        },
      })

      // Only update fields that are actually missing
      const finalUpdates: any = {}
      if (!currentAnime?.broadcast && updates.broadcast) {
        finalUpdates.broadcast = updates.broadcast
      }
      if (!currentAnime?.startDate && updates.startDate) {
        finalUpdates.startDate = updates.startDate
      }
      if (currentAnime?.endDate === null && updates.endDate !== undefined) {
        finalUpdates.endDate = updates.endDate
      }
      if (!currentAnime?.episodes && updates.episodes) {
        finalUpdates.episodes = updates.episodes
      }
      if (!currentAnime?.status && updates.status) {
        finalUpdates.status = updates.status
        finalUpdates.airing = updates.airing
      }
      if (!currentAnime?.season && updates.season) {
        finalUpdates.season = updates.season
      }
      if (!currentAnime?.year && updates.year) {
        finalUpdates.year = updates.year
      }

      if (Object.keys(finalUpdates).length > 0) {
        await db.anime.update({
          where: { id: animeId },
          data: {
            ...finalUpdates,
            updatedAt: new Date(),
          },
        })

        logger.debug(`Synced calendar data from AniList for anime ${animeId}`, {}, {
          animeId,
          malId,
          updates: Object.keys(finalUpdates),
        })

        return true
      }
    }

    return false
  } catch (error) {
    logger.error(`Error syncing anime ${animeId} from AniList`, error as Error, {}, {
      animeId,
      malId,
    })
    return false
  }
}

