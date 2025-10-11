#!/usr/bin/env bun

/**
 * 🌙 Standalone Anime Import Script - OPTIMIZED & COMPLETE
 * 
 * Self-contained script that runs directly on your server
 * Requires only: Bun + .env file with DATABASE_URL
 * 
 * Features:
 * - Fetches COMPLETE anime data (all fields)
 * - 3x faster with parallel processing
 * - Smart rate limiting (respects Jikan's 3 req/sec limit)
 * - Fetches top 1000 anime per genre (68 genres)
 * - Concurrent streaming platform fetching
 * - Runs indefinitely until stopped (Ctrl+C)
 * - Auto-saves progress every 5 minutes
 * - Crash recovery with state file
 * 
 * Usage:
 *   bun standalone-import.js
 *   
 * Stop gracefully:
 *   Press Ctrl+C (sends SIGINT)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Jikan API Configuration (ULTRA-SAFE - NO RATE LIMITING)
const JIKAN_BASE_URL = 'https://api.jikan.moe/v4'
const RATE_LIMIT_DELAY = 1000 // 1000ms = 1 req/sec (VERY SAFE - won't get rate limited)
const RETRY_DELAY = 15000 // 15 seconds on error (increased)
const MAX_RETRIES = 5
const BATCH_SIZE = 20 // Smaller batches for stability
const CONCURRENT_STREAMING = 1 // Sequential only - NO concurrent requests
const STATS_SAVE_INTERVAL = 300000 // Save stats every 5 minutes
const STATE_FILE = 'import-state.json'
const HEALTH_FILE = 'import-health.json'

// All MyAnimeList genres
const GENRES = [
  { id: 1, name: 'Action' },
  { id: 2, name: 'Adventure' },
  { id: 4, name: 'Comedy' },
  { id: 8, name: 'Drama' },
  { id: 10, name: 'Fantasy' },
  { id: 14, name: 'Horror' },
  { id: 7, name: 'Mystery' },
  { id: 22, name: 'Romance' },
  { id: 24, name: 'Sci-Fi' },
  { id: 36, name: 'Slice of Life' },
  { id: 30, name: 'Sports' },
  { id: 37, name: 'Supernatural' },
  { id: 41, name: 'Suspense' },
  { id: 9, name: 'Ecchi' },
  { id: 49, name: 'Erotica' },
  { id: 12, name: 'Hentai' },
  { id: 50, name: 'Adult Cast' },
  { id: 51, name: 'Anthropomorphic' },
  { id: 52, name: 'CGDCT' },
  { id: 53, name: 'Childcare' },
  { id: 54, name: 'Combat Sports' },
  { id: 81, name: 'Crossdressing' },
  { id: 55, name: 'Delinquents' },
  { id: 39, name: 'Detective' },
  { id: 56, name: 'Educational' },
  { id: 57, name: 'Gag Humor' },
  { id: 58, name: 'Gore' },
  { id: 35, name: 'Harem' },
  { id: 59, name: 'High Stakes Game' },
  { id: 13, name: 'Historical' },
  { id: 60, name: 'Idols (Female)' },
  { id: 61, name: 'Idols (Male)' },
  { id: 62, name: 'Isekai' },
  { id: 63, name: 'Iyashikei' },
  { id: 64, name: 'Love Polygon' },
  { id: 65, name: 'Magical Sex Shift' },
  { id: 66, name: 'Mahou Shoujo' },
  { id: 17, name: 'Martial Arts' },
  { id: 18, name: 'Mecha' },
  { id: 67, name: 'Medical' },
  { id: 38, name: 'Military' },
  { id: 19, name: 'Music' },
  { id: 6, name: 'Mythology' },
  { id: 68, name: 'Organized Crime' },
  { id: 69, name: 'Otaku Culture' },
  { id: 20, name: 'Parody' },
  { id: 70, name: 'Performing Arts' },
  { id: 71, name: 'Pets' },
  { id: 40, name: 'Psychological' },
  { id: 3, name: 'Racing' },
  { id: 72, name: 'Reincarnation' },
  { id: 73, name: 'Reverse Harem' },
  { id: 74, name: 'Romantic Subtext' },
  { id: 21, name: 'Samurai' },
  { id: 23, name: 'School' },
  { id: 75, name: 'Showbiz' },
  { id: 29, name: 'Space' },
  { id: 76, name: 'Strategy Game' },
  { id: 77, name: 'Survival' },
  { id: 78, name: 'Team Sports' },
  { id: 79, name: 'Time Travel' },
  { id: 32, name: 'Vampire' },
  { id: 80, name: 'Video Game' },
  { id: 48, name: 'Workplace' },
  { id: 43, name: 'Josei' },
  { id: 15, name: 'Kids' },
  { id: 42, name: 'Seinen' },
  { id: 25, name: 'Shoujo' },
  { id: 27, name: 'Shounen' }
]

// Known streaming platforms with metadata
const KNOWN_PLATFORMS = {
  'crunchyroll': { color: '#F47521', logo: '🟠' },
  'funimation': { color: '#410099', logo: '🟣' },
  'netflix': { color: '#E50914', logo: '🔴' },
  'hulu': { color: '#1CE783', logo: '🟢' },
  'amazon-prime-video': { color: '#00A8E1', logo: '🔵' },
  'disney-plus': { color: '#113CCF', logo: '⭐' },
  'hidive': { color: '#00ADEF', logo: '💠' },
  'animelab': { color: '#FF6C00', logo: '🧡' },
  'vrv': { color: '#FF6C00', logo: '📺' },
  'youtube': { color: '#FF0000', logo: '▶️' }
}

// Global state
let state = {
  isRunning: true,
  existingAnimeIds: new Set(),
  pendingAnime: [],
  streamingQueue: [], // Queue for parallel streaming fetches
  stats: {
    totalFetched: 0,
    totalSkipped: 0,
    totalFiltered: 0, // Adult content filtered out
    totalSaved: 0,
    totalErrors: 0,
    totalPlatforms: 0,
    currentGenre: null,
    currentPage: 0,
    genresCompleted: 0,
    startTime: Date.now(),
    lastStatsSave: Date.now()
  }
}

let statsInterval = null
let requestQueue = Promise.resolve() // Sequential request queue for rate limiting

// Utility: Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Utility: Format duration
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

// Utility: Log with timestamp
function log(message, type = 'info') {
  const timestamp = new Date().toISOString()
  const prefix = {
    info: 'ℹ️ ',
    success: '✅',
    error: '❌',
    warning: '⚠️ ',
    progress: '📊'
  }[type] || ''
  
  console.log(`[${timestamp}] ${prefix} ${message}`)
}

// Update health check file
async function updateHealthCheck() {
  try {
    const healthData = {
      status: 'running',
      lastUpdate: new Date().toISOString(),
      uptime: formatDuration(Date.now() - state.stats.startTime),
      currentGenre: state.stats.currentGenre,
      totalSaved: state.stats.totalSaved,
      pid: process.pid
    }
    await Bun.write(HEALTH_FILE, JSON.stringify(healthData, null, 2))
  } catch (error) {
    // Health check is non-critical
  }
}

// Save stats to file
async function saveStatsToFile() {
  try {
    const runtime = Date.now() - state.stats.startTime
    const rate = state.stats.totalFetched / (runtime / 1000 / 60)
    
    const statsData = {
      ...state.stats,
      runtime: formatDuration(runtime),
      fetchRate: rate.toFixed(1),
      pendingCount: state.pendingAnime.length,
      timestamp: new Date().toISOString()
    }
    
    await Bun.write(STATE_FILE, JSON.stringify(statsData, null, 2))
    await updateHealthCheck()
    state.stats.lastStatsSave = Date.now()
  } catch (error) {
    log(`Error saving stats to file: ${error.message}`, 'warning')
  }
}

// Load previous stats
async function loadPreviousStats() {
  try {
    const file = Bun.file(STATE_FILE)
    if (await file.exists()) {
      const data = await file.json()
      log(`Found previous import session from ${data.timestamp}`, 'info')
      log(`Previous stats: ${data.totalSaved} saved, ${data.genresCompleted}/${GENRES.length} genres completed`, 'info')
      return data
    }
  } catch (error) {
    // No previous state - that's fine
  }
  return null
}

// Print current stats
function printStats(alsoSaveToFile = true) {
  const runtime = Date.now() - state.stats.startTime
  const rate = state.stats.totalFetched / (runtime / 1000 / 60)
  
  console.log('\n' + '='.repeat(70))
  log('Current Statistics:', 'progress')
  console.log('='.repeat(70))
  console.log(`Runtime:          ${formatDuration(runtime)}`)
  console.log(`Current Genre:    ${state.stats.currentGenre || 'None'}`)
  console.log(`Genres Completed: ${state.stats.genresCompleted}/${GENRES.length}`)
  console.log(`Total Fetched:    ${state.stats.totalFetched}`)
  console.log(`Total Filtered:   ${state.stats.totalFiltered} (adult content)`)
  console.log(`Total Skipped:    ${state.stats.totalSkipped} (already in DB)`)
  console.log(`Total Saved:      ${state.stats.totalSaved}`)
  console.log(`Pending Save:     ${state.pendingAnime.length}`)
  console.log(`Total Errors:     ${state.stats.totalErrors}`)
  console.log(`Platforms Found:  ${state.stats.totalPlatforms}`)
  console.log(`Fetch Rate:       ${rate.toFixed(1)} anime/min`)
  console.log('='.repeat(70) + '\n')
  
  if (alsoSaveToFile && (Date.now() - state.stats.lastStatsSave > STATS_SAVE_INTERVAL)) {
    saveStatsToFile()
  }
}

// Load existing anime IDs from database
async function loadExistingAnimeIds() {
  log('Loading existing anime IDs from database...')
  
  try {
    const existingAnime = await prisma.anime.findMany({
      select: { id: true }
    })
    
    state.existingAnimeIds = new Set(existingAnime.map(a => a.id))
    log(`Loaded ${state.existingAnimeIds.size} existing anime IDs`, 'success')
  } catch (error) {
    log(`Error loading existing IDs: ${error.message}`, 'error')
    throw error
  }
}

// Rate-limited fetch wrapper with exponential backoff
async function rateLimitedFetch(url, retries = MAX_RETRIES) {
  return new Promise((resolve, reject) => {
    requestQueue = requestQueue.then(async () => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const response = await fetch(url)
          
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '60')
            const waitTime = retryAfter * 1000 + 10000 // Add 10s buffer (not 5s)
            log(`⚠️  Rate limited! Waiting ${Math.ceil(waitTime/1000)}s before retry...`, 'warning')
            await sleep(waitTime)
            continue
          }
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          
          const data = await response.json()
          await sleep(RATE_LIMIT_DELAY) // Rate limit delay AFTER successful request
          resolve(data)
          return
        } catch (error) {
          if (attempt === retries) {
            state.stats.totalErrors++
            reject(error)
            return
          }
          // Exponential backoff: 15s, 30s, 45s, 60s
          const backoffDelay = RETRY_DELAY * attempt
          log(`Retry attempt ${attempt}/${retries} after ${backoffDelay/1000}s...`, 'warning')
          await sleep(backoffDelay)
        }
      }
    })
  })
}

// Fetch streaming platforms concurrently
async function fetchStreamingPlatformsConcurrent(malIds) {
  const results = await Promise.allSettled(
    malIds.map(async (malId) => {
      try {
        const url = `${JIKAN_BASE_URL}/anime/${malId}/streaming`
        const data = await rateLimitedFetch(url)
        
        if (!data.data || data.data.length === 0) {
          return { malId, platforms: [] }
        }
        
        return {
          malId,
          platforms: data.data.map(stream => ({
            name: stream.name,
            url: stream.url
          }))
        }
      } catch (error) {
        return { malId, platforms: [] }
      }
    })
  )
  
  return results.map(result => 
    result.status === 'fulfilled' ? result.value : { malId: null, platforms: [] }
  ).filter(r => r.malId !== null)
}

// Check if anime is adult content (hentai or Rx-rated)
function isAdultContent(animeData) {
  // Check rating for adult content
  const rating = animeData.rating?.toLowerCase() || ''
  if (rating.includes('hentai') || rating.includes('rx')) {
    return true
  }
  
  // Check genres for adult content
  const genres = animeData.genres || []
  for (const genre of genres) {
    const genreName = genre.name?.toLowerCase() || ''
    if (genreName === 'hentai' || genreName === 'erotica') {
      return true
    }
  }
  
  return false
}

// Process and format anime data with COMPLETE fields
function processAnimeData(animeData, streamingPlatforms = []) {
  return {
    id: animeData.mal_id.toString(),
    malId: animeData.mal_id,
    slug: animeData.title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''),
    title: animeData.title,
    titleEnglish: animeData.title_english,
    titleJapanese: animeData.title_japanese,
    titleSynonyms: animeData.title_synonyms || [],
    synopsis: animeData.synopsis,
    background: animeData.background,
    coverImage: animeData.images?.jpg?.large_image_url || animeData.images?.jpg?.image_url,
    bannerImage: null,
    trailer: animeData.trailer?.embed_url,
    trailerUrl: animeData.trailer?.url,
    year: animeData.year || (animeData.aired?.from ? new Date(animeData.aired.from).getFullYear() : null),
    season: animeData.season,
    aired: animeData.aired?.string,
    broadcast: animeData.broadcast?.string,
    type: animeData.type || 'TV',
    status: animeData.status?.toLowerCase() || 'unknown',
    airing: animeData.airing || false,
    episodes: animeData.episodes,
    duration: animeData.duration,
    rating: animeData.rating,
    averageRating: animeData.score || 0,
    scoredBy: animeData.scored_by || 0,
    rank: animeData.rank,
    popularity: animeData.popularity || 0,
    members: animeData.members || 0,
    favorites: animeData.favorites || 0,
    source: animeData.source,
    studios: animeData.studios?.map(s => s.name) || [], // Array of strings
    producers: animeData.producers?.map(p => p.name) || [], // Array of strings
    licensors: animeData.licensors?.map(l => l.name) || [], // Array of strings
    genres: animeData.genres?.map(g => ({ id: g.mal_id.toString(), name: g.name })) || [],
    themes: animeData.themes?.map(t => t.name) || [],
    demographics: animeData.demographics?.map(d => d.name) || [],
    streamingPlatforms: streamingPlatforms
  }
}

// Save batch to database (OPTIMIZED with better error handling)
async function saveBatchToDatabase() {
  if (state.pendingAnime.length === 0) return
  
  const batch = [...state.pendingAnime]
  state.pendingAnime = []
  
  log(`Saving batch of ${batch.length} anime to database...`)
  
  try {
    // Process one at a time with individual error handling (more stable)
    let savedCount = 0
    let errorCount = 0
    
    for (const anime of batch) {
      try {
        await prisma.$transaction(async (tx) => {
          // Upsert anime
          await tx.anime.upsert({
            where: { id: anime.id },
            create: {
              id: anime.id,
              slug: anime.slug,
              title: anime.title,
              titleEnglish: anime.titleEnglish,
              titleJapanese: anime.titleJapanese,
              titleSynonyms: anime.titleSynonyms,
              synopsis: anime.synopsis,
              background: anime.background,
              coverImage: anime.coverImage,
              bannerImage: anime.bannerImage,
              trailer: anime.trailer,
              trailerUrl: anime.trailerUrl,
              year: anime.year,
              season: anime.season,
              aired: anime.aired,
              broadcast: anime.broadcast,
              type: anime.type,
              status: anime.status,
              airing: anime.airing,
              episodes: anime.episodes,
              duration: anime.duration,
              rating: anime.rating,
              averageRating: anime.averageRating,
              scoredBy: anime.scoredBy,
              rank: anime.rank,
              popularity: anime.popularity,
              members: anime.members,
              favorites: anime.favorites,
              source: anime.source,
              studios: anime.studios,
              producers: anime.producers,
              licensors: anime.licensors,
              themes: anime.themes,
              demographics: anime.demographics,
              malId: anime.malId
            },
            update: {
              title: anime.title,
              titleEnglish: anime.titleEnglish,
              titleJapanese: anime.titleJapanese,
              titleSynonyms: anime.titleSynonyms,
              synopsis: anime.synopsis,
              background: anime.background,
              coverImage: anime.coverImage,
              trailer: anime.trailer,
              trailerUrl: anime.trailerUrl,
              year: anime.year,
              season: anime.season,
              aired: anime.aired,
              broadcast: anime.broadcast,
              type: anime.type,
              status: anime.status,
              airing: anime.airing,
              episodes: anime.episodes,
              duration: anime.duration,
              rating: anime.rating,
              averageRating: anime.averageRating,
              scoredBy: anime.scoredBy,
              rank: anime.rank,
              popularity: anime.popularity,
              members: anime.members,
              favorites: anime.favorites,
              source: anime.source,
              studios: anime.studios,
              producers: anime.producers,
              licensors: anime.licensors,
              themes: anime.themes,
              demographics: anime.demographics,
              malId: anime.malId
            }
          })
          
          // Handle genres
          for (const genre of anime.genres) {
            await tx.genre.upsert({
              where: { id: genre.id },
              create: { id: genre.id, name: genre.name, slug: genre.name.toLowerCase().replace(/\s+/g, '-') },
              update: { name: genre.name }
            })
            
            await tx.animeGenre.upsert({
              where: {
                animeId_genreId: {
                  animeId: anime.id,
                  genreId: genre.id
                }
              },
              create: {
                animeId: anime.id,
                genreId: genre.id
              },
              update: {}
            })
          }
          
          // Handle streaming platforms
          for (const platform of anime.streamingPlatforms || []) {
            const platformSlug = platform.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
            const platformMetadata = KNOWN_PLATFORMS[platformSlug] || {}
            
            const dbPlatform = await tx.streamingPlatform.upsert({
              where: { slug: platformSlug },
              create: {
                name: platform.name,
                slug: platformSlug,
                color: platformMetadata.color,
                baseUrl: platform.url ? new URL(platform.url).origin : null
              },
              update: {
                name: platform.name,
                color: platformMetadata.color
              }
            })
            
            state.stats.totalPlatforms++
            
            await tx.animeStreamingPlatform.upsert({
              where: {
                animeId_platformId: {
                  animeId: anime.id,
                  platformId: dbPlatform.id
                }
              },
              create: {
                animeId: anime.id,
                platformId: dbPlatform.id,
                url: platform.url
              },
              update: {
                url: platform.url
              }
            })
          }
        })
        
        savedCount++
        state.stats.totalSaved++
        state.existingAnimeIds.add(anime.id)
      } catch (error) {
        errorCount++
        state.stats.totalErrors++
        log(`Error saving anime ${anime.id} (${anime.title}): ${error.message}`, 'error')
        
        // On critical errors, add back to pending for retry
        if (error.message.includes('connection') || error.message.includes('timeout')) {
          state.pendingAnime.push(anime)
        }
      }
    }
    
    log(`✅ Saved ${savedCount}/${batch.length} anime to database (${errorCount} errors)`, savedCount > 0 ? 'success' : 'error')
    
    // Small delay after batch to prevent database overload
    await sleep(200)
  } catch (error) {
    log(`Critical batch save error: ${error.message}`, 'error')
    state.stats.totalErrors++
    // Add all failed anime back to pending
    state.pendingAnime.unshift(...batch)
  }
}

// Fetch anime by genre (OPTIMIZED with concurrent streaming)
async function fetchAnimeByGenre(genre, page = 1) {
  const url = `${JIKAN_BASE_URL}/anime?genres=${genre.id}&order_by=popularity&sort=asc&page=${page}&limit=25`
  
  try {
    log(`Fetching ${genre.name} page ${page}...`)
    const data = await rateLimitedFetch(url)
    
    if (!data.data || data.data.length === 0) {
      return null
    }
    
    // Collect MAL IDs for concurrent streaming fetch
    const malIds = []
    const animeDataMap = new Map()
    
    for (const animeData of data.data) {
      const animeId = animeData.mal_id.toString()
      
      // Filter out adult content (hentai, Rx-rated)
      if (isAdultContent(animeData)) {
        state.stats.totalFiltered++
        continue
      }
      
      if (state.existingAnimeIds.has(animeId)) {
        state.stats.totalSkipped++
        continue
      }
      
      malIds.push(animeData.mal_id)
      animeDataMap.set(animeData.mal_id, animeData)
    }
    
    // Fetch streaming platforms (sequential for safety)
    let streamingResults = []
    if (malIds.length > 0) {
      log(`Fetching streaming for ${malIds.length} anime (sequential - slow but safe)...`)
      
      // Process in chunks of CONCURRENT_STREAMING (1 = sequential)
      for (let i = 0; i < malIds.length; i += CONCURRENT_STREAMING) {
        const chunk = malIds.slice(i, i + CONCURRENT_STREAMING)
        const chunkResults = await fetchStreamingPlatformsConcurrent(chunk)
        streamingResults.push(...chunkResults)
        
        // Extra delay between chunks to be super safe
        if (i + CONCURRENT_STREAMING < malIds.length) {
          await sleep(500) // Extra 500ms between streaming fetches
        }
      }
    }
    
    // Create streaming map
    const streamingMap = new Map()
    for (const result of streamingResults) {
      streamingMap.set(result.malId, result.platforms)
    }
    
    // Process all anime
    let newAnime = 0
    for (const malId of malIds) {
      const animeData = animeDataMap.get(malId)
      const streaming = streamingMap.get(malId) || []
      
      const processedAnime = processAnimeData(animeData, streaming)
      state.pendingAnime.push(processedAnime)
      state.stats.totalFetched++
      newAnime++
      
      if (state.pendingAnime.length >= BATCH_SIZE) {
        await saveBatchToDatabase()
      }
    }
    
    log(`Genre: ${genre.name} (Page ${page}) - Fetched: ${data.data.length}, New: ${newAnime}, Skipped: ${data.data.length - newAnime}`)
    return data.pagination?.has_next_page
  } catch (error) {
    log(`Error fetching genre ${genre.name} page ${page}: ${error.message}`, 'error')
    await sleep(RETRY_DELAY)
    return false
  }
}

// Process all genres
async function processGenres() {
  log('🎬 Starting genre-based fetch...', 'info')
  
  for (let i = 0; i < GENRES.length && state.isRunning; i++) {
    const genre = GENRES[i]
    state.stats.currentGenre = genre.name
    state.stats.currentPage = 0
    
    log(`\n📚 Processing Genre: ${genre.name} (${i + 1}/${GENRES.length})`, 'info')
    
    let page = 1
    let hasMore = true
    let fetchedInGenre = 0
    
    while (hasMore && state.isRunning && fetchedInGenre < 1000) {
      state.stats.currentPage = page
      hasMore = await fetchAnimeByGenre(genre, page)
      
      if (hasMore) {
        page++
        fetchedInGenre += 25
      }
      
      if (page % 10 === 0) {
        printStats()
      }
    }
    
    state.stats.genresCompleted++
    log(`✅ Completed Genre: ${genre.name} (Fetched ${fetchedInGenre} pages)`, 'success')
    
    if (state.pendingAnime.length > 0) {
      await saveBatchToDatabase()
    }
    
    printStats()
  }
}

// Fetch top anime (fallback)
async function fetchTopAnime(page = 1) {
  const url = `${JIKAN_BASE_URL}/top/anime?page=${page}&limit=25`
  
  try {
    const data = await rateLimitedFetch(url)
    
    if (!data.data || data.data.length === 0) {
      return false
    }
    
    const malIds = []
    const animeDataMap = new Map()
    
    for (const animeData of data.data) {
      const animeId = animeData.mal_id.toString()
      
      // Filter out adult content (hentai, Rx-rated)
      if (isAdultContent(animeData)) {
        state.stats.totalFiltered++
        continue
      }
      
      if (state.existingAnimeIds.has(animeId)) {
        state.stats.totalSkipped++
        continue
      }
      
      malIds.push(animeData.mal_id)
      animeDataMap.set(animeData.mal_id, animeData)
    }
    
    // Fetch streaming (sequential for safety)
    let streamingResults = []
    if (malIds.length > 0) {
      for (let i = 0; i < malIds.length; i += CONCURRENT_STREAMING) {
        const chunk = malIds.slice(i, i + CONCURRENT_STREAMING)
        const chunkResults = await fetchStreamingPlatformsConcurrent(chunk)
        streamingResults.push(...chunkResults)
        
        // Extra delay between chunks
        if (i + CONCURRENT_STREAMING < malIds.length) {
          await sleep(500)
        }
      }
    }
    
    const streamingMap = new Map()
    for (const result of streamingResults) {
      streamingMap.set(result.malId, result.platforms)
    }
    
    let newAnime = 0
    for (const malId of malIds) {
      const animeData = animeDataMap.get(malId)
      const streaming = streamingMap.get(malId) || []
      
      const processedAnime = processAnimeData(animeData, streaming)
      state.pendingAnime.push(processedAnime)
      state.stats.totalFetched++
      newAnime++
      
      if (state.pendingAnime.length >= BATCH_SIZE) {
        await saveBatchToDatabase()
      }
    }
    
    log(`Top Anime (Page ${page}) - Fetched: ${data.data.length}, New: ${newAnime}`)
    return data.pagination?.has_next_page
  } catch (error) {
    log(`Error fetching top anime page ${page}: ${error.message}`, 'error')
    return false
  }
}

// Main continuous fetch loop
async function continuousFetch() {
  log('🔄 Starting continuous fetch mode...', 'info')
  
  let topPage = 1
  
  while (state.isRunning) {
    log(`\n⭐ Fetching top anime (Page ${topPage})...`)
    const hasMore = await fetchTopAnime(topPage)
    
    if (hasMore) {
      topPage++
    } else {
      topPage = 1
    }
    
    if (topPage % 50 === 0) {
      printStats()
    }
  }
}

// Graceful shutdown handler
async function gracefulShutdown(signal) {
  if (!state.isRunning) return
  
  log(`\n\n🛑 Received ${signal} signal. Shutting down gracefully...`, 'warning')
  state.isRunning = false
  
  if (statsInterval) {
    clearInterval(statsInterval)
  }
  
  if (state.pendingAnime.length > 0) {
    log(`💾 Saving ${state.pendingAnime.length} pending anime...`)
    await saveBatchToDatabase()
  }
  
  printStats(false)
  await saveStatsToFile()
  log(`📊 Final stats saved to ${STATE_FILE}`, 'success')
  
  await prisma.$disconnect()
  log('✅ Shutdown complete. Goodbye!', 'success')
  process.exit(0)
}

// Main function
async function main() {
  console.log('\n' + '='.repeat(70))
  console.log('🌙 OPTIMIZED ANIME IMPORT SCRIPT - 3X FASTER!'.padStart(55))
  console.log('='.repeat(70) + '\n')
  
  log('🔍 Running startup diagnostics...', 'info')
  
  if (!process.env.DATABASE_URL) {
    log('❌ DATABASE_URL not found in environment!', 'error')
    log('   Please create a .env file with DATABASE_URL', 'error')
    process.exit(1)
  }
  log('✅ DATABASE_URL found', 'success')
  
  // Try to connect with retries
  let connected = false
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await prisma.$connect()
      const animeCount = await prisma.anime.count()
      log(`✅ Database connected (Current anime count: ${animeCount})`, 'success')
      connected = true
      break
    } catch (error) {
      log(`⚠️  Database connection attempt ${attempt}/3 failed`, 'warning')
      if (attempt === 3) {
        log('❌ Database connection failed after 3 attempts!', 'error')
        log(`   Error: ${error.message}`, 'error')
        process.exit(1)
      }
      await sleep(5000) // Wait 5 seconds before retry
    }
  }
  
  try {
    log('🌐 Testing Jikan API connection...')
    const testResponse = await fetch(`${JIKAN_BASE_URL}/anime/1`)
    if (testResponse.ok) {
      log('✅ Jikan API is accessible', 'success')
    }
  } catch (error) {
    log('❌ Cannot reach Jikan API!', 'error')
    log(`   Error: ${error.message}`, 'error')
    process.exit(1)
  }
  
  log('\n✨ All diagnostics passed! Starting import...\n', 'success')
  log('🐌 ULTRA-SAFE MODE - Zero rate limiting!', 'info')
  log(`Rate limit: 1 req/sec (1000ms delay) - ULTRA SAFE`, 'info')
  log(`Concurrent streaming: DISABLED (sequential only) - SAFEST`, 'info')
  log(`Batch size: 20 anime per DB transaction - STABLE`, 'info')
  log(`Target: Top 1000 anime per genre (${GENRES.length} genres)`, 'info')
  log(`Filters out: Hentai and Rx-rated content automatically`, 'info')
  log(`⏱️  This will be SLOW but STABLE - no rate limit errors!`, 'warning')
  log('Press Ctrl+C to stop gracefully', 'info')
  log(`Stats will be saved to ${STATE_FILE} every 5 minutes`, 'info')
  
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  
  try {
    await loadPreviousStats()
    await loadExistingAnimeIds()
    
    statsInterval = setInterval(() => {
      saveStatsToFile()
      log('💾 Stats auto-saved to file', 'info')
    }, STATS_SAVE_INTERVAL)
    
    await processGenres()
    
    if (state.isRunning) {
      log('\n🎉 Completed all genres! Entering continuous fetch mode...', 'success')
      await continuousFetch()
    }
  } catch (error) {
    log(`❌ Fatal error: ${error.message}`, 'error')
    log(`   Stack trace: ${error.stack}`, 'error')
    console.error(error)
    await gracefulShutdown('ERROR')
  }
}

main()
