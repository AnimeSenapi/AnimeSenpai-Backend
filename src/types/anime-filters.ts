/**
 * Anime Content Filters
 * 
 * Shared filter configuration for excluding unwanted content from the database.
 * This file must be kept in sync with the frontend version.
 */

export interface AnimeFilters {
  excludedGenres: string[]
  excludedRatings: string[]
  excludedDemographics: string[]
  excludedThemes: string[]
  excludedTypes?: string[]
  minQualityRating?: number
  minPopularity?: number
}

/**
 * Configuration object for anime content filtering
 * Used to exclude hentai, rx-rated content, kids shows, educational content, etc.
 */
export const ANIME_FILTERS: AnimeFilters = {
  // Genres to exclude (case-insensitive matching)
  excludedGenres: [
    'Hentai',
    'Erotica',
  ],

  // Ratings to exclude (case-insensitive matching)
  excludedRatings: [
    'Rx',
    'Hentai',
  ],

  // Demographics to exclude
  excludedDemographics: [
    'Kids',
    'Children',
    'Child',
  ],

  // Themes/tags to exclude
  excludedThemes: [
    'Educational',
    'Learning',
  ],

  // Optional: Anime types to exclude (if needed)
  excludedTypes: [],

  // Optional: Minimum quality thresholds (if needed)
  // minQualityRating: 6.0,
  // minPopularity: 100,
}

