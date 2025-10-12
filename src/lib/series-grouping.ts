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
  
  // Patterns to detect seasons
  const patterns = [
    { regex: /Season (\d+)/i, type: 'season' },
    { regex: /(\d+)(?:st|nd|rd|th) Season/i, type: 'season' },
    { regex: /Part (\d+)/i, type: 'part' },
    { regex: /(\d+)(?:st|nd|rd|th) Part/i, type: 'part' },
    { regex: /: II$/i, number: 2, type: 'roman' },
    { regex: /: III$/i, number: 3, type: 'roman' },
    { regex: /: IV$/i, number: 4, type: 'roman' },
    { regex: /: V$/i, number: 5, type: 'roman' },
    { regex: /2$/i, number: 2, type: 'number' }, // e.g., "Title 2"
    { regex: /3$/i, number: 3, type: 'number' },
  ]
  
  for (const pattern of patterns) {
    const match = workingTitle.match(pattern.regex)
    if (match) {
      const seasonNumber = pattern.number || parseInt(match[1])
      let seriesName = workingTitle.replace(pattern.regex, '').trim()
      
      // Clean up series name
      seriesName = seriesName.replace(/[:\-–—]\s*$/, '').trim()
      
      const seasonName = pattern.type === 'season' ? `Season ${seasonNumber}` :
                        pattern.type === 'part' ? `Part ${seasonNumber}` :
                        `Season ${seasonNumber}`
      
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

