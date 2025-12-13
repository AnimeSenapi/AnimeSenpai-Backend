/**
 * Anime Data Sync Service
 * 
 * Fetches anime data from Jikan API and syncs it to the database.
 * Applies content filters before saving to exclude unwanted content.
 */

import { db } from './db.js'
import { logger } from './logger.js'
import { shouldFilterAnimeFromJikanFull } from './anime-filter-utils.js'
import { fetchAllJikanSeasonNow, fetchAllJikanSeasonUpcoming } from './jikan-seasons-client.js'

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4'
const RATE_LIMIT_DELAY = 1000 // 1000ms = 1 req/sec (still safe, Jikan allows 3 req/sec)
const MAX_RETRIES = 3
const TOP_ANIME_PAGES = 1 // Fetch first page of top anime (25 anime) - reduced to fit within Vercel timeout
const MAX_ANIME_TO_PROCESS = 100 // Hard limit to prevent timeout

/**
 * Full Jikan anime response from /anime/{id} endpoint
 */
export interface JikanAnimeFull {
  mal_id: number
  url: string
  title: string
  title_english?: string
  title_japanese?: string
  title_synonyms?: string[]
  type?: string
  source?: string
  episodes?: number
  status?: string
  airing?: boolean
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
  duration?: string
  rating?: string
  score?: number
  scored_by?: number
  rank?: number
  popularity?: number
  members?: number
  favorites?: number
  synopsis?: string
  background?: string
  season?: string
  year?: number
  broadcast?: {
    day?: string
    time?: string
    timezone?: string
    string?: string
  }
  producers?: Array<{
    mal_id: number
    type: string
    name: string
    url: string
  }>
  licensors?: Array<{
    mal_id: number
    type: string
    name: string
    url: string
  }>
  studios?: Array<{
    mal_id: number
    type: string
    name: string
    url: string
  }>
  genres?: Array<{
    mal_id: number
    type: string
    name: string
    url: string
  }>
  themes?: Array<{
    mal_id: number
    type: string
    name: string
    url: string
  }>
  demographics?: Array<{
    mal_id: number
    type: string
    name: string
    url: string
  }>
  images?: {
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
  trailer?: {
    url?: string
    embed_url?: string
  }
  external?: Array<{
    name: string
    url: string
  }>
}

interface JikanAnimeFullResponse {
  data: JikanAnimeFull
}

interface JikanTopAnimeResponse {
  data: Array<{
    mal_id: number
    title: string
    title_english?: string
    title_japanese?: string
    images?: {
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
    score?: number
    scored_by?: number
    rank?: number
    popularity?: number
    members?: number
    favorites?: number
  }>
  pagination?: {
    last_visible_page: number
    has_next_page: boolean
  }
}

/**
 * Generate a URL-friendly slug from a title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

/**
 * Generate a unique slug, appending year if duplicate exists
 */
async function generateUniqueSlug(baseSlug: string, year?: number): Promise<string> {
  let slug = baseSlug
  let counter = 0
  const maxAttempts = 10

  while (counter < maxAttempts) {
    const existing = await db.anime.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!existing) {
      return slug
    }

    // If duplicate, try appending year first, then counter
    if (year && counter === 0) {
      slug = `${baseSlug}-${year}`
    } else {
      slug = `${baseSlug}-${counter + 1}`
    }
    counter++
  }

  // Fallback: append timestamp
  return `${baseSlug}-${Date.now()}`
}

/**
 * Fetch full anime details from Jikan API by MAL ID
 * Exported for use in calendar-sync.ts
 */
export async function fetchAnimeFromJikan(malId: number, retries = 0): Promise<JikanAnimeFull | null> {
  try {
    const url = `${JIKAN_BASE_URL}/anime/${malId}`
    const response = await fetch(url)

    if (!response.ok) {
      if (response.status === 429 && retries < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY * 3))
        return fetchAnimeFromJikan(malId, retries + 1)
      }
      throw new Error(`Jikan API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as JikanAnimeFullResponse
    return data.data
  } catch (error) {
    if (retries < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY * (retries + 1)))
      return fetchAnimeFromJikan(malId, retries + 1)
    }
    logger.error(`Failed to fetch anime ${malId} from Jikan after ${MAX_RETRIES} retries`, error as Error, {}, {
      malId,
    })
    return null
  }
}

/**
 * Fetch top anime from Jikan API
 */
async function fetchTopAnimeFromJikan(page: number = 1, retries = 0): Promise<JikanTopAnimeResponse | null> {
  try {
    const url = `${JIKAN_BASE_URL}/top/anime?page=${page}`
    const response = await fetch(url)

    if (!response.ok) {
      if (response.status === 429 && retries < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY * 3))
        return fetchTopAnimeFromJikan(page, retries + 1)
      }
      throw new Error(`Jikan API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as JikanTopAnimeResponse
    return data
  } catch (error) {
    if (retries < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY * (retries + 1)))
      return fetchTopAnimeFromJikan(page, retries + 1)
    }
    logger.error(`Failed to fetch top anime page ${page} from Jikan after ${MAX_RETRIES} retries`, error as Error, {}, {
      page,
    })
    return null
  }
}

// Filter function now uses shared utility from anime-filter-utils.ts

/**
 * Convert Jikan anime data to database format and upsert to database
 * Exported for use in calendar-sync.ts
 */
export async function syncAnimeToDatabase(animeData: JikanAnimeFull): Promise<{ created: boolean; updated: boolean }> {
  // Check if anime already exists
  const existingAnime = await db.anime.findUnique({
    where: { malId: animeData.mal_id },
    select: { id: true, slug: true },
  })

  let created = false
  let updated = false

  // Generate slug only for new anime
  let slug: string
  if (existingAnime) {
    // Preserve existing slug
    slug = existingAnime.slug
  } else {
    // Generate new slug
    const titleForSlug = animeData.title_english || animeData.title || animeData.title_japanese || 'untitled'
    const baseSlug = generateSlug(titleForSlug)
    slug = await generateUniqueSlug(baseSlug, animeData.year || undefined)
  }

  // Prepare anime data (exclude slug for updates to preserve it)
  const animeRecord: any = {
    title: animeData.title,
    titleEnglish: animeData.title_english || null,
    titleJapanese: animeData.title_japanese || null,
    titleSynonyms: animeData.title_synonyms || [],
    type: animeData.type || 'Unknown',
    source: animeData.source || null,
    status: animeData.status || 'Unknown',
    airing: animeData.airing || false,
    episodes: animeData.episodes || null,
    duration: animeData.duration || null,
    aired: animeData.aired?.string || null,
    startDate: animeData.aired?.from ? new Date(animeData.aired.from) : null,
    endDate: animeData.aired?.to ? new Date(animeData.aired.to) : null,
    season: animeData.season?.toLowerCase() || null,
    year: animeData.year || animeData.aired?.prop?.from?.year || null,
    broadcast: animeData.broadcast?.string || null,
    rating: animeData.rating || null,
    averageRating: animeData.score || 0,
    scoredBy: animeData.scored_by || 0,
    rank: animeData.rank || null,
    popularity: animeData.popularity || null,
    members: animeData.members || 0,
    favorites: animeData.favorites || 0,
    synopsis: animeData.synopsis || null,
    background: animeData.background || null,
    producers: animeData.producers?.map(p => p.name) || [],
    licensors: animeData.licensors?.map(l => l.name) || [],
    studios: animeData.studios?.map(s => s.name) || [],
    studio: animeData.studios?.[0]?.name || null,
    themes: animeData.themes?.map(t => t.name) || [],
    demographics: animeData.demographics?.map(d => d.name) || [],
    tags: [],
    coverImage: animeData.images?.jpg?.large_image_url || animeData.images?.jpg?.image_url || null,
    bannerImage: animeData.images?.jpg?.large_image_url || null,
    trailer: animeData.trailer?.embed_url || null,
    trailerUrl: animeData.trailer?.url || null,
    externalLinks: animeData.external ? { links: animeData.external } : null,
    malId: animeData.mal_id,
    description: animeData.synopsis || null,
    updatedAt: new Date(),
  }

  // Only set slug and approved for new anime
  if (!existingAnime) {
    animeRecord.slug = slug
    animeRecord.approved = false
  }

  let animeId: string

  if (existingAnime) {
    // Update existing anime
    await db.anime.update({
      where: { id: existingAnime.id },
      data: animeRecord,
    })
    animeId = existingAnime.id
    updated = true
  } else {
    // Create new anime
    const newAnime = await db.anime.create({
      data: animeRecord,
    })
    animeId = newAnime.id
    created = true
  }

  // Update genres for both new and existing anime
  if (animeData.genres && animeData.genres.length > 0) {
    for (const genre of animeData.genres) {
      // Find or create genre
      const genreRecord = await db.genre.upsert({
        where: { name: genre.name },
        update: {},
        create: {
          name: genre.name,
          slug: generateSlug(genre.name),
        },
      })

      // Link anime to genre
      await db.animeGenre.upsert({
        where: {
          animeId_genreId: {
            animeId: animeId,
            genreId: genreRecord.id,
          },
        },
        update: {},
        create: {
          animeId: animeId,
          genreId: genreRecord.id,
        },
      })
    }
  }

  return { created, updated }
}

/**
 * Main sync function - fetches and syncs anime data
 */
export async function syncDailyAnimeData(): Promise<{
  added: number
  updated: number
  filtered: number
  errors: number
}> {
  const startTime = Date.now()
  logger.system('Starting daily anime data sync...', {}, {})

  let added = 0
  let updated = 0
  let filtered = 0
  let errors = 0
  let skipped = 0
  const processedMalIds = new Set<number>()

  try {
    // Step 1: Fetch current season anime
    logger.system('Step 1: Fetching current season anime...', {}, {})
    const seasonNowAnime = await fetchAllJikanSeasonNow()
    logger.system(`Fetched ${seasonNowAnime.length} anime from current season`, {}, {
      count: seasonNowAnime.length,
    })

    // Step 2: Fetch upcoming season anime
    logger.system('Step 2: Fetching upcoming season anime...', {}, {})
    const seasonUpcomingAnime = await fetchAllJikanSeasonUpcoming()
    logger.system(`Fetched ${seasonUpcomingAnime.length} anime from upcoming season`, {}, {
      count: seasonUpcomingAnime.length,
    })

    // Step 3: Fetch top anime
    logger.system('Step 3: Fetching top anime...', {}, {})
    const topAnimeMalIds: number[] = []
    for (let page = 1; page <= TOP_ANIME_PAGES; page++) {
      const response = await fetchTopAnimeFromJikan(page)
      if (response?.data) {
        topAnimeMalIds.push(...response.data.map(a => a.mal_id))
      }
      if (page < TOP_ANIME_PAGES) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
      }
    }
    logger.system(`Fetched ${topAnimeMalIds.length} top anime MAL IDs`, {}, {
      count: topAnimeMalIds.length,
    })

    // Combine all MAL IDs
    const allMalIds = new Set<number>()
    seasonNowAnime.forEach(a => allMalIds.add(a.mal_id))
    seasonUpcomingAnime.forEach(a => allMalIds.add(a.mal_id))
    topAnimeMalIds.forEach(id => allMalIds.add(id))

    logger.system(`Processing ${allMalIds.size} unique anime...`, {}, {
      total: allMalIds.size,
    })

    // Check which anime already exist and were recently updated (skip if updated in last 24 hours)
    const malIdsArray = Array.from(allMalIds)
    const existingAnime = await db.anime.findMany({
      where: {
        malId: { in: malIdsArray },
        updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Updated in last 24 hours
      },
      select: { malId: true },
    })
    const recentlyUpdatedMalIds = new Set(existingAnime.map(a => a.malId))
    const skippedCount = recentlyUpdatedMalIds.size
    
    logger.system(`Skipping ${skippedCount} recently updated anime (updated in last 24h)`, {}, {
      skipped: skippedCount,
      toProcess: allMalIds.size - skippedCount,
    })

    let processedCount = 0
    const totalCount = allMalIds.size
    const maxToProcess = Math.min(totalCount - skipped, MAX_ANIME_TO_PROCESS)
    
    logger.system(`Will process up to ${maxToProcess} anime (${totalCount - skipped} available after skipping recently updated)`, {}, {
      maxToProcess,
      available: totalCount - skipped,
      skipped,
    })

    // Process each anime (with hard limit to prevent timeout)
    let processedInThisRun = 0
    for (const malId of allMalIds) {
      // Hard limit check
      if (processedInThisRun >= maxToProcess) {
        logger.system(`Reached processing limit of ${maxToProcess} anime, stopping to prevent timeout`, {}, {
          processed: processedInThisRun,
          limit: maxToProcess,
        })
        break
      }
      if (processedMalIds.has(malId)) {
        continue
      }
      processedMalIds.add(malId)

      // Skip if recently updated (saves API calls and time)
      if (recentlyUpdatedMalIds.has(malId)) {
        skipped++
        continue
      }

      try {
        // Fetch full anime details
        const animeData = await fetchAnimeFromJikan(malId)
        if (!animeData) {
          errors++
          continue
        }

        // Apply filters
        if (shouldFilterAnimeFromJikanFull(animeData)) {
          filtered++
          logger.debug(`Filtered out anime ${malId}: ${animeData.title}`, {}, {
            malId,
            title: animeData.title,
          })
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
          continue
        }

        // Sync to database
        const result = await syncAnimeToDatabase(animeData)
        if (result.created) {
          added++
        } else if (result.updated) {
          updated++
        }

        // Rate limit between requests
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
        processedInThisRun++
      } catch (error) {
        errors++
        logger.error(`Error processing anime ${malId}`, error as Error, {}, {
          malId,
        })
      }
      
      processedCount++
      // Log progress every 10 anime or at the end
      if (processedCount % 10 === 0 || processedCount === totalCount || processedInThisRun >= maxToProcess) {
        logger.system(`Sync progress: ${processedCount}/${totalCount} anime processed (${processedInThisRun}/${maxToProcess} in this run)`, {}, {
          processed: processedCount,
          total: totalCount,
          processedInRun: processedInThisRun,
          maxInRun: maxToProcess,
          added,
          updated,
          filtered,
          errors,
          skipped,
        })
      }
    }

    const duration = Date.now() - startTime
    logger.system('Daily anime data sync completed', {}, {
      added,
      updated,
      filtered,
      errors,
      skipped,
      total: processedMalIds.size,
      duration: `${Math.round(duration / 1000)}s`,
    })

    return {
      added,
      updated,
      filtered,
      errors,
    }
  } catch (error) {
    logger.error('Daily anime data sync failed', error as Error, {}, {})
    throw error
  }
}

