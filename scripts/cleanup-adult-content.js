#!/usr/bin/env bun

/**
 * 🧹 Adult Content Cleanup Script
 * 
 * Removes all hentai and Rx-rated anime from the database
 * 
 * This script:
 * - Finds all anime with adult content (Hentai, Rx rating, Erotica genre)
 * - Shows what will be deleted
 * - Asks for confirmation
 * - Deletes the content safely
 * - Logs what was removed
 * 
 * Usage:
 *   bun cleanup-adult-content.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logHeader(message) {
  console.log('\n' + '='.repeat(70))
  log(message, 'bright')
  console.log('='.repeat(70) + '\n')
}

async function findAdultContent() {
  log('🔍 Scanning database for adult content...', 'cyan')
  
  // Find anime with adult ratings
  const adultRatings = await prisma.anime.findMany({
    where: {
      OR: [
        { rating: { contains: 'Hentai', mode: 'insensitive' } },
        { rating: { contains: 'Rx', mode: 'insensitive' } },
      ]
    },
    select: {
      id: true,
      title: true,
      titleEnglish: true,
      rating: true,
    }
  })
  
  // Find anime with adult genres (Hentai, Erotica)
  const hentaiGenre = await prisma.genre.findFirst({
    where: {
      OR: [
        { name: { equals: 'Hentai', mode: 'insensitive' } },
        { name: { equals: 'Erotica', mode: 'insensitive' } },
      ]
    }
  })
  
  let adultGenres = []
  if (hentaiGenre) {
    adultGenres = await prisma.anime.findMany({
      where: {
        genres: {
          some: {
            genre: {
              OR: [
                { name: { equals: 'Hentai', mode: 'insensitive' } },
                { name: { equals: 'Erotica', mode: 'insensitive' } },
              ]
            }
          }
        }
      },
      select: {
        id: true,
        title: true,
        titleEnglish: true,
        rating: true,
        genres: {
          include: {
            genre: true
          }
        }
      }
    })
  }
  
  // Combine and deduplicate
  const allAdultContent = new Map()
  
  for (const anime of adultRatings) {
    allAdultContent.set(anime.id, { ...anime, reason: 'Adult Rating' })
  }
  
  for (const anime of adultGenres) {
    if (!allAdultContent.has(anime.id)) {
      allAdultContent.set(anime.id, { ...anime, reason: 'Adult Genre' })
    } else {
      allAdultContent.get(anime.id).reason = 'Adult Rating & Genre'
    }
  }
  
  return Array.from(allAdultContent.values())
}

async function deleteAdultContent(adultAnime) {
  log('\n🗑️  Deleting adult content from database...', 'yellow')
  
  let deleted = 0
  let errors = 0
  
  for (const anime of adultAnime) {
    try {
      // Delete the anime (cascade will handle related records)
      await prisma.anime.delete({
        where: { id: anime.id }
      })
      
      deleted++
      
      if (deleted % 10 === 0) {
        log(`   Deleted ${deleted}/${adultAnime.length}...`, 'cyan')
      }
    } catch (error) {
      errors++
      log(`   ❌ Error deleting ${anime.title}: ${error.message}`, 'red')
    }
  }
  
  return { deleted, errors }
}

async function main() {
  logHeader('🧹 ADULT CONTENT CLEANUP SCRIPT')
  
  log('This script will remove all hentai and Rx-rated anime from your database.', 'yellow')
  log('This includes anime with:', 'yellow')
  log('  • Ratings containing "Hentai" or "Rx"', 'yellow')
  log('  • Genres "Hentai" or "Erotica"', 'yellow')
  log('\n⚠️  WARNING: This operation is PERMANENT and cannot be undone!', 'red')
  
  // Connect to database
  try {
    await prisma.$connect()
    log('\n✅ Connected to database', 'green')
  } catch (error) {
    log('\n❌ Database connection failed!', 'red')
    log(`   Error: ${error.message}`, 'red')
    process.exit(1)
  }
  
  // Find adult content
  const adultAnime = await findAdultContent()
  
  if (adultAnime.length === 0) {
    logHeader('✨ NO ADULT CONTENT FOUND')
    log('Your database is already clean! No anime to remove.', 'green')
    await prisma.$disconnect()
    process.exit(0)
  }
  
  logHeader(`📊 FOUND ${adultAnime.length} ANIME WITH ADULT CONTENT`)
  
  // Show first 20 examples
  log('Examples of what will be deleted:', 'cyan')
  console.log('')
  
  const examples = adultAnime.slice(0, 20)
  for (const anime of examples) {
    const title = anime.titleEnglish || anime.title
    const reason = anime.reason
    const rating = anime.rating || 'N/A'
    log(`  • ${title}`, 'yellow')
    log(`    ID: ${anime.id} | Rating: ${rating} | Reason: ${reason}`, 'reset')
  }
  
  if (adultAnime.length > 20) {
    log(`\n  ... and ${adultAnime.length - 20} more`, 'cyan')
  }
  
  // Confirmation prompt
  console.log('\n' + '='.repeat(70))
  log(`⚠️  ABOUT TO DELETE ${adultAnime.length} ANIME`, 'red')
  console.log('='.repeat(70))
  
  // Get user confirmation
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  })
  
  const confirm = await new Promise((resolve) => {
    readline.question('\nType "DELETE" (in all caps) to confirm deletion, or anything else to cancel: ', (answer) => {
      readline.close()
      resolve(answer)
    })
  })
  
  if (confirm !== 'DELETE') {
    log('\n❌ Deletion cancelled by user', 'yellow')
    log('No changes were made to the database.', 'cyan')
    await prisma.$disconnect()
    process.exit(0)
  }
  
  // Perform deletion
  logHeader('🗑️  DELETING ADULT CONTENT')
  
  const startTime = Date.now()
  const { deleted, errors } = await deleteAdultContent(adultAnime)
  const duration = ((Date.now() - startTime) / 1000).toFixed(2)
  
  // Summary
  logHeader('✅ CLEANUP COMPLETE')
  
  log(`✅ Deleted:        ${deleted} anime`, 'green')
  log(`❌ Errors:         ${errors}`, errors > 0 ? 'red' : 'green')
  log(`⏱️  Duration:       ${duration}s`, 'cyan')
  log(`💾 Database:       Updated`, 'green')
  
  if (deleted > 0) {
    log('\n✨ Your database is now free of adult content!', 'green')
  }
  
  if (errors > 0) {
    log(`\n⚠️  Warning: ${errors} anime could not be deleted. Check the errors above.`, 'yellow')
  }
  
  // Disconnect
  await prisma.$disconnect()
  log('\n👋 Goodbye!', 'cyan')
}

// Handle errors
main().catch(async (error) => {
  log('\n❌ FATAL ERROR', 'red')
  log(error.message, 'red')
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})

