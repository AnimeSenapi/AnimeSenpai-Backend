/**
 * Series Grouping Utility
 * Groups anime seasons/sequels into series like Crunchyroll
 */

import { db } from './db'

export interface SeasonInfo {
  seasonNumber: number
  seasonName: string
  animeId: string
  title: string
  titleEnglish?: string | null
  year?: number | null
  episodes?: number | null
  startDate?: Date | null
  type?: string | null
  slug?: string | null
  coverImage?: string | null
  averageRating?: number | null
  status?: string | null
}

export interface SeasonWithConfidence extends SeasonInfo {
  confidence: 'high' | 'medium' | 'low'
  source: 'database' | 'title'
}

/**
 * Normalize title for better matching
 */
function normalizeTitle(title: string): string {
  return title
    .trim()
    // Remove common punctuation variations
    .replace(/[–—]/g, '-')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove trailing punctuation
    .replace(/[:\-–—,;]\s*$/, '')
    .trim()
}

/**
 * Extract series name and season info from anime title
 * Enhanced with better pattern matching and edge case handling
 */
export function extractSeriesInfo(title: string, titleEnglish?: string | null): {
  seriesName: string
  seasonNumber: number
  seasonName: string
  isSequel: boolean
} {
  const workingTitle = normalizeTitle(titleEnglish || title)
  
  // Special handling for common patterns before season detection
  
  // Pattern 1: "X of Y" (e.g., "Rascal Does Not Dream of...")
  // But exclude if it's part of a season indicator
  const ofPattern = /^(.+\s+of)\s+(.+)$/i
  const ofMatch = workingTitle.match(ofPattern)
  if (ofMatch && ofMatch[1] && !ofMatch[2].match(/Season|Part|Final|Arc|\d/i)) {
    const baseSeriesName = ofMatch[1].trim()
    const subtitle = ofMatch[2].trim()
    return {
      seriesName: baseSeriesName,
      seasonNumber: 1, // Will be sorted by year
      seasonName: subtitle || 'Season 1',
      isSequel: false
    }
  }
  
  // Pattern 2: "X in Y" (e.g., "Alya Sometimes Hides Her Feelings in Russian")
  // But exclude if it's part of a season indicator
  const inPattern = /^(.+\s+in)\s+(.+)$/i
  const inMatch = workingTitle.match(inPattern)
  if (inMatch && inMatch[1] && !inMatch[2].match(/Season|Part|Final|Arc|\d/i)) {
    const baseSeriesName = inMatch[1].trim()
    const subtitle = inMatch[2].trim()
    return {
      seriesName: baseSeriesName,
      seasonNumber: 1,
      seasonName: subtitle || 'Season 1',
      isSequel: false
    }
  }
  
  // Pattern 3: Very long titles with subtitles (likely different entries in same franchise)
  // E.g., "TONIKAWA: Over the Moon for You" vs "TONIKAWA: Fly Me to the Moon"
  const colonPattern = /^([^:]+):\s*(.+)$/
  const colonMatch = workingTitle.match(colonPattern)
  if (colonMatch && colonMatch[1]) {
    const baseTitle = colonMatch[1].trim()
    // Only use this if the base title is short enough (likely a series name)
    // and doesn't contain season indicators
    if (baseTitle.length <= 40 && !baseTitle.match(/Season|Part|Final|Arc|\d/i)) {
      const subtitle = colonMatch[2].trim()
      return {
        seriesName: baseTitle,
        seasonNumber: 1,
        seasonName: subtitle || 'Season 1',
        isSequel: false
      }
    }
  }
  
  // Comprehensive patterns to detect seasons - order matters!
  // More specific patterns first, then general ones
  const patterns = [
    // Final/Last seasons (highest priority)
    { 
      regex: /:\s*Final\s+Season\s*(?:Part\s*(\d+))?/i, 
      number: (m: RegExpMatchArray) => m[1] ? parseInt(m[1]) + 3 : 4, 
      name: (m: RegExpMatchArray) => m[1] ? `Final Season Part ${m[1]}` : 'Final Season' 
    },
    { regex: /:\s*Last\s+Season/i, number: 5, name: 'Last Season' },
    { regex: /:\s*The\s+Final/i, number: 5, name: 'The Final' },
    { regex: /\s+Final\s+Season/i, number: 4, name: 'Final Season' },
    
    // Season patterns (explicit)
    { 
      regex: /:\s*Season\s*(\d+)/i, 
      number: (m: RegExpMatchArray) => parseInt(m[1] || '1'), 
      name: (m: RegExpMatchArray) => `Season ${m[1] || '1'}` 
    },
    { 
      regex: /\s+Season\s*(\d+)/i, 
      number: (m: RegExpMatchArray) => parseInt(m[1] || '1'), 
      name: (m: RegExpMatchArray) => `Season ${m[1] || '1'}` 
    },
    { 
      regex: /:\s*(\d+)(?:st|nd|rd|th)\s+Season/i, 
      number: (m: RegExpMatchArray) => parseInt(m[1] || '1'), 
      name: (m: RegExpMatchArray) => `Season ${m[1] || '1'}` 
    },
    { 
      regex: /\sS(\d+)(?:\s|$|:)/i, 
      number: (m: RegExpMatchArray) => parseInt(m[1] || '1'), 
      name: (m: RegExpMatchArray) => `Season ${m[1] || '1'}` 
    },
    
    // Part patterns
    { 
      regex: /:\s*Part\s*(\d+)/i, 
      number: (m: RegExpMatchArray) => parseInt(m[1] || '1'), 
      name: (m: RegExpMatchArray) => `Part ${m[1] || '1'}` 
    },
    { 
      regex: /\s+Part\s*(\d+)/i, 
      number: (m: RegExpMatchArray) => parseInt(m[1] || '1'), 
      name: (m: RegExpMatchArray) => `Part ${m[1] || '1'}` 
    },
    { 
      regex: /:\s*(\d+)(?:st|nd|rd|th)\s+Part/i, 
      number: (m: RegExpMatchArray) => parseInt(m[1] || '1'), 
      name: (m: RegExpMatchArray) => `Part ${m[1] || '1'}` 
    },
    
    // Cour patterns
    { 
      regex: /:\s*Cour\s*(\d+)/i, 
      number: (m: RegExpMatchArray) => parseInt(m[1] || '1'), 
      name: (m: RegExpMatchArray) => `Cour ${m[1] || '1'}` 
    },
    { regex: /:\s*2nd\s+Cour/i, number: 2, name: '2nd Cour' },
    { regex: /\s+2nd\s+Cour/i, number: 2, name: '2nd Cour' },
    
    // Arc patterns
    { 
      regex: /:\s*([\w\s]+)\s+Arc$/i, 
      number: 2, 
      name: (m: RegExpMatchArray) => `${(m[1] || '').trim()} Arc` 
    },
    
    // Roman numerals (must be at the end or before subtitle)
    { regex: /\s+II(?:\s|:|$)/i, number: 2, name: 'Season 2' },
    { regex: /\s+III(?:\s|:|$)/i, number: 3, name: 'Season 3' },
    { regex: /\s+IV(?:\s|:|$)/i, number: 4, name: 'Season 4' },
    { regex: /\s+V(?:\s|:|$)/i, number: 5, name: 'Season 5' },
    { regex: /:\s*II$/i, number: 2, name: 'Season 2' },
    { regex: /:\s*III$/i, number: 3, name: 'Season 3' },
    { regex: /:\s*IV$/i, number: 4, name: 'Season 4' },
    { regex: /:\s*V$/i, number: 5, name: 'Season 5' },
    
    // Numbers at the end (with caution - must have separator)
    // Only match if it's a reasonable season number (1-20)
    { 
      regex: /:\s*(\d{1,2})$/i, 
      number: (m: RegExpMatchArray) => {
        const num = parseInt(m[1] || '1')
        return num >= 1 && num <= 20 ? num : 1
      }, 
      name: (m: RegExpMatchArray) => {
        const num = parseInt(m[1] || '1')
        return num >= 1 && num <= 20 ? `Season ${num}` : 'Season 1'
      }
    },
    { 
      regex: /\s+(\d{1,2})$/i, 
      number: (m: RegExpMatchArray) => {
        const num = parseInt(m[1] || '1')
        return num >= 1 && num <= 20 ? num : 1
      }, 
      name: (m: RegExpMatchArray) => {
        const num = parseInt(m[1] || '1')
        return num >= 1 && num <= 20 ? `Season ${num}` : 'Season 1'
      }
    },
    
    // Sequel indicators
    { regex: /:\s*2nd\s+/i, number: 2, name: '2nd Season' },
    { regex: /:\s*3rd\s+/i, number: 3, name: '3rd Season' },
    { regex: /:\s*4th\s+/i, number: 4, name: '4th Season' },
    { regex: /\s+2nd\s+/i, number: 2, name: '2nd Season' },
    { regex: /\s+3rd\s+/i, number: 3, name: '3rd Season' },
    { regex: /\s+4th\s+/i, number: 4, name: '4th Season' },
  ]
  
  for (const pattern of patterns) {
    const match = workingTitle.match(pattern.regex)
    if (match) {
      const seasonNumber = typeof pattern.number === 'function' ? pattern.number(match) : pattern.number
      let seriesName = workingTitle.replace(pattern.regex, '').trim()
      
      // Clean up series name - remove trailing punctuation
      seriesName = normalizeTitle(seriesName)
      
      const seasonName = typeof pattern.name === 'function' ? pattern.name(match) : pattern.name
      
      return {
        seriesName,
        seasonNumber,
        seasonName,
        isSequel: true
      }
    }
  }
  
  // No season detected - it's season 1 or standalone
  return {
    seriesName: workingTitle,
    seasonNumber: 1,
    seasonName: 'Season 1',
    isSequel: false
  }
}

/**
 * Calculate similarity score between two series names
 * Returns a score between 0 and 1, where 1 is exact match
 */
function calculateSeriesSimilarity(name1: string, name2: string): number {
  const normalize = (s: string) => s
    .replace(/\b(The|A|An)\b/gi, '')
    .trim()
    .toLowerCase()
    .replace(/[:\-–—,;]/g, '')
    .replace(/\s+/g, ' ')
  
  const n1 = normalize(name1)
  const n2 = normalize(name2)
  
  if (n1 === n2) return 1.0
  
  // Check if one contains the other (partial match)
  if (n1.includes(n2) || n2.includes(n1)) {
    const shorter = Math.min(n1.length, n2.length)
    const longer = Math.max(n1.length, n2.length)
    return shorter / longer
  }
  
  // Simple word overlap
  const words1 = new Set(n1.split(/\s+/))
  const words2 = new Set(n2.split(/\s+/))
  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])
  
  return intersection.size / union.size
}

/**
 * Group anime by series name with confidence scoring and validation
 */
export function groupAnimeBySeriesName(anime: any[]): Map<string, any[]> {
  const seriesMap = new Map<string, any[]>()
  const normalizedMap = new Map<string, string>() // normalized -> original
  
  for (const item of anime) {
    const { seriesName } = extractSeriesInfo(item.title, item.titleEnglish)
    
    // Normalize for matching (remove articles, lowercase)
    const normalized = seriesName
      .replace(/\b(The|A|An)\b/gi, '')
      .trim()
      .toLowerCase()
      .replace(/[:\-–—,;]/g, '')
      .replace(/\s+/g, ' ')
    
    // Check for similar existing series names (fuzzy matching)
    let matchedKey: string | null = null
    let bestSimilarity = 0.8 // Minimum similarity threshold
    
    for (const [existingNormalized, originalName] of normalizedMap.entries()) {
      const similarity = calculateSeriesSimilarity(normalized, existingNormalized)
      if (similarity >= bestSimilarity && similarity > 0.8) {
        bestSimilarity = similarity
        matchedKey = originalName
      }
    }
    
    // Use matched key or create new entry
    const key = matchedKey || seriesName
    
    if (!seriesMap.has(key)) {
      seriesMap.set(key, [])
      normalizedMap.set(normalized, key)
    }
    
    seriesMap.get(key)!.push({
      ...item,
      _seriesName: seriesName,
      _confidence: matchedKey ? 'medium' : 'high'
    })
  }
  
  return seriesMap
}

/**
 * Create series entries from grouped anime
 */
export function createSeriesEntries(anime: any[]): any[] {
  const seriesMap = groupAnimeBySeriesName(anime)
  const seriesEntries: any[] = []
  
  for (const [seriesName, seasons] of seriesMap.entries()) {
    // Sort seasons by year and season number
    const sortedSeasons = seasons.sort((a, b) => {
      const aInfo = extractSeriesInfo(a.title, a.titleEnglish)
      const bInfo = extractSeriesInfo(b.title, b.titleEnglish)
      
      // First sort by year
      if (a.year && b.year && a.year !== b.year) {
        return a.year - b.year
      }
      
      // Then by season number
      return aInfo.seasonNumber - bInfo.seasonNumber
    })
    
    // Use first season as the main entry
    const mainSeason = sortedSeasons[0]
    
    seriesEntries.push({
      ...mainSeason,
      // Override with series name instead of season-specific name
      displayTitle: seriesName,
      seasonCount: sortedSeasons.length,
      seasons: sortedSeasons.map((s, _index) => {
        const info = extractSeriesInfo(s.title, s.titleEnglish)
        return {
          seasonNumber: info.seasonNumber,
          seasonName: info.seasonName,
          animeId: s.id,
          slug: s.slug,
          title: s.title,
          titleEnglish: s.titleEnglish,
          year: s.year,
          episodes: s.episodes,
          coverImage: s.coverImage,
          averageRating: s.averageRating || s.rating
        }
      }),
      // Use highest rated season's rating
      rating: Math.max(...sortedSeasons.map(s => s.averageRating || s.rating || 0)),
      // Use total episodes across all seasons
      totalEpisodes: sortedSeasons.reduce((sum, s) => sum + (s.episodes || 0), 0)
    })
  }
  
  return seriesEntries
}

/**
 * Get seasons from RelatedAnime database relationships
 * This is the primary source of truth for season relationships
 */
export async function getSeasonsFromRelationships(animeId: string): Promise<SeasonInfo[]> {
  // Relation types that indicate seasons/sequels
  const seasonRelationTypes = ['Sequel', 'Prequel', 'Alternative version']
  
  // Get all related anime (both directions)
  const relatedAnime = await db.relatedAnime.findMany({
    where: {
      OR: [
        { animeId, relation: { in: seasonRelationTypes } },
        { relatedId: animeId, relation: { in: seasonRelationTypes } }
      ]
    },
    include: {
      anime: {
        select: {
          id: true,
          slug: true,
          title: true,
          titleEnglish: true,
          year: true,
          type: true,
          episodes: true,
          coverImage: true,
          averageRating: true,
          status: true,
          startDate: true
        }
      },
      related: {
        select: {
          id: true,
          slug: true,
          title: true,
          titleEnglish: true,
          year: true,
          type: true,
          episodes: true,
          coverImage: true,
          averageRating: true,
          status: true,
          startDate: true
        }
      }
    }
  })

  const seasons: SeasonInfo[] = []
  const seenIds = new Set<string>([animeId])

  // Process relationships
  for (const rel of relatedAnime) {
    const relatedAnimeData = rel.animeId === animeId ? rel.related : rel.anime
    const relationType = rel.relation

    if (seenIds.has(relatedAnimeData.id)) continue
    seenIds.add(relatedAnimeData.id)

    // Extract season info from title
    const seasonInfo = extractSeriesInfo(relatedAnimeData.title, relatedAnimeData.titleEnglish)

    seasons.push({
      animeId: relatedAnimeData.id,
      slug: relatedAnimeData.slug,
      title: relatedAnimeData.title,
      titleEnglish: relatedAnimeData.titleEnglish,
      year: relatedAnimeData.year,
      type: relatedAnimeData.type,
      episodes: relatedAnimeData.episodes,
      coverImage: relatedAnimeData.coverImage,
      averageRating: relatedAnimeData.averageRating,
      status: relatedAnimeData.status,
      startDate: relatedAnimeData.startDate,
      seasonNumber: seasonInfo.seasonNumber,
      seasonName: seasonInfo.seasonName
    })
  }

  return seasons
}

/**
 * Build a complete season graph by traversing relationships bidirectionally
 * Finds all connected anime in the relationship chain
 */
export async function buildSeasonGraph(animeId: string): Promise<SeasonInfo[]> {
  const visited = new Set<string>()
  const seasons: SeasonInfo[] = []
  const queue: string[] = [animeId]

  // Get the initial anime
  const initialAnime = await db.anime.findUnique({
    where: { id: animeId },
    select: {
      id: true,
      slug: true,
      title: true,
      titleEnglish: true,
      year: true,
      type: true,
      episodes: true,
      coverImage: true,
      averageRating: true,
      status: true,
      startDate: true
    }
  })

  if (!initialAnime) return []

  // Add initial anime to seasons
  const initialSeasonInfo = extractSeriesInfo(initialAnime.title, initialAnime.titleEnglish)
  seasons.push({
    animeId: initialAnime.id,
    slug: initialAnime.slug,
    title: initialAnime.title,
    titleEnglish: initialAnime.titleEnglish,
    year: initialAnime.year,
    type: initialAnime.type,
    episodes: initialAnime.episodes,
    coverImage: initialAnime.coverImage,
    averageRating: initialAnime.averageRating,
    status: initialAnime.status,
    startDate: initialAnime.startDate,
    seasonNumber: initialSeasonInfo.seasonNumber,
    seasonName: initialSeasonInfo.seasonName
  })
  visited.add(animeId)

  // BFS traversal of relationships
  while (queue.length > 0) {
    const currentId = queue.shift()!
    if (visited.has(currentId)) continue
    visited.add(currentId)

    // Get all related anime
    const relationships = await db.relatedAnime.findMany({
      where: {
        OR: [
          { animeId: currentId },
          { relatedId: currentId }
        ],
        relation: { in: ['Sequel', 'Prequel', 'Alternative version'] }
      },
      include: {
        anime: {
          select: {
            id: true,
            slug: true,
            title: true,
            titleEnglish: true,
            year: true,
            type: true,
            episodes: true,
            coverImage: true,
            averageRating: true,
            status: true,
            startDate: true
          }
        },
        related: {
          select: {
            id: true,
            slug: true,
            title: true,
            titleEnglish: true,
            year: true,
            type: true,
            episodes: true,
            coverImage: true,
            averageRating: true,
            status: true,
            startDate: true
          }
        }
      }
    })

    for (const rel of relationships) {
      const relatedAnimeData = rel.animeId === currentId ? rel.related : rel.anime
      
      if (visited.has(relatedAnimeData.id)) continue

      const seasonInfo = extractSeriesInfo(relatedAnimeData.title, relatedAnimeData.titleEnglish)
      
      seasons.push({
        animeId: relatedAnimeData.id,
        slug: relatedAnimeData.slug,
        title: relatedAnimeData.title,
        titleEnglish: relatedAnimeData.titleEnglish,
        year: relatedAnimeData.year,
        type: relatedAnimeData.type,
        episodes: relatedAnimeData.episodes,
        coverImage: relatedAnimeData.coverImage,
        averageRating: relatedAnimeData.averageRating,
        status: relatedAnimeData.status,
        startDate: relatedAnimeData.startDate,
        seasonNumber: seasonInfo.seasonNumber,
        seasonName: seasonInfo.seasonName
      })

      queue.push(relatedAnimeData.id)
    }
  }

  return seasons
}

/**
 * Validate and ensure correct chronological ordering of seasons
 */
export function validateSeasonOrder(seasons: SeasonInfo[]): SeasonInfo[] {
  if (seasons.length <= 1) return seasons

  // Sort by multiple criteria (most reliable first)
  const sorted = [...seasons].sort((a, b) => {
    // 1. Start date (most reliable)
    if (a.startDate && b.startDate) {
      const dateDiff = a.startDate.getTime() - b.startDate.getTime()
      if (dateDiff !== 0) return dateDiff
    }

    // 2. Year + season
    if (a.year && b.year) {
      const yearDiff = a.year - b.year
      if (yearDiff !== 0) return yearDiff
    }

    // 3. Season number from title parsing
    const seasonDiff = a.seasonNumber - b.seasonNumber
    if (seasonDiff !== 0) return seasonDiff

    // 4. Episodes (later seasons often have more episodes if it's a long-running series)
    if (a.episodes && b.episodes) {
      return a.episodes - b.episodes
    }

    return 0
  })

  // Validate ordering makes sense
  // Check for large gaps that might indicate missing seasons
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]

    // If season numbers jump by more than 1, might be missing seasons
    if (curr.seasonNumber - prev.seasonNumber > 2) {
      // This is okay, might be intentional gaps
      continue
    }
  }

  return sorted
}

/**
 * Merge seasons from database relationships and title-based matching
 * Database relationships have higher confidence
 */
export function mergeSeasonsFromSources(
  dbSeasons: SeasonInfo[],
  titleSeasons: SeasonInfo[]
): SeasonWithConfidence[] {
  const merged = new Map<string, SeasonWithConfidence>()
  
  // Add database seasons first (high confidence)
  for (const season of dbSeasons) {
    merged.set(season.animeId, {
      ...season,
      confidence: 'high',
      source: 'database'
    })
  }

  // Add title-based seasons (lower confidence, skip if already in database)
  for (const season of titleSeasons) {
    if (!merged.has(season.animeId)) {
      merged.set(season.animeId, {
        ...season,
        confidence: 'medium',
        source: 'title'
      })
    }
  }

  return Array.from(merged.values())
}

