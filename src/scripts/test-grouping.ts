/**
 * Test Grouping System
 * 
 * Simple test script to verify the grouping system works correctly
 */

import { db } from '../lib/db.js'
import { groupAnimeWithLearning, getAnimeGrouping } from '../lib/enhanced-grouping.js'
import { getGroupingStatistics, getTopPatterns } from '../lib/grouping-learning.js'
import { logger } from '../lib/logger.js'

async function testGrouping() {
  logger.info('Starting grouping system test...')
  
  try {
    // Test 1: Get grouping statistics
    logger.info('Test 1: Getting grouping statistics...')
    const stats = await getGroupingStatistics()
    logger.info('Grouping statistics:', stats)
    
    // Test 2: Get top patterns
    logger.info('Test 2: Getting top patterns...')
    const topPatterns = await getTopPatterns(5)
    logger.info(`Found ${topPatterns.length} top patterns`)
    topPatterns.forEach((pattern, index) => {
      logger.info(`Pattern ${index + 1}: ${pattern.patternType}:${pattern.pattern} (confidence: ${pattern.confidence.toFixed(2)})`)
    })
    
    // Test 3: Get a sample of anime and try grouping
    logger.info('Test 3: Testing anime grouping...')
    const sampleAnime = await db.anime.findMany({
      take: 20,
      select: {
        id: true,
        title: true,
        titleEnglish: true,
        year: true,
        studio: true,
        slug: true,
        coverImage: true,
        averageRating: true,
      },
      orderBy: {
        viewCount: 'desc',
      },
    })
    
    let groups: any[] = []
    if (sampleAnime.length > 0) {
      logger.info(`Testing grouping with ${sampleAnime.length} anime...`)
      groups = await groupAnimeWithLearning(sampleAnime)
      logger.info(`Created ${groups.length} groups`)
      
      groups.forEach((group, index) => {
        logger.info(`Group ${index + 1}: ${group.type} - ${group.animeIds.length} anime (confidence: ${group.confidence.toFixed(2)})`)
      })
      
      // Test 4: Get grouping for a specific anime
      logger.info('Test 4: Getting grouping for specific anime...')
      const firstAnime = sampleAnime[0]
      const grouping = await getAnimeGrouping(firstAnime.id)
      logger.info(`Grouping for "${firstAnime.title}":`, {
        hasSeries: !!grouping.series,
        hasFranchise: !!grouping.franchise,
        seriesAnimeCount: grouping.series?.animeIds.length || 0,
        franchiseAnimeCount: grouping.franchise?.animeIds.length || 0,
      })
    } else {
      logger.warn('No anime found in database for testing')
    }
    
    logger.info('Grouping system test completed successfully!')
    return { success: true, stats, groupsCount: groups.length }
  } catch (error) {
    logger.error('Grouping system test failed', error)
    throw error
  }
}

// Run if called directly
if (require.main === module) {
  testGrouping()
    .then(result => {
      console.log('Test completed:', result)
      process.exit(0)
    })
    .catch(error => {
      console.error('Test failed:', error)
      process.exit(1)
    })
}

export { testGrouping }
