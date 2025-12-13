/**
 * Jikan Seasons API Client
 * 
 * Fetches seasonal anime data from Jikan API
 * Uses /seasons/now and /seasons/upcoming endpoints
 */

import { logger } from './logger.js'

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4'
const RATE_LIMIT_DELAY = 1000 // 1000ms = 1 req/sec (still safe, Jikan allows 3 req/sec)
const MAX_RETRIES = 3
const MAX_SEASON_PAGES = 2 // Limit pages to prevent timeout (2 pages = ~50 anime per season)

interface JikanSeasonAnime {
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
  season?: string
  year?: number
  status?: string
}

interface JikanSeasonResponse {
  data: JikanSeasonAnime[]
  pagination?: {
    last_visible_page: number
    has_next_page: boolean
  }
}

/**
 * Fetch current season anime from Jikan API
 * @param page - Page number (default: 1)
 * @param retries - Number of retries attempted
 */
export async function fetchJikanSeasonNow(
  page: number = 1,
  retries = 0
): Promise<JikanSeasonResponse | null> {
  try {
    const url = `${JIKAN_BASE_URL}/seasons/now?page=${page}`
    const response = await fetch(url)

    if (!response.ok) {
      if (response.status === 429 && retries < MAX_RETRIES) {
        // Rate limited - wait longer and retry
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY * 3))
        return fetchJikanSeasonNow(page, retries + 1)
      }
      throw new Error(`Jikan API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as JikanSeasonResponse
    return data
  } catch (error) {
    if (retries < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY * (retries + 1)))
      return fetchJikanSeasonNow(page, retries + 1)
    }
    logger.error(`Failed to fetch Jikan season now (page ${page}) after ${MAX_RETRIES} retries`, error as Error, {}, {
      page,
    })
    return null
  }
}

/**
 * Fetch upcoming season anime from Jikan API
 * @param page - Page number (default: 1)
 * @param retries - Number of retries attempted
 */
export async function fetchJikanSeasonUpcoming(
  page: number = 1,
  retries = 0
): Promise<JikanSeasonResponse | null> {
  try {
    const url = `${JIKAN_BASE_URL}/seasons/upcoming?page=${page}`
    const response = await fetch(url)

    if (!response.ok) {
      if (response.status === 429 && retries < MAX_RETRIES) {
        // Rate limited - wait longer and retry
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY * 3))
        return fetchJikanSeasonUpcoming(page, retries + 1)
      }
      throw new Error(`Jikan API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as JikanSeasonResponse
    return data
  } catch (error) {
    if (retries < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY * (retries + 1)))
      return fetchJikanSeasonUpcoming(page, retries + 1)
    }
    logger.error(`Failed to fetch Jikan season upcoming (page ${page}) after ${MAX_RETRIES} retries`, error as Error, {}, {
      page,
    })
    return null
  }
}

/**
 * Fetch all pages of current season anime (limited to MAX_SEASON_PAGES)
 */
export async function fetchAllJikanSeasonNow(): Promise<JikanSeasonAnime[]> {
  const allAnime: JikanSeasonAnime[] = []
  let page = 1
  let hasMore = true

  while (hasMore && page <= MAX_SEASON_PAGES) {
    const response = await fetchJikanSeasonNow(page)
    
    if (!response?.data) {
      logger.warn(`No data returned for season now page ${page}`, {}, { page })
      break
    }

    allAnime.push(...response.data)
    
    // Check if there are more pages
    hasMore = response.pagination?.has_next_page ?? false
    page++

    // Rate limit between pages
    if (hasMore && page <= MAX_SEASON_PAGES) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
    }
  }

  logger.system(`Fetched ${allAnime.length} anime from season now (${page - 1} pages)`, {}, {
    count: allAnime.length,
    pages: page - 1,
    limit: MAX_SEASON_PAGES,
  })

  return allAnime
}

/**
 * Fetch all pages of upcoming season anime (limited to MAX_SEASON_PAGES)
 */
export async function fetchAllJikanSeasonUpcoming(): Promise<JikanSeasonAnime[]> {
  const allAnime: JikanSeasonAnime[] = []
  let page = 1
  let hasMore = true

  while (hasMore && page <= MAX_SEASON_PAGES) {
    const response = await fetchJikanSeasonUpcoming(page)
    
    if (!response?.data) {
      logger.warn(`No data returned for season upcoming page ${page}`, {}, { page })
      break
    }

    allAnime.push(...response.data)
    
    // Check if there are more pages
    hasMore = response.pagination?.has_next_page ?? false
    page++

    // Rate limit between pages
    if (hasMore && page <= MAX_SEASON_PAGES) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
    }
  }

  logger.system(`Fetched ${allAnime.length} anime from season upcoming (${page - 1} pages)`, {}, {
    count: allAnime.length,
    pages: page - 1,
    limit: MAX_SEASON_PAGES,
  })

  return allAnime
}

