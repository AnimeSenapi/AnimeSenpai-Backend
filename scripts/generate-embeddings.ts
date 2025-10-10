/**
 * AnimeSenpai - ML Embeddings Generator
 * 
 * Generates TF-IDF embeddings for all anime in the database
 * These embeddings power semantic similarity recommendations
 */

import { PrismaClient } from '@prisma/client'
import { getAnimeEmbedding, getEmbeddingStats } from '../src/lib/ml-embeddings'

const prisma = new PrismaClient()

interface GenerationStats {
  totalAnime: number
  processed: number
  successful: number
  failed: number
  skipped: number
  startTime: number
  endTime?: number
}

const stats: GenerationStats = {
  totalAnime: 0,
  processed: 0,
  successful: 0,
  failed: 0,
  skipped: 0,
  startTime: Date.now()
}

/**
 * Generate embedding for a single anime
 */
async function generateEmbeddingForAnime(animeId: string, title: string): Promise<boolean> {
  try {
    // Check if embedding already exists
    const existing = await prisma.animeEmbedding.findUnique({
      where: { animeId }
    })
    
    if (existing && existing.combinedVector) {
      stats.skipped++
      return true
    }
    
    // Generate embedding (this automatically saves to DB)
    await getAnimeEmbedding(animeId)
    
    stats.successful++
    return true
  } catch (error) {
    console.error(`   ❌ Error generating embedding for "${title}":`, error)
    stats.failed++
    return false
  }
}

/**
 * Progress indicator
 */
function displayProgress() {
  const percentage = ((stats.processed / stats.totalAnime) * 100).toFixed(1)
  const elapsed = Date.now() - stats.startTime
  const rate = stats.processed / (elapsed / 1000)
  const remaining = Math.ceil((stats.totalAnime - stats.processed) / rate)
  
  console.log(`   Progress: ${stats.processed}/${stats.totalAnime} (${percentage}%)`)
  console.log(`   ✅ ${stats.successful} successful | ⏭️  ${stats.skipped} skipped | ❌ ${stats.failed} failed`)
  console.log(`   ⏱️  Rate: ${rate.toFixed(1)} anime/sec | ETA: ${remaining}s\n`)
}

/**
 * Main function
 */
async function main() {
  console.log('🧠 AnimeSenpai ML Embeddings Generator')
  console.log('========================================\n')
  
  // Get current embedding stats
  console.log('📊 Checking current embedding status...\n')
  const currentStats = await getEmbeddingStats()
  
  console.log(`Current Status:`)
  console.log(`   Total Anime: ${currentStats.totalAnime}`)
  console.log(`   With Embeddings: ${currentStats.withEmbeddings}`)
  console.log(`   Coverage: ${(currentStats.coverage * 100).toFixed(1)}%`)
  console.log(`   Vector Size: ${currentStats.averageVectorSize} dimensions\n`)
  
  if (currentStats.coverage >= 0.99) {
    console.log('✅ Almost all anime already have embeddings!')
    console.log('   Run this script again if you import new anime.\n')
  }
  
  // Get all anime
  console.log('📥 Fetching anime from database...\n')
  const allAnime = await prisma.anime.findMany({
    select: {
      id: true,
      title: true,
      synopsis: true,
      description: true
    },
    orderBy: {
      createdAt: 'desc' // Process newest first
    }
  })
  
  stats.totalAnime = allAnime.length
  
  console.log(`Found ${stats.totalAnime} anime to process\n`)
  console.log('⚙️  Processing in batches...\n')
  
  // Process in batches to show progress
  const BATCH_SIZE = 50
  
  for (let i = 0; i < allAnime.length; i += BATCH_SIZE) {
    const batch = allAnime.slice(i, Math.min(i + BATCH_SIZE, allAnime.length))
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(allAnime.length / BATCH_SIZE)
    
    console.log(`📦 Batch ${batchNumber}/${totalBatches} (${batch.length} anime)`)
    
    // Process batch
    for (const anime of batch) {
      await generateEmbeddingForAnime(anime.id, anime.title)
      stats.processed++
    }
    
    displayProgress()
  }
  
  stats.endTime = Date.now()
  
  // Final stats
  const finalStats = await getEmbeddingStats()
  const duration = ((stats.endTime - stats.startTime) / 1000 / 60).toFixed(2)
  
  console.log('\n🎉 Embedding Generation Complete!')
  console.log('==================================\n')
  console.log(`⏱️  Duration: ${duration} minutes`)
  console.log(`📊 Processed: ${stats.processed} anime`)
  console.log(`✅ Successful: ${stats.successful}`)
  console.log(`⏭️  Skipped: ${stats.skipped} (already had embeddings)`)
  console.log(`❌ Failed: ${stats.failed}`)
  console.log(`\n📈 Final Coverage: ${(finalStats.coverage * 100).toFixed(1)}%\n`)
  
  if (finalStats.coverage >= 0.95) {
    console.log('🎊 Excellent! Your recommendation system is ready to go!')
    console.log('   Users will now get ML-powered semantic recommendations.')
  } else if (finalStats.coverage >= 0.80) {
    console.log('👍 Good coverage! Most anime have embeddings.')
    console.log('   Some anime may not have recommendations yet.')
  } else {
    console.log('⚠️  Low coverage. Some anime may be missing data (descriptions).')
    console.log('   This is normal if the anime data is incomplete.')
  }
  
  console.log('\n💡 Embedding Details:')
  console.log(`   Type: TF-IDF (Term Frequency-Inverse Document Frequency)`)
  console.log(`   Dimensions: ${finalStats.averageVectorSize}`)
  console.log(`   Source: Anime descriptions + genres`)
  console.log(`   Similarity: Cosine similarity`)
  console.log(`   Updates: Automatic on anime data change\n`)
  
  console.log('🔄 To regenerate embeddings:')
  console.log('   1. Delete existing: await prisma.animeEmbedding.deleteMany()')
  console.log('   2. Run this script again\n')
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

