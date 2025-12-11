/**
 * AnimeSenpai - Database Status Checker
 * 
 * Quickly check the current state of the database
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required')
}

const pool = new pg.Pool({ connectionString: databaseUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('📊 AnimeSenpai Database Status')
  console.log('================================\n')
  
  try {
    // Anime statistics
    const animeCount = await prisma.anime.count()
    const animeWithTrailers = await prisma.anime.count({
      where: { trailer: { not: null } }
    })
    const airingAnime = await prisma.anime.count({
      where: { airing: true }
    })
    const completedAnime = await prisma.anime.count({
      where: { status: 'Finished Airing' }
    })
    
    console.log('🎌 Anime')
    console.log(`   Total: ${animeCount}`)
    console.log(`   With trailers: ${animeWithTrailers}`)
    console.log(`   Currently airing: ${airingAnime}`)
    console.log(`   Completed: ${completedAnime}`)
    console.log()
    
    // Genre statistics
    const genreCount = await prisma.genre.count()
    const topGenres = await prisma.genre.findMany({
      take: 5,
      select: {
        name: true,
        _count: {
          select: { anime: true }
        }
      },
      orderBy: {
        anime: {
          _count: 'desc'
        }
      }
    })
    
    console.log('🏷️  Genres')
    console.log(`   Total: ${genreCount}`)
    console.log('   Top 5:')
    topGenres.forEach((genre, i) => {
      console.log(`      ${i + 1}. ${genre.name} (${genre._count.anime} anime)`)
    })
    console.log()
    
    // User statistics
    const userCount = await prisma.user.count()
    const verifiedUsers = await prisma.user.count({
      where: { emailVerified: true }
    })
    
    console.log('👥 Users')
    console.log(`   Total: ${userCount}`)
    console.log(`   Verified: ${verifiedUsers}`)
    console.log()
    
    // User activity statistics
    const listEntries = await prisma.userAnimeList.count()
    const ratings = await prisma.userAnimeRating.count()
    const reviews = await prisma.userAnimeReview.count()
    
    console.log('📝 User Activity')
    console.log(`   List entries: ${listEntries}`)
    console.log(`   Ratings: ${ratings}`)
    console.log(`   Reviews: ${reviews}`)
    console.log()
    
    // Most popular anime
    const popularAnime = await prisma.anime.findMany({
      take: 5,
      orderBy: { viewCount: 'desc' },
      select: {
        title: true,
        viewCount: true,
        averageRating: true
      }
    })
    
    console.log('⭐ Top 5 Most Viewed Anime')
    popularAnime.forEach((anime, i) => {
      console.log(`   ${i + 1}. ${anime.title}`)
      console.log(`      Views: ${anime.viewCount} | Rating: ${anime.averageRating?.toFixed(1) || 'N/A'}`)
    })
    console.log()
    
    // Check if ready for production
    const readyForProduction = animeCount >= 5000 && userCount > 0
    
    if (readyForProduction) {
      console.log('✅ Database appears ready for production!')
    } else {
      console.log('⚠️  Database may not be ready for production:')
      if (animeCount < 5000) {
        console.log(`   - Need ${5000 - animeCount} more anime`)
      }
      if (userCount === 0) {
        console.log('   - No users in database')
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking database status:', error)
    throw error
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

