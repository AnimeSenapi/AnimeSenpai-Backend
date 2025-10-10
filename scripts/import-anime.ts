/**
 * AnimeSenpai - Anime Import Script
 * 
 * Imports anime data from Jikan API (MyAnimeList) into the database
 * Features:
 * - Batch processing with rate limiting
 * - Progress tracking and resume capability
 * - Error handling and retries
 * - Comprehensive data mapping
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface JikanAnime {
  mal_id: number
  url: string
  images: {
    jpg: {
      image_url?: string
      large_image_url?: string
    }
    webp: {
      image_url?: string
      large_image_url?: string
    }
  }
  trailer?: {
    youtube_id?: string
    url?: string
    embed_url?: string
  }
  approved: boolean
  titles: Array<{
    type: string
    title: string
  }>
  title: string
  title_english?: string
  title_japanese?: string
  title_synonyms?: string[]
  type?: string
  source?: string
  episodes?: number
  status?: string
  airing: boolean
  aired?: {
    from?: string
    to?: string
    prop?: {
      from?: {
        day?: number
        month?: number
        year?: number
      }
      to?: {
        day?: number
        month?: number
        year?: number
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
  producers?: Array<{ mal_id: number; name: string }>
  licensors?: Array<{ mal_id: number; name: string }>
  studios?: Array<{ mal_id: number; name: string }>
  genres?: Array<{ mal_id: number; name: string }>
  themes?: Array<{ mal_id: number; name: string }>
  demographics?: Array<{ mal_id: number; name: string }>
}

// Rate limiting: Jikan allows 3 requests per second, 60 per minute
const RATE_LIMIT_MS = 400 // 400ms between requests (2.5 requests/sec to be safe)
const BATCH_SIZE = 25 // Process 25 anime at a time
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 5000

// Progress tracking
let processedCount = 0
let successCount = 0
let errorCount = 0
let skippedCount = 0

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Create a URL-safe slug from a title
 */
function createSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100) // Limit length
}

/**
 * Fetch anime data from Jikan API with retries
 */
async function fetchAnimeData(malId: number, retries = 0): Promise<JikanAnime | null> {
  try {
    const response = await fetch(`https://api.jikan.moe/v4/anime/${malId}`)
    
    if (response.status === 404) {
      return null // Anime doesn't exist
    }
    
    if (response.status === 429) {
      // Rate limited
      console.log(`⏳ Rate limited, waiting ${RETRY_DELAY_MS}ms...`)
      await sleep(RETRY_DELAY_MS)
      return fetchAnimeData(malId, retries)
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.data as JikanAnime
  } catch (error) {
    if (retries < MAX_RETRIES) {
      console.log(`⚠️  Error fetching anime ${malId}, retry ${retries + 1}/${MAX_RETRIES}...`)
      await sleep(RETRY_DELAY_MS)
      return fetchAnimeData(malId, retries + 1)
    }
    
    console.error(`❌ Failed to fetch anime ${malId} after ${MAX_RETRIES} retries:`, error)
    return null
  }
}

/**
 * Import a single anime into the database
 */
async function importAnime(anime: JikanAnime): Promise<boolean> {
  try {
    const slug = createSlug(anime.title)
    
    // Check if anime already exists
    const existing = await prisma.anime.findFirst({
      where: {
        OR: [
          { malId: anime.mal_id },
          { slug: slug }
        ]
      }
    })
    
    if (existing) {
      skippedCount++
      return false
    }
    
    // Map trailer URL
    let trailerUrl: string | null = null
    if (anime.trailer?.youtube_id) {
      trailerUrl = `https://www.youtube.com/watch?v=${anime.trailer.youtube_id}`
    } else if (anime.trailer?.url) {
      trailerUrl = anime.trailer.url
    }
    
    // Map aired dates
    let airedString: string | null = null
    let startDate: Date | null = null
    let endDate: Date | null = null
    
    if (anime.aired?.string) {
      airedString = anime.aired.string
    }
    
    if (anime.aired?.from) {
      startDate = new Date(anime.aired.from)
    }
    
    if (anime.aired?.to) {
      endDate = new Date(anime.aired.to)
    }
    
    // Create anime record
    await prisma.anime.create({
      data: {
        slug,
        title: anime.title,
        titleEnglish: anime.title_english || null,
        titleJapanese: anime.title_japanese || null,
        titleSynonyms: anime.title_synonyms || [],
        
        type: anime.type || 'Unknown',
        source: anime.source || null,
        status: anime.status || 'Unknown',
        airing: anime.airing,
        
        episodes: anime.episodes || null,
        duration: anime.duration || null,
        
        aired: airedString,
        startDate,
        endDate,
        season: anime.season || null,
        year: anime.year || null,
        broadcast: anime.broadcast?.string || null,
        
        rating: anime.rating || null,
        
        averageRating: anime.score ? anime.score / 10 * 10 : 0, // Convert MAL 0-10 to our 0-10
        scoredBy: anime.scored_by || 0,
        rank: anime.rank || null,
        popularity: anime.popularity || null,
        members: anime.members || 0,
        favorites: anime.favorites || 0,
        
        synopsis: anime.synopsis || null,
        background: anime.background || null,
        
        producers: anime.producers?.map(p => p.name) || [],
        licensors: anime.licensors?.map(l => l.name) || [],
        studios: anime.studios?.map(s => s.name) || [],
        
        themes: anime.themes?.map(t => t.name) || [],
        demographics: anime.demographics?.map(d => d.name) || [],
        
        coverImage: anime.images.jpg.large_image_url || anime.images.jpg.image_url || null,
        bannerImage: anime.images.jpg.large_image_url || anime.images.jpg.image_url || null,
        trailer: trailerUrl,
        
        malId: anime.mal_id,
        approved: anime.approved
      }
    })
    
    // Create genre relationships
    if (anime.genres && anime.genres.length > 0) {
      const animeRecord = await prisma.anime.findUnique({
        where: { malId: anime.mal_id }
      })
      
      if (animeRecord) {
        for (const genreData of anime.genres) {
          // Find or create genre
          let genre = await prisma.genre.findUnique({
            where: { slug: createSlug(genreData.name) }
          })
          
          if (!genre) {
            genre = await prisma.genre.create({
              data: {
                name: genreData.name,
                slug: createSlug(genreData.name),
                description: `Anime in the ${genreData.name} genre`
              }
            })
          }
          
          // Create anime-genre relationship
          await prisma.animeGenre.upsert({
            where: {
              animeId_genreId: {
                animeId: animeRecord.id,
                genreId: genre.id
              }
            },
            update: {},
            create: {
              animeId: animeRecord.id,
              genreId: genre.id
            }
          })
        }
      }
    }
    
    successCount++
    return true
  } catch (error) {
    console.error(`❌ Error importing anime ${anime.mal_id} (${anime.title}):`, error)
    errorCount++
    return false
  }
}

/**
 * Main import function
 */
async function main() {
  console.log('🎌 AnimeSenpai Anime Import Script')
  console.log('====================================\n')
  
  const startTime = Date.now()
  
  // Get current count
  const currentCount = await prisma.anime.count()
  console.log(`📊 Current anime count: ${currentCount}`)
  console.log(`🎯 Target: 5,000+ anime\n`)
  
  // Calculate how many to import
  const targetCount = 5500 // Aim for 5,500 to ensure we exceed 5,000
  const toImport = Math.max(0, targetCount - currentCount)
  
  if (toImport === 0) {
    console.log('✅ Already have 5,000+ anime in the database!')
    return
  }
  
  console.log(`📥 Need to import approximately ${toImport} anime\n`)
  console.log(`⚙️  Settings:`)
  console.log(`   - Rate limit: ${RATE_LIMIT_MS}ms between requests`)
  console.log(`   - Batch size: ${BATCH_SIZE}`)
  console.log(`   - Max retries: ${MAX_RETRIES}\n`)
  
  // Start from MAL ID 1 and go up
  // We'll process sequentially with skips for missing IDs
  let currentMalId = 1
  let consecutiveNotFound = 0
  const MAX_CONSECUTIVE_NOT_FOUND = 100 // Stop if we hit 100 consecutive 404s
  
  while (successCount + skippedCount < targetCount && consecutiveNotFound < MAX_CONSECUTIVE_NOT_FOUND) {
    console.log(`\n📦 Processing batch starting at MAL ID ${currentMalId}...`)
    
    for (let i = 0; i < BATCH_SIZE; i++) {
      const malId = currentMalId++
      processedCount++
      
      // Fetch anime data
      const animeData = await fetchAnimeData(malId)
      
      if (animeData === null) {
        // Anime doesn't exist or error occurred
        consecutiveNotFound++
        continue
      }
      
      // Reset consecutive not found counter
      consecutiveNotFound = 0
      
      // Import anime
      await importAnime(animeData)
      
      // Progress update
      if (processedCount % 10 === 0) {
        const currentTotal = successCount + skippedCount
        const percentage = ((currentTotal / targetCount) * 100).toFixed(1)
        console.log(`   Progress: ${currentTotal}/${targetCount} (${percentage}%) | ✅ ${successCount} new | ⏭️  ${skippedCount} skipped | ❌ ${errorCount} errors`)
      }
      
      // Rate limiting
      await sleep(RATE_LIMIT_MS)
    }
  }
  
  // Final summary
  const endTime = Date.now()
  const duration = ((endTime - startTime) / 1000 / 60).toFixed(2)
  const finalCount = await prisma.anime.count()
  
  console.log('\n\n🎉 Import Complete!')
  console.log('==================')
  console.log(`⏱️  Duration: ${duration} minutes`)
  console.log(`📊 Final count: ${finalCount} anime`)
  console.log(`📥 Processed: ${processedCount} MAL IDs`)
  console.log(`✅ Imported: ${successCount} new anime`)
  console.log(`⏭️  Skipped: ${skippedCount} existing anime`)
  console.log(`❌ Errors: ${errorCount}`)
  
  if (finalCount >= 5000) {
    console.log('\n🎊 SUCCESS! Database now has 5,000+ anime!')
  } else {
    console.log(`\n⚠️  Still need ${5000 - finalCount} more anime to reach 5,000`)
    console.log('Run the script again to continue importing.')
  }
}

// Run the script
main()
  .catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

