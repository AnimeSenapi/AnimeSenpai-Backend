/**
 * Shared Anime Filter Utilities
 * 
 * Provides consistent filtering logic for both full and partial Jikan anime data.
 * Used by both anime-sync.ts and calendar-sync.ts to ensure unified filtering.
 */

import { ANIME_FILTERS } from '../types/anime-filters'

// Pre-compute lowercase sets for O(1) lookups (performance optimization)
const EXCLUDED_GENRES_SET = new Set(ANIME_FILTERS.excludedGenres.map(g => g.toLowerCase()))
const EXCLUDED_RATINGS_SET = new Set(ANIME_FILTERS.excludedRatings.map(r => r.toLowerCase()))
const EXCLUDED_DEMOGRAPHICS_SET = new Set(ANIME_FILTERS.excludedDemographics.map(d => d.toLowerCase()))
const EXCLUDED_THEMES_SET = new Set(ANIME_FILTERS.excludedThemes.map(t => t.toLowerCase()))
const EXCLUDED_TYPES_SET = ANIME_FILTERS.excludedTypes 
  ? new Set(ANIME_FILTERS.excludedTypes.map(t => t.toLowerCase()))
  : new Set<string>()

// Additional genre variations and synonyms for better matching
const GENRE_VARIATIONS: Record<string, string[]> = {
  'hentai': ['hentai', 'ecchi', 'erotica', 'adult'],
  'ecchi': ['ecchi', 'hentai', 'erotica'],
  'yaoi': ['yaoi', 'shounen ai', 'boys love', 'bl'],
  'yuri': ['yuri', 'shoujo ai', 'girls love', 'gl'],
  'shoujo ai': ['shoujo ai', 'yuri', 'girls love', 'gl'],
  'shounen ai': ['shounen ai', 'yaoi', 'boys love', 'bl'],
}

// Helper function to check if a string matches any variation
function matchesVariation(text: string, variations: string[]): boolean {
  const textLower = text.toLowerCase()
  return variations.some(v => textLower.includes(v.toLowerCase()) || v.toLowerCase().includes(textLower))
}

/**
 * Interface for partial Jikan anime data (from seasons/schedules endpoints)
 */
export interface JikanAnimePartial {
  mal_id: number
  title: string
  rating?: string
  genres?: Array<{
    mal_id: number
    type: string
    name: string
    url: string
  }>
  themes?: Array<{
    mal_id: number
    type: string
    name: string
    url: string
  }>
  demographics?: Array<{
    mal_id: number
    type: string
    name: string
    url: string
  }>
  type?: string
  score?: number
  popularity?: number
}

/**
 * Interface for full Jikan anime data (from /anime/{id} endpoint)
 */
export interface JikanAnimeFull {
  mal_id: number
  title: string
  title_english?: string
  title_japanese?: string
  rating?: string
  genres?: Array<{
    mal_id: number
    type: string
    name: string
    url: string
  }>
  themes?: Array<{
    mal_id: number
    type: string
    name: string
    url: string
  }>
  demographics?: Array<{
    mal_id: number
    type: string
    name: string
    url: string
  }>
  type?: string
  score?: number
  popularity?: number
}

/**
 * Check if anime should be filtered out based on partial Jikan data
 * Used for seasons/schedules endpoints that may not have all fields
 * Optimized with Set lookups for better performance
 */
export function shouldFilterAnimeFromJikanData(anime: JikanAnimePartial): boolean {
  // Filter out anime without genres or tags (incomplete data)
  const hasGenres = anime.genres && anime.genres.length > 0
  const hasThemes = anime.themes && anime.themes.length > 0
  if (!hasGenres && !hasThemes) {
    return true // Filter out anime with no genres or themes
  }

  // Check excluded ratings (with variations and partial matching)
  if (anime.rating) {
    const ratingLower = anime.rating.toLowerCase()
    // Check exact matches and partial matches
    for (const excludedRating of EXCLUDED_RATINGS_SET) {
      if (ratingLower === excludedRating || 
          ratingLower.includes(excludedRating) || 
          ratingLower.startsWith(excludedRating) ||
          excludedRating.includes(ratingLower)) {
        return true
      }
    }
  }

  // Check excluded genres (optimized with Set lookup + variations)
  if (anime.genres && anime.genres.length > 0) {
    for (const genre of anime.genres) {
      const genreNameLower = genre.name.toLowerCase()
      
      // Direct match check
      if (EXCLUDED_GENRES_SET.has(genreNameLower)) {
        return true
      }
      
      // Check for variations and synonyms
      for (const [baseGenre, variations] of Object.entries(GENRE_VARIATIONS)) {
        if (EXCLUDED_GENRES_SET.has(baseGenre) && matchesVariation(genreNameLower, variations)) {
          return true
        }
      }
    }
  }

  // Check excluded demographics (optimized with Set lookup)
  if (anime.demographics && anime.demographics.length > 0) {
    for (const demo of anime.demographics) {
      if (EXCLUDED_DEMOGRAPHICS_SET.has(demo.name.toLowerCase())) {
        return true
      }
    }
  }

  // Check excluded themes (optimized with Set lookup)
  if (anime.themes && anime.themes.length > 0) {
    for (const theme of anime.themes) {
      const themeNameLower = theme.name.toLowerCase()
      if (EXCLUDED_THEMES_SET.has(themeNameLower)) {
        return true
      }
      // Also check for partial matches (e.g., "Educational" matches "Educational Content")
      for (const excludedTheme of EXCLUDED_THEMES_SET) {
        if (themeNameLower.includes(excludedTheme) || excludedTheme.includes(themeNameLower)) {
          return true
        }
      }
    }
  }

  // Check excluded types
  if (anime.type && EXCLUDED_TYPES_SET.size > 0) {
    if (EXCLUDED_TYPES_SET.has(anime.type.toLowerCase())) {
      return true
    }
  }

  // Check additional filter options
  if (ANIME_FILTERS.excludeEcchi && anime.genres) {
    const hasEcchi = anime.genres.some(g => 
      g.name.toLowerCase().includes('ecchi') || 
      g.name.toLowerCase().includes('hentai') ||
      g.name.toLowerCase().includes('erotica')
    )
    if (hasEcchi) return true
  }

  if (ANIME_FILTERS.excludeYaoi && anime.genres) {
    const hasYaoi = anime.genres.some(g => {
      const name = g.name.toLowerCase()
      return name.includes('yaoi') || name.includes('shounen ai') || name.includes('boys love')
    })
    if (hasYaoi) return true
  }

  if (ANIME_FILTERS.excludeYuri && anime.genres) {
    const hasYuri = anime.genres.some(g => {
      const name = g.name.toLowerCase()
      return name.includes('yuri') || name.includes('shoujo ai') || name.includes('girls love')
    })
    if (hasYuri) return true
  }

  // Check minimum quality rating (if available in partial data)
  if (ANIME_FILTERS.minQualityRating && anime.score !== undefined) {
    if (anime.score < ANIME_FILTERS.minQualityRating) {
      return true
    }
  }

  // Check minimum popularity (if available in partial data)
  if (ANIME_FILTERS.minPopularity && anime.popularity !== undefined) {
    if (anime.popularity > ANIME_FILTERS.minPopularity) {
      // Note: Lower popularity number = more popular, so we check if it's greater than threshold
      return true
    }
  }

  return false
}

/**
 * Check if anime should be filtered out based on full Jikan anime data
 * Used for complete anime details from /anime/{id} endpoint
 * Optimized with Set lookups for better performance
 */
export function shouldFilterAnimeFromJikanFull(anime: JikanAnimeFull): boolean {
  // Filter out anime without genres or tags (incomplete data)
  const hasGenres = anime.genres && anime.genres.length > 0
  const hasThemes = anime.themes && anime.themes.length > 0
  if (!hasGenres && !hasThemes) {
    return true // Filter out anime with no genres or themes
  }

  // Check excluded ratings (with variations and partial matching)
  if (anime.rating) {
    const ratingLower = anime.rating.toLowerCase()
    // Check exact matches and partial matches
    for (const excludedRating of EXCLUDED_RATINGS_SET) {
      if (ratingLower === excludedRating || 
          ratingLower.includes(excludedRating) || 
          ratingLower.startsWith(excludedRating) ||
          excludedRating.includes(ratingLower)) {
        return true
      }
    }
  }

  // Check excluded genres (optimized with Set lookup + variations)
  if (anime.genres && anime.genres.length > 0) {
    for (const genre of anime.genres) {
      const genreNameLower = genre.name.toLowerCase()
      
      // Direct match check
      if (EXCLUDED_GENRES_SET.has(genreNameLower)) {
        return true
      }
      
      // Check for variations and synonyms
      for (const [baseGenre, variations] of Object.entries(GENRE_VARIATIONS)) {
        if (EXCLUDED_GENRES_SET.has(baseGenre) && matchesVariation(genreNameLower, variations)) {
          return true
        }
      }
    }
  }

  // Check excluded demographics (optimized with Set lookup)
  if (anime.demographics && anime.demographics.length > 0) {
    for (const demo of anime.demographics) {
      if (EXCLUDED_DEMOGRAPHICS_SET.has(demo.name.toLowerCase())) {
        return true
      }
    }
  }

  // Check excluded themes (optimized with Set lookup)
  if (anime.themes && anime.themes.length > 0) {
    for (const theme of anime.themes) {
      const themeNameLower = theme.name.toLowerCase()
      if (EXCLUDED_THEMES_SET.has(themeNameLower)) {
        return true
      }
      // Also check for partial matches (e.g., "Educational" matches "Educational Content")
      for (const excludedTheme of EXCLUDED_THEMES_SET) {
        if (themeNameLower.includes(excludedTheme) || excludedTheme.includes(themeNameLower)) {
          return true
        }
      }
    }
  }

  // Check excluded types
  if (anime.type && EXCLUDED_TYPES_SET.size > 0) {
    if (EXCLUDED_TYPES_SET.has(anime.type.toLowerCase())) {
      return true
    }
  }

  // Check additional filter options
  if (ANIME_FILTERS.excludeEcchi && anime.genres) {
    const hasEcchi = anime.genres.some(g => {
      const name = g.name.toLowerCase()
      return name.includes('ecchi') || name.includes('hentai') || name.includes('erotica')
    })
    if (hasEcchi) return true
  }

  if (ANIME_FILTERS.excludeYaoi && anime.genres) {
    const hasYaoi = anime.genres.some(g => {
      const name = g.name.toLowerCase()
      return name.includes('yaoi') || name.includes('shounen ai') || name.includes('boys love')
    })
    if (hasYaoi) return true
  }

  if (ANIME_FILTERS.excludeYuri && anime.genres) {
    const hasYuri = anime.genres.some(g => {
      const name = g.name.toLowerCase()
      return name.includes('yuri') || name.includes('shoujo ai') || name.includes('girls love')
    })
    if (hasYuri) return true
  }

  // Check minimum quality rating
  if (ANIME_FILTERS.minQualityRating && anime.score !== undefined) {
    if (anime.score < ANIME_FILTERS.minQualityRating) {
      return true
    }
  }

  // Check minimum popularity
  if (ANIME_FILTERS.minPopularity && anime.popularity !== undefined) {
    if (anime.popularity > ANIME_FILTERS.minPopularity) {
      // Note: Lower popularity number = more popular, so we check if it's greater than threshold
      return true
    }
  }

  return false
}

