/**
 * Seed Initial Grouping Patterns
 * 
 * Initializes the grouping pattern database with high-confidence patterns
 * based on common anime naming conventions and relationship types.
 */

import { db } from '../lib/db.js'
import { logger } from '../lib/logger.js'

interface PatternSeed {
  patternType: 'title_pattern' | 'relationship_type' | 'studio_match' | 'year_proximity' | 'fuzzy_match'
  pattern: string
  confidence: number
  metadata?: string
}

const initialPatterns: PatternSeed[] = [
  // Database relationship patterns (highest confidence)
  {
    patternType: 'relationship_type',
    pattern: 'Sequel',
    confidence: 0.9,
    metadata: JSON.stringify({ description: 'Direct sequel relationship from database' }),
  },
  {
    patternType: 'relationship_type',
    pattern: 'Prequel',
    confidence: 0.9,
    metadata: JSON.stringify({ description: 'Direct prequel relationship from database' }),
  },
  {
    patternType: 'relationship_type',
    pattern: 'franchise',
    confidence: 0.85,
    metadata: JSON.stringify({ description: 'Franchise grouping using all relationship types' }),
  },
  
  // Common title patterns (high confidence)
  {
    patternType: 'title_pattern',
    pattern: 'season_pattern',
    confidence: 0.8,
    metadata: JSON.stringify({ description: 'Season N, Part N, Cour N patterns' }),
  },
  {
    patternType: 'title_pattern',
    pattern: 'final_season_pattern',
    confidence: 0.85,
    metadata: JSON.stringify({ description: 'Final Season, Last Season patterns' }),
  },
  {
    patternType: 'title_pattern',
    pattern: 'roman_numeral_pattern',
    confidence: 0.75,
    metadata: JSON.stringify({ description: 'II, III, IV, V roman numeral patterns' }),
  },
  {
    patternType: 'title_pattern',
    pattern: 'part_pattern',
    confidence: 0.8,
    metadata: JSON.stringify({ description: 'Part N patterns' }),
  },
  {
    patternType: 'title_pattern',
    pattern: 'cour_pattern',
    confidence: 0.75,
    metadata: JSON.stringify({ description: 'Cour N patterns' }),
  },
  
  // Studio matching (moderate confidence)
  {
    patternType: 'studio_match',
    pattern: 'same_studio',
    confidence: 0.6,
    metadata: JSON.stringify({ description: 'Anime from same studio with similar titles' }),
  },
  
  // Year proximity (moderate confidence)
  {
    patternType: 'year_proximity',
    pattern: 'within_3_years',
    confidence: 0.6,
    metadata: JSON.stringify({ description: 'Anime released within 3 years of each other' }),
  },
  
  // Fuzzy matching (moderate confidence)
  {
    patternType: 'fuzzy_match',
    pattern: 'levenshtein_high',
    confidence: 0.7,
    metadata: JSON.stringify({ description: 'High similarity using Levenshtein distance' }),
  },
  {
    patternType: 'fuzzy_match',
    pattern: 'word_overlap_high',
    confidence: 0.65,
    metadata: JSON.stringify({ description: 'High word overlap between titles' }),
  },
]

async function seedGroupingPatterns() {
  logger.info('Starting to seed grouping patterns...')
  
  // Check if Prisma client has been regenerated with new models
  if (!db.groupingPattern) {
    logger.error('GroupingPattern model not available. Please run: bunx prisma generate')
    throw new Error('GroupingPattern model not available. Run "bunx prisma generate" after migration.')
  }
  
  let created = 0
  let updated = 0
  let skipped = 0
  
  for (const seedPattern of initialPatterns) {
    try {
      const existing = await db.groupingPattern.findUnique({
        where: {
          patternType_pattern: {
            patternType: seedPattern.patternType,
            pattern: seedPattern.pattern,
          },
        },
      })
      
      if (existing) {
        // Update if confidence is higher
        if (seedPattern.confidence > existing.confidence) {
          await db.groupingPattern.update({
            where: { id: existing.id },
            data: {
              confidence: seedPattern.confidence,
              metadata: seedPattern.metadata,
            },
          })
          updated++
          logger.info(`Updated pattern: ${seedPattern.patternType}:${seedPattern.pattern}`)
        } else {
          skipped++
        }
      } else {
        // Create new pattern
        await db.groupingPattern.create({
          data: {
            patternType: seedPattern.patternType,
            pattern: seedPattern.pattern,
            successCount: 0,
            failureCount: 0,
            confidence: seedPattern.confidence,
            metadata: seedPattern.metadata,
            lastUsed: new Date(),
          },
        })
        created++
        logger.info(`Created pattern: ${seedPattern.patternType}:${seedPattern.pattern}`)
      }
    } catch (error) {
      logger.error(`Failed to seed pattern ${seedPattern.patternType}:${seedPattern.pattern}`, error)
    }
  }
  
  logger.info(`Pattern seeding complete: ${created} created, ${updated} updated, ${skipped} skipped`)
  
  return {
    created,
    updated,
    skipped,
    total: initialPatterns.length,
  }
}

// Run if called directly
if (require.main === module) {
  seedGroupingPatterns()
    .then(result => {
      console.log('Seeding complete:', result)
      process.exit(0)
    })
    .catch(error => {
      console.error('Seeding failed:', error)
      process.exit(1)
    })
}

export { seedGroupingPatterns }
