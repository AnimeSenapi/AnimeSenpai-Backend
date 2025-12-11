/**
 * Enhanced Grouping Engine
 * 
 * Unified grouping system that combines series and franchise grouping
 * with learned pattern confidence scores for improved accuracy.
 */

import { db } from './db'
import {
  extractSeriesInfo,
  groupAnimeBySeriesName,
  groupAnimeByFranchise,
  buildSeasonGraph,
  buildFranchiseGraph,
  identifyFranchiseRoot,
} from './series-grouping'
import {
  getPatternConfidence,
  recordGroupingSuccess,
} from './grouping-learning'
import { logger } from './logger'

// Import franchise building functions from series-grouping
// These are defined in series-grouping.ts but need to be accessible here

export interface AnimeGroup {
  id: string // Group identifier (series name or franchise root ID)
  type: 'series' | 'franchise'
  confidence: number // 0-1, overall confidence in this grouping
  source: 'database' | 'title_pattern' | 'fuzzy_match' | 'studio_match' | 'year_proximity'
  animeIds: string[]
  metadata: {
    seriesName?: string
    franchiseRootId?: string
    seasonCount?: number
    patternUsed?: string
  }
}

/**
 * Main entry point for grouping anime with learning
 */
export async function groupAnimeWithLearning(
  animeList: Array<{
    id: string
    title: string
    titleEnglish?: string | null
    year?: number | null
    studio?: string | null
    [key: string]: any
  }>
): Promise<AnimeGroup[]> {
  const groups: AnimeGroup[] = []
  const processedAnimeIds = new Set<string>()
  
  // Pass 1: Use database relationships (highest confidence)
  const dbGroups = await groupByDatabaseRelationships(animeList)
  for (const group of dbGroups) {
    groups.push(group)
    group.animeIds.forEach(id => processedAnimeIds.add(id))
  }
  
  // Pass 2: Apply learned title patterns (weighted by confidence)
  const remainingAnime = animeList.filter(a => !processedAnimeIds.has(a.id))
  if (remainingAnime.length > 0) {
    const titleGroups = await groupByTitlePatterns(remainingAnime)
    for (const group of titleGroups) {
      // Only add if confidence is above threshold
      if (group.confidence >= 0.5) {
        groups.push(group)
        group.animeIds.forEach(id => processedAnimeIds.add(id))
      }
    }
  }
  
  // Pass 3: Apply franchise grouping using relationship graph
  const franchiseGroups = await groupFranchises(animeList)
  for (const group of franchiseGroups) {
    // Merge with existing groups if there's overlap
    const existingGroup = groups.find(g => 
      g.animeIds.some(id => group.animeIds.includes(id))
    )
    
    if (existingGroup && existingGroup.type === 'series') {
      // Upgrade series to franchise if franchise grouping found more connections
      if (group.animeIds.length > existingGroup.animeIds.length) {
        const index = groups.indexOf(existingGroup)
        groups[index] = group
      }
    } else if (!existingGroup) {
      groups.push(group)
    }
  }
  
  return groups
}

/**
 * Group by database relationships (highest confidence)
 */
async function groupByDatabaseRelationships(
  animeList: Array<{ id: string; [key: string]: any }>
): Promise<AnimeGroup[]> {
  const groups: AnimeGroup[] = []
  const processed = new Set<string>()
  
  for (const anime of animeList) {
    if (processed.has(anime.id)) continue
    
    // Get seasons from database relationships
    const seasons = await buildSeasonGraph(anime.id)
    
    if (seasons.length > 1) {
      const seasonIds = seasons.map(s => s.animeId)
      const seriesInfo = extractSeriesInfo(anime.title, anime.titleEnglish)
      
      // Record success for relationship-based grouping
      await recordGroupingSuccess('relationship_type', 'Sequel', seasonIds)
      
      groups.push({
        id: seriesInfo.seriesName,
        type: 'series',
        confidence: 0.9, // Database relationships are highly reliable
        source: 'database',
        animeIds: seasonIds,
        metadata: {
          seriesName: seriesInfo.seriesName,
          seasonCount: seasons.length,
          patternUsed: 'database_relationship',
        },
      })
      
      seasonIds.forEach(id => processed.add(id))
    }
  }
  
  return groups
}

/**
 * Group by learned title patterns
 */
async function groupByTitlePatterns(
  animeList: Array<{
    id: string
    title: string
    titleEnglish?: string | null
    year?: number | null
    studio?: string | null
    [key: string]: any
  }>
): Promise<AnimeGroup[]> {
  const groups: AnimeGroup[] = []
  
  // Use existing series grouping function
  const seriesMap = groupAnimeBySeriesName(animeList)
  
  for (const [seriesName, seasons] of seriesMap.entries()) {
    if (seasons.length < 2) continue // Skip single-item groups
    
    const animeIds = seasons.map(s => s.id)
    
    // Get confidence for title pattern matching
    const patternConfidence = await getPatternConfidence(
      'title_pattern',
      `series_name_match:${seriesName.toLowerCase()}`
    )
    
    // Calculate additional confidence factors
    let confidence = patternConfidence
    
    // Boost confidence if years are close (seasons usually within 1-3 years)
    const years = seasons
      .map(s => s.year)
      .filter((y): y is number => y !== null && y !== undefined)
      .sort((a, b) => a - b)
    
    if (years.length >= 2) {
      const lastYear = years[years.length - 1]
      const firstYear = years[0]
      if (lastYear !== undefined && firstYear !== undefined) {
        const yearSpread = lastYear - firstYear
        if (yearSpread <= 3) {
          confidence += 0.1 // Boost for close years
        } else if (yearSpread > 10) {
          confidence -= 0.2 // Penalty for very spread out years
        }
      }
    }
    
    // Boost confidence if same studio
    const studios = seasons
      .map(s => s.studio)
      .filter((s): s is string => s !== null && s !== undefined)
    
    if (studios.length >= 2 && new Set(studios).size === 1) {
      confidence += 0.1 // Boost for same studio
    }
    
    confidence = Math.max(0.1, Math.min(0.95, confidence))
    
    groups.push({
      id: seriesName,
      type: 'series',
      confidence,
      source: confidence >= 0.7 ? 'title_pattern' : 'fuzzy_match',
      animeIds,
      metadata: {
        seriesName,
        seasonCount: seasons.length,
        patternUsed: 'title_pattern',
      },
    })
    
    // Record success for this pattern
    await recordGroupingSuccess('title_pattern', `series_name_match:${seriesName.toLowerCase()}`, animeIds)
  }
  
  return groups
}

/**
 * Group franchises from anime list
 */
async function groupFranchises(
  animeList: Array<{ id: string; [key: string]: any }>
): Promise<AnimeGroup[]> {
  const groups: AnimeGroup[] = []
  const animeIds = animeList.map(a => a.id)
  
  try {
    const franchiseMap = await groupAnimeByFranchise(animeIds)
    
    for (const [rootId, franchiseIds] of franchiseMap.entries()) {
      if (franchiseIds.length < 2) continue // Skip single-item franchises
      
      // Record success for franchise grouping
      await recordGroupingSuccess('relationship_type', 'franchise', franchiseIds)
      
      groups.push({
        id: rootId,
        type: 'franchise',
        confidence: 0.85, // Franchise relationships are highly reliable
        source: 'database',
        animeIds: franchiseIds,
        metadata: {
          franchiseRootId: rootId,
          patternUsed: 'franchise_relationship',
        },
      })
    }
  } catch (error) {
    logger.error('Failed to group franchises', error instanceof Error ? error : undefined)
  }
  
  return groups
}

/**
 * Get grouping for a specific anime
 */
export async function getAnimeGrouping(animeId: string): Promise<{
  series?: {
    id: string
    name: string
    animeIds: string[]
    confidence: number
  }
  franchise?: {
    id: string
    rootId: string
    animeIds: string[]
    confidence: number
  }
}> {
  const result: {
    series?: {
      id: string
      name: string
      animeIds: string[]
      confidence: number
    }
    franchise?: {
      id: string
      rootId: string
      animeIds: string[]
      confidence: number
    }
  } = {}
  
  // Get series grouping
  const seasons = await buildSeasonGraph(animeId)
  if (seasons.length > 1) {
    const anime = await db.anime.findUnique({
      where: { id: animeId },
      select: { title: true, titleEnglish: true },
    })
    
    if (anime) {
      const seriesInfo = extractSeriesInfo(anime.title, anime.titleEnglish)
      result.series = {
        id: seriesInfo.seriesName,
        name: seriesInfo.seriesName,
        animeIds: seasons.map(s => s.animeId),
        confidence: 0.9,
      }
    }
  }
  
  // Get franchise grouping using the franchise grouping function
  try {
    const franchiseRelationTypes = [
      'Adaptation',
      'Spin-off',
      'Side story',
      'Alternative setting',
      'Parent story',
      'Alternative version',
    ]
    
    const franchise = await buildFranchiseGraph(animeId, franchiseRelationTypes)
    if (franchise.length > 1) {
      const root = identifyFranchiseRoot(franchise)
      result.franchise = {
        id: root.animeId,
        rootId: root.animeId,
        animeIds: franchise.map(s => s.animeId),
        confidence: 0.85,
      }
    }
  } catch (error) {
    logger.error('Failed to get franchise grouping', error instanceof Error ? error : undefined, { animeId })
  }
  
  return result
}
