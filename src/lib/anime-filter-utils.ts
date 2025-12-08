/**
 * Shared Anime Filter Utilities
 * 
 * Provides consistent filtering logic for both full and partial Jikan anime data.
 * Used by both anime-sync.ts and calendar-sync.ts to ensure unified filtering.
 */

import { ANIME_FILTERS } from '../types/anime-filters'

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
 */
export function shouldFilterAnimeFromJikanData(anime: JikanAnimePartial): boolean {
  // Check excluded ratings
  if (anime.rating) {
    const ratingLower = anime.rating.toLowerCase()
    for (const excludedRating of ANIME_FILTERS.excludedRatings) {
      if (ratingLower.includes(excludedRating.toLowerCase()) || ratingLower.startsWith(excludedRating.toLowerCase())) {
        return true
      }
    }
  }

  // Check excluded genres
  if (anime.genres && anime.genres.length > 0) {
    for (const genre of anime.genres) {
      for (const excludedGenre of ANIME_FILTERS.excludedGenres) {
        if (genre.name.toLowerCase() === excludedGenre.toLowerCase()) {
          return true
        }
      }
    }
  }

  // Check excluded demographics
  if (anime.demographics && anime.demographics.length > 0) {
    for (const demo of anime.demographics) {
      for (const excludedDemo of ANIME_FILTERS.excludedDemographics) {
        if (demo.name.toLowerCase() === excludedDemo.toLowerCase()) {
          return true
        }
      }
    }
  }

  // Check excluded themes
  if (anime.themes && anime.themes.length > 0) {
    for (const theme of anime.themes) {
      for (const excludedTheme of ANIME_FILTERS.excludedThemes) {
        if (theme.name.toLowerCase() === excludedTheme.toLowerCase()) {
          return true
        }
      }
    }
  }

  // Check excluded types
  if (ANIME_FILTERS.excludedTypes && anime.type) {
    for (const excludedType of ANIME_FILTERS.excludedTypes) {
      if (anime.type.toLowerCase() === excludedType.toLowerCase()) {
        return true
      }
    }
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
 */
export function shouldFilterAnimeFromJikanFull(anime: JikanAnimeFull): boolean {
  // Check excluded ratings
  if (anime.rating) {
    const ratingLower = anime.rating.toLowerCase()
    for (const excludedRating of ANIME_FILTERS.excludedRatings) {
      if (ratingLower.includes(excludedRating.toLowerCase()) || ratingLower.startsWith(excludedRating.toLowerCase())) {
        return true
      }
    }
  }

  // Check excluded genres
  if (anime.genres && anime.genres.length > 0) {
    for (const genre of anime.genres) {
      for (const excludedGenre of ANIME_FILTERS.excludedGenres) {
        if (genre.name.toLowerCase() === excludedGenre.toLowerCase()) {
          return true
        }
      }
    }
  }

  // Check excluded demographics
  if (anime.demographics && anime.demographics.length > 0) {
    for (const demo of anime.demographics) {
      for (const excludedDemo of ANIME_FILTERS.excludedDemographics) {
        if (demo.name.toLowerCase() === excludedDemo.toLowerCase()) {
          return true
        }
      }
    }
  }

  // Check excluded themes
  if (anime.themes && anime.themes.length > 0) {
    for (const theme of anime.themes) {
      for (const excludedTheme of ANIME_FILTERS.excludedThemes) {
        if (theme.name.toLowerCase() === excludedTheme.toLowerCase()) {
          return true
        }
      }
    }
  }

  // Check excluded types
  if (ANIME_FILTERS.excludedTypes && anime.type) {
    for (const excludedType of ANIME_FILTERS.excludedTypes) {
      if (anime.type.toLowerCase() === excludedType.toLowerCase()) {
        return true
      }
    }
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

