/**
 * Grouping Learning System
 * 
 * Tracks pattern success/failure rates and learns from user feedback
 * to continuously improve anime grouping accuracy.
 */

import { db } from './db.js'
import { logger } from './logger.js'

export type PatternType = 'title_pattern' | 'relationship_type' | 'studio_match' | 'year_proximity' | 'fuzzy_match'

export interface GroupingPattern {
  id: string
  patternType: PatternType
  pattern: string
  successCount: number
  failureCount: number
  lastUsed: Date
  confidence: number
  metadata?: string | null
}

/**
 * Record a successful grouping using a pattern
 */
export async function recordGroupingSuccess(
  patternType: PatternType,
  pattern: string,
  animeIds: string[]
): Promise<void> {
  try {
    // Check if Prisma client has been regenerated with new models
    if (!db.groupingPattern) {
      logger.warn('GroupingPattern model not available - run "prisma generate" after migration')
      return
    }
    
    const existing = await db.groupingPattern.findUnique({
      where: {
        patternType_pattern: {
          patternType,
          pattern,
        },
      },
    })

    if (existing) {
      // Update existing pattern
      const newSuccessCount = existing.successCount + 1
      const newConfidence = calculateNewConfidence(
        existing.successCount,
        existing.failureCount,
        existing.confidence,
        true
      )

      await db.groupingPattern.update({
        where: { id: existing.id },
        data: {
          successCount: newSuccessCount,
          confidence: newConfidence,
          lastUsed: new Date(),
        },
      })
    } else {
      // Create new pattern with initial confidence
      const initialConfidence = getInitialConfidence(patternType)
      await db.groupingPattern.create({
        data: {
          patternType,
          pattern,
          successCount: 1,
          failureCount: 0,
          confidence: initialConfidence,
          lastUsed: new Date(),
          metadata: JSON.stringify({ firstSeen: animeIds }),
        },
      })
    }
  } catch (error) {
    logger.error('Failed to record grouping success', error instanceof Error ? error : undefined, {
      patternType,
      pattern,
      animeCount: animeIds.length,
    })
  }
}

/**
 * Record a failed grouping using a pattern
 */
export async function recordGroupingFailure(
  patternType: PatternType,
  pattern: string,
  animeIds: string[]
): Promise<void> {
  try {
    // Check if Prisma client has been regenerated with new models
    if (!db.groupingPattern) {
      logger.warn('GroupingPattern model not available - run "prisma generate" after migration')
      return
    }
    
    const existing = await db.groupingPattern.findUnique({
      where: {
        patternType_pattern: {
          patternType,
          pattern,
        },
      },
    })

    if (existing) {
      // Update existing pattern
      const newFailureCount = existing.failureCount + 1
      const newConfidence = calculateNewConfidence(
        existing.successCount,
        existing.failureCount,
        existing.confidence,
        false
      )

      await db.groupingPattern.update({
        where: { id: existing.id },
        data: {
          failureCount: newFailureCount,
          confidence: newConfidence,
          lastUsed: new Date(),
        },
      })
    } else {
      // Create new pattern with low initial confidence
      await db.groupingPattern.create({
        data: {
          patternType,
          pattern,
          successCount: 0,
          failureCount: 1,
          confidence: 0.3, // Low confidence for failed patterns
          lastUsed: new Date(),
          metadata: JSON.stringify({ firstFailure: animeIds }),
        },
      })
    }
  } catch (error) {
    logger.error('Failed to record grouping failure', error instanceof Error ? error : undefined, {
      patternType,
      pattern,
      animeCount: animeIds.length,
    })
  }
}

/**
 * Get confidence score for a pattern
 */
export async function getPatternConfidence(
  patternType: PatternType,
  pattern: string
): Promise<number> {
  try {
    // Check if Prisma client has been regenerated with new models
    if (!db.groupingPattern) {
      return getInitialConfidence(patternType)
    }
    
    const existing = await db.groupingPattern.findUnique({
      where: {
        patternType_pattern: {
          patternType,
          pattern,
        },
      },
    })

    if (existing) {
      return existing.confidence
    }

    // Return initial confidence for unknown patterns
    return getInitialConfidence(patternType)
  } catch (error) {
    logger.error('Failed to get pattern confidence', error instanceof Error ? error : undefined, {
      patternType,
      pattern,
    })
    return 0.5 // Default fallback
  }
}

/**
 * Calculate new confidence based on success/failure
 * Uses weighted average: newConfidence = (successCount * 0.9 + oldConfidence * 0.1) / (total + 1)
 */
function calculateNewConfidence(
  currentSuccessCount: number,
  currentFailureCount: number,
  currentConfidence: number,
  isSuccess: boolean
): number {
  const newSuccessCount = isSuccess ? currentSuccessCount + 1 : currentSuccessCount
  const newFailureCount = isSuccess ? currentFailureCount : currentFailureCount + 1
  const totalCount = newSuccessCount + newFailureCount

  if (totalCount === 0) {
    return currentConfidence
  }

  // Weighted average: recent performance (90%) + historical confidence (10%)
  const performanceScore = newSuccessCount / totalCount
  const newConfidence = performanceScore * 0.9 + currentConfidence * 0.1

  // Clamp between 0.1 and 0.95
  return Math.max(0.1, Math.min(0.95, newConfidence))
}

/**
 * Get initial confidence based on pattern type
 */
function getInitialConfidence(patternType: PatternType): number {
  switch (patternType) {
    case 'relationship_type':
      return 0.9 // Database relationships are highly reliable
    case 'title_pattern':
      return 0.7 // Title patterns are moderately reliable
    case 'studio_match':
      return 0.6 // Studio matching is less reliable
    case 'year_proximity':
      return 0.5 // Year proximity is somewhat reliable
    case 'fuzzy_match':
      return 0.5 // Fuzzy matching is somewhat reliable
    default:
      return 0.5
  }
}

/**
 * Learn from user feedback
 */
export async function learnFromFeedback(feedback: {
  animeId: string
  groupType: string
  action: string
  sourceGroupId?: string | null
  targetGroupId?: string | null
}): Promise<void> {
  try {
    // Check if Prisma client has been regenerated with new models
    if (!db.groupingFeedback) {
      logger.warn('GroupingFeedback model not available - run "prisma generate" after migration')
      return
    }
    
    // Record the feedback
    await db.groupingFeedback.create({
      data: {
        animeId: feedback.animeId,
        groupType: feedback.groupType,
        action: feedback.action,
        sourceGroupId: feedback.sourceGroupId,
        targetGroupId: feedback.targetGroupId,
        confidence: 'medium', // User corrections are medium confidence
      },
    })

    // If it's a merge or split action, we can infer pattern failures
    if (feedback.action === 'merge' || feedback.action === 'split') {
      // This indicates the grouping system made an error
      // We'll need to identify which pattern was used and mark it as failed
      // For now, we'll log it for later analysis
      logger.info('Grouping feedback received', {
        animeId: feedback.animeId,
        action: feedback.action,
        groupType: feedback.groupType,
      })
    }
  } catch (error) {
    logger.error('Failed to learn from feedback', error instanceof Error ? error : undefined, undefined, feedback)
  }
}

/**
 * Update all pattern weights based on recent performance
 * Called by background job
 */
export async function updatePatternWeights(): Promise<void> {
  try {
    // Check if Prisma client has been regenerated with new models
    if (!db.groupingPattern) {
      logger.warn('GroupingPattern model not available - run "prisma generate" after migration')
      return
    }
    
    const patterns = await db.groupingPattern.findMany({
      where: {
        OR: [
          { successCount: { gt: 0 } },
          { failureCount: { gt: 0 } },
        ],
      },
    })

    let updated = 0
    for (const pattern of patterns) {
      const totalCount = pattern.successCount + pattern.failureCount
      if (totalCount === 0) continue

      const performanceScore = pattern.successCount / totalCount
      const newConfidence = performanceScore * 0.9 + pattern.confidence * 0.1

      await db.groupingPattern.update({
        where: { id: pattern.id },
        data: {
          confidence: Math.max(0.1, Math.min(0.95, newConfidence)),
        },
      })

      updated++
    }

    logger.info(`Updated ${updated} pattern weights`)
  } catch (error) {
    logger.error('Failed to update pattern weights', error instanceof Error ? error : undefined)
  }
}

/**
 * Decay old patterns (reduce confidence if not used recently)
 */
export async function decayOldPatterns(daysThreshold = 90): Promise<void> {
  try {
    // Check if Prisma client has been regenerated with new models
    if (!db.groupingPattern) {
      logger.warn('GroupingPattern model not available - run "prisma generate" after migration')
      return
    }
    
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysThreshold)

    const oldPatterns = await db.groupingPattern.findMany({
      where: {
        lastUsed: { lt: cutoffDate },
        confidence: { gt: 0.2 }, // Only decay patterns with decent confidence
      },
    })

    let decayed = 0
    for (const pattern of oldPatterns) {
      // Reduce confidence by 10% for each 30 days past threshold
      const daysOld = Math.floor(
        (Date.now() - pattern.lastUsed.getTime()) / (1000 * 60 * 60 * 24)
      )
      const decayFactor = Math.max(0.5, 1 - (daysOld - daysThreshold) / 300) // Decay over 300 days
      const newConfidence = pattern.confidence * decayFactor

      await db.groupingPattern.update({
        where: { id: pattern.id },
        data: {
          confidence: Math.max(0.1, newConfidence),
        },
      })

      decayed++
    }

    if (decayed > 0) {
      logger.info(`Decayed ${decayed} old patterns`)
    }
  } catch (error) {
    logger.error('Failed to decay old patterns', error instanceof Error ? error : undefined)
  }
}

/**
 * Get top patterns by confidence
 */
export async function getTopPatterns(
  limit = 20,
  patternType?: PatternType
): Promise<GroupingPattern[]> {
  try {
    // Check if Prisma client has been regenerated with new models
    if (!db.groupingPattern) {
      logger.warn('GroupingPattern model not available - run "prisma generate" after migration')
      return []
    }
    
    const patterns = await db.groupingPattern.findMany({
      where: patternType ? { patternType } : undefined,
      orderBy: { confidence: 'desc' },
      take: limit,
    })

    return patterns.map((p: any) => ({
      id: p.id,
      patternType: p.patternType as PatternType,
      pattern: p.pattern,
      successCount: p.successCount,
      failureCount: p.failureCount,
      lastUsed: p.lastUsed,
      confidence: p.confidence,
      metadata: p.metadata,
    }))
  } catch (error) {
    logger.error('Failed to get top patterns', error instanceof Error ? error : undefined)
    return []
  }
}

/**
 * Get grouping statistics
 */
export async function getGroupingStatistics(): Promise<{
  totalPatterns: number
  averageConfidence: number
  highConfidencePatterns: number
  recentFeedback: number
  successRate: number
}> {
  try {
    // Check if Prisma client has been regenerated with new models
    if (!db.groupingPattern || !db.groupingFeedback) {
      logger.warn('Grouping models not available - run "prisma generate" after migration')
      return {
        totalPatterns: 0,
        averageConfidence: 0,
        highConfidencePatterns: 0,
        recentFeedback: 0,
        successRate: 0,
      }
    }
    
    const [patterns, feedback] = await Promise.all([
      db.groupingPattern.findMany(),
      db.groupingFeedback.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      }),
    ])

    const totalPatterns = patterns.length
    const averageConfidence =
      patterns.length > 0
        ? patterns.reduce((sum: number, p: any) => sum + p.confidence, 0) / patterns.length
        : 0
    const highConfidencePatterns = patterns.filter((p: any) => p.confidence >= 0.7).length
    const recentFeedback = feedback.length

    const totalAttempts = patterns.reduce(
      (sum: number, p: any) => sum + p.successCount + p.failureCount,
      0
    )
    const totalSuccesses = patterns.reduce((sum: number, p: any) => sum + p.successCount, 0)
    const successRate = totalAttempts > 0 ? totalSuccesses / totalAttempts : 0

    return {
      totalPatterns,
      averageConfidence,
      highConfidencePatterns,
      recentFeedback,
      successRate,
    }
  } catch (error) {
    logger.error('Failed to get grouping statistics', error instanceof Error ? error : undefined)
    return {
      totalPatterns: 0,
      averageConfidence: 0,
      highConfidencePatterns: 0,
      recentFeedback: 0,
      successRate: 0,
    }
  }
}
