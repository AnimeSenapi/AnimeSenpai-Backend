/**
 * Series Grouping Utility
 * Groups anime seasons/sequels into series like Crunchyroll
 */

export interface SeasonInfo {
  seasonNumber: number
  seasonName: string
  animeId: string
  title: string
  titleEnglish?: string | null
  year?: number | null
  episodes?: number | null
}

/**
 * Extract series name and season info from anime title
 */
export function extractSeriesInfo(title: string, titleEnglish?: string | null): {
  seriesName: string
  seasonNumber: number
  seasonName: string
  isSequel: boolean
} {
  const workingTitle = titleEnglish || title
  
  // Special handling for common patterns before season detection
  
  // Pattern 1: "X of Y" (e.g., "Rascal Does Not Dream of...")
  const ofPattern = /^(.+\s+of)\s+.+$/i
  const ofMatch = workingTitle.match(ofPattern)
  if (ofMatch) {
    const baseSeriesName = ofMatch[1].trim()
    const subtitle = workingTitle.replace(ofMatch[1], '').trim()
    return {
      seriesName: baseSeriesName,
      seasonNumber: 1, // Will be sorted by year
      seasonName: subtitle || 'Season 1',
      isSequel: false
    }
  }
  
  // Pattern 2: "X in Y" (e.g., "Alya Sometimes Hides Her Feelings in Russian")
  const inPattern = /^(.+\s+in)\s+.+$/i
  const inMatch = workingTitle.match(inPattern)
  if (inMatch) {
    const baseSeriesName = inMatch[1].trim()
    const subtitle = workingTitle.replace(inMatch[1], '').trim()
    return {
      seriesName: baseSeriesName,
      seasonNumber: 1,
      seasonName: subtitle || 'Season 1',
      isSequel: false
    }
  }
  
  // Pattern 3: Very long titles with subtitles (likely different entries in same franchise)
  // E.g., "TONIKAWA: Over the Moon for You" vs "TONIKAWA: Fly Me to the Moon"
  const colonPattern = /^([^:]+):\s*.+$/
  const colonMatch = workingTitle.match(colonPattern)
  if (colonMatch) {
    const baseTitle = colonMatch[1].trim()
    // Only use this if the base title is short enough (likely a series name)
    if (baseTitle.length <= 40 && !baseTitle.match(/Season|Part|Final|Arc/i)) {
      const subtitle = workingTitle.replace(colonMatch[1] + ':', '').trim()
      return {
        seriesName: baseTitle,
        seasonNumber: 1,
        seasonName: subtitle || 'Season 1',
        isSequel: false
      }
    }
  }
  
  // Comprehensive patterns to detect seasons - order matters!
  const patterns = [
    // Final/Last seasons
    { regex: /:\s*Final Season\s*(?:Part\s*(\d+))?/i, number: (m: RegExpMatchArray) => m[1] ? parseInt(m[1]) + 3 : 4, name: (m: RegExpMatchArray) => m[1] ? `Final Season Part ${m[1]}` : 'Final Season' },
    { regex: /:\s*Last Season/i, number: 5, name: 'Last Season' },
    { regex: /:\s*The Final/i, number: 5, name: 'The Final' },
    
    // Season patterns
    { regex: /:\s*Season\s*(\d+)/i, number: (m: RegExpMatchArray) => parseInt(m[1]), name: (m: RegExpMatchArray) => `Season ${m[1]}` },
    { regex: /:\s*(\d+)(?:st|nd|rd|th)\s*Season/i, number: (m: RegExpMatchArray) => parseInt(m[1]), name: (m: RegExpMatchArray) => `Season ${m[1]}` },
    { regex: /\sS(\d+)/i, number: (m: RegExpMatchArray) => parseInt(m[1]), name: (m: RegExpMatchArray) => `Season ${m[1]}` },
    
    // Part patterns
    { regex: /:\s*Part\s*(\d+)/i, number: (m: RegExpMatchArray) => parseInt(m[1]), name: (m: RegExpMatchArray) => `Part ${m[1]}` },
    { regex: /:\s*(\d+)(?:st|nd|rd|th)\s*Part/i, number: (m: RegExpMatchArray) => parseInt(m[1]), name: (m: RegExpMatchArray) => `Part ${m[1]}` },
    
    // Cour patterns
    { regex: /:\s*Cour\s*(\d+)/i, number: (m: RegExpMatchArray) => parseInt(m[1]), name: (m: RegExpMatchArray) => `Cour ${m[1]}` },
    { regex: /:\s*2nd\s*Cour/i, number: 2, name: '2nd Cour' },
    
    // Arc patterns
    { regex: /:\s*([\w\s]+)\s*Arc$/i, number: 2, name: (m: RegExpMatchArray) => `${m[1]} Arc` },
    
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
    { regex: /:\s*(\d+)$/i, number: (m: RegExpMatchArray) => parseInt(m[1]), name: (m: RegExpMatchArray) => `Season ${m[1]}` },
    { regex: /\s+(\d+)$/i, number: (m: RegExpMatchArray) => parseInt(m[1]), name: (m: RegExpMatchArray) => `Season ${m[1]}` },
    
    // Sequel indicators
    { regex: /:\s*2nd\s*/i, number: 2, name: '2nd Season' },
    { regex: /:\s*3rd\s*/i, number: 3, name: '3rd Season' },
    { regex: /:\s*4th\s*/i, number: 4, name: '4th Season' },
  ]
  
  for (const pattern of patterns) {
    const match = workingTitle.match(pattern.regex)
    if (match) {
      const seasonNumber = typeof pattern.number === 'function' ? pattern.number(match) : pattern.number
      let seriesName = workingTitle.replace(pattern.regex, '').trim()
      
      // Clean up series name - remove trailing punctuation
      seriesName = seriesName.replace(/[:\-–—,;]\s*$/, '').trim()
      
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
 * Group anime by series name
 */
export function groupAnimeBySeriesName(anime: any[]): Map<string, any[]> {
  const seriesMap = new Map<string, any[]>()
  
  for (const item of anime) {
    const { seriesName } = extractSeriesInfo(item.title, item.titleEnglish)
    
    if (!seriesMap.has(seriesName)) {
      seriesMap.set(seriesName, [])
    }
    seriesMap.get(seriesName)!.push(item)
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
      seasons: sortedSeasons.map((s, index) => {
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

