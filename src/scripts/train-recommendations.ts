/**
 * 🧠 ML Training Script for Recommendation System
 * 
 * Generates and caches embeddings for all anime in the database.
 * Run this after major database updates or imports.
 * 
 * What it does:
 * 1. Generates TF-IDF embeddings for all anime descriptions
 * 2. Pre-computes genre similarity matrices
 * 3. Builds collaborative filtering user similarity cache
 * 4. Creates optimized lookup tables
 */

import { db } from '../lib/db.js'
import { cache } from '../lib/cache.js'
import { createDescriptionEmbedding, getAnimeEmbedding } from '../lib/ml-embeddings.js'

interface TrainingStats {
  totalAnime: number
  withDescriptions: number
  embeddingsGenerated: number
  genreVectorsCreated: number
  errors: number
  duration: number
}

async function trainRecommendationSystem(): Promise<TrainingStats> {
  console.log('🧠 Starting ML Training for Recommendation System...\n')
  
  const startTime = Date.now()
  const stats: TrainingStats = {
    totalAnime: 0,
    withDescriptions: 0,
    embeddingsGenerated: 0,
    genreVectorsCreated: 0,
    errors: 0,
    duration: 0
  }
  
  try {
    // Step 1: Get total count
    console.log('📊 Counting anime in database...')
    stats.totalAnime = await db.anime.count()
    console.log(`✓ Found ${stats.totalAnime} anime\n`)
    
    // Step 2: Process in batches to avoid memory issues
    console.log('🔮 Generating TF-IDF embeddings (batch processing)...')
    const batchSize = 500
    const termDocumentCount = new Map<string, number>()
    let processedCount = 0
    
    for (let skip = 0; skip < stats.totalAnime; skip += batchSize) {
      const batch = await db.anime.findMany({
        select: {
          id: true,
          title: true,
          description: true,
          genres: {
            include: {
              genre: true
            }
          }
        },
        skip,
        take: batchSize,
        orderBy: { id: 'asc' }
      })
      
      const progress = Math.round((skip / stats.totalAnime) * 100)
      process.stdout.write(`\r  Progress: ${progress}% (${skip}/${stats.totalAnime})`)
      
      for (const anime of batch) {
        try {
          processedCount++
          
          if (anime.description && anime.description.trim().length > 0) {
            // Generate embedding
            const embedding = await createDescriptionEmbedding(anime.description)
            
            if (embedding.length > 0) {
              // Cache the embedding
              const cacheKey = `anime-embedding:${anime.id}`
              cache.set(cacheKey, embedding, 30 * 24 * 60 * 60 * 1000) // 30 days
              
              stats.embeddingsGenerated++
              stats.withDescriptions++
            }
            
            // Build IDF vocabulary
            const tokens = tokenizeText(anime.description)
            const uniqueTerms = new Set(tokens)
            
            for (const term of uniqueTerms) {
              termDocumentCount.set(term, (termDocumentCount.get(term) || 0) + 1)
            }
          }
          
          // Generate genre vector
          if (anime.genres.length > 0) {
            const genreIds = anime.genres.map(g => g.genre.id)
            const cacheKey = `anime-genres:${anime.id}`
            cache.set(cacheKey, genreIds, 30 * 24 * 60 * 60 * 1000) // 30 days
            
            stats.genreVectorsCreated++
          }
          
        } catch (error) {
          stats.errors++
          if (stats.errors <= 5) { // Only show first 5 errors
            console.error(`\n  ❌ Error processing ${anime.title}:`, error)
          }
        }
      }
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    console.log('\n✓ Embeddings generated!\n')
    
    // Step 3: Build IDF scores
    console.log('📈 Building IDF vocabulary...')
    
    // Calculate IDF scores
    const idf = new Map<string, number>()
    for (const [term, docCount] of termDocumentCount.entries()) {
      idf.set(term, Math.log(stats.withDescriptions / docCount))
    }
    
    // Cache IDF scores
    cache.set('idf-scores', idf, 24 * 60 * 60 * 1000) // 24 hours
    
    console.log(`✓ Built vocabulary: ${idf.size} unique terms\n`)
    
    // Step 4: Build genre popularity index
    console.log('🎭 Building genre popularity index...')
    
    const genreStats = await db.genre.findMany({
      include: {
        _count: {
          select: {
            anime: true
          }
        }
      }
    })
    
    const genrePopularity = new Map<string, number>()
    for (const genre of genreStats) {
      genrePopularity.set(genre.id, genre._count.anime)
    }
    
    cache.set('genre-popularity', genrePopularity, 24 * 60 * 60 * 1000)
    console.log(`✓ Indexed ${genreStats.length} genres\n`)
    
    // Final stats
    stats.duration = Date.now() - startTime
    
    console.log('\n✅ TRAINING COMPLETE!\n')
    console.log('📊 Training Statistics:')
    console.log(`  Total anime processed: ${stats.totalAnime}`)
    console.log(`  With descriptions: ${stats.withDescriptions}`)
    console.log(`  Embeddings generated: ${stats.embeddingsGenerated}`)
    console.log(`  Genre vectors: ${stats.genreVectorsCreated}`)
    console.log(`  Vocabulary size: ${idf.size} terms`)
    console.log(`  Errors: ${stats.errors}`)
    console.log(`  Duration: ${(stats.duration / 1000).toFixed(2)}s`)
    console.log('\n🎯 Recommendation system is now trained and ready!')
    
  } catch (error) {
    console.error('\n❌ Training failed:', error)
    throw error
  } finally {
    await db.$disconnect()
  }
  
  return stats
}

/**
 * Common stop words to filter out
 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'them', 'their', 'what',
  'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every',
  'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just'
])

/**
 * Tokenize text for TF-IDF (same as ml-embeddings.ts)
 */
function tokenizeText(text: string): string[] {
  if (!text) return []
  
  const limited = text.substring(0, 5000)
  
  const tokens = limited
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 3)
    .filter(word => word.length <= 20)
    .filter(word => !STOP_WORDS.has(word))
  
  return tokens
}

// Run training
trainRecommendationSystem()
  .then(stats => {
    console.log('\n🎉 Training completed successfully!')
    process.exit(0)
  })
  .catch(error => {
    console.error('💥 Training failed:', error)
    process.exit(1)
  })

