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
  // Additional filter options
  excludeEcchi?: boolean
  excludeYaoi?: boolean
  excludeYuri?: boolean
  excludeShoujoAi?: boolean
  excludeShounenAi?: boolean
  // Filter options for incomplete data
  excludeWithoutGenres?: boolean // Exclude anime without any genres
  excludeWithoutTags?: boolean // Exclude anime without any tags/themes
  // Filter options for long-running children's shows
  excludeLongRunningChildrenShows?: boolean // Exclude long-running children's shows
  longRunningThresholdEpisodes?: number // Episode count threshold for long-running shows
  longRunningThresholdYears?: number // Years old threshold for long-running shows
}

/**
 * Configuration object for anime content filtering
 * Used to exclude hentai, rx-rated content, kids shows, educational content, etc.
 */
export const ANIME_FILTERS: AnimeFilters = {
  // Genres to exclude (case-insensitive matching)
  // Includes variations and related genres
  excludedGenres: [
    'Hentai',
    'Erotica',
    'Ecchi', // Suggestive content
    'Yaoi', // Boys' Love
    'Yuri', // Girls' Love
    'Shoujo Ai', // Girls' Love (alternative)
    'Shounen Ai', // Boys' Love (alternative)
  ],

  // Ratings to exclude (case-insensitive matching)
  // Includes variations and partial matches
  excludedRatings: [
    'Rx',
    'R+',
    'R18+',
    'R18',
    'Hentai',
    'Ecchi',
  ],

  // Demographics to exclude
  excludedDemographics: [
    'Kids',
    'Children',
    'Child',
    'Preschool',
    'Kodomomuke', // Children's anime demographic
  ],

  // Themes/tags to exclude
  excludedThemes: [
    'Educational',
    'Learning',
    'School',
    'Workplace',
    'Kids', // Children's content tags
    'Children', // Children's content tags
    'Preschool', // Preschool content
  ],

  // Anime types to exclude (non-anime content)
  // Only include actual anime types: TV, Movie, OVA, ONA, Special
  // Exclude: Music (music videos), Manga, etc.
  excludedTypes: [
    'Music',
    'Manga',
    'Light Novel',
    'Novel',
    'Doujin',
    'Manhua',
    'Manhwa',
  ],

  // Optional: Minimum quality thresholds (if needed)
  // minQualityRating: 6.0,
  // minPopularity: 100,

  // Additional filter options
  excludeEcchi: true,
  excludeYaoi: false, // Set to true if you want to exclude BL content
  excludeYuri: false, // Set to true if you want to exclude GL content
  excludeShoujoAi: false,
  excludeShounenAi: false,
  
  // Filter options for incomplete data
  excludeWithoutGenres: true, // Exclude anime without any genres
  excludeWithoutTags: true, // Exclude anime without any tags/themes (requires at least one)
  
  // Filter options for long-running children's shows
  excludeLongRunningChildrenShows: true, // Exclude long-running children's shows
  longRunningThresholdEpisodes: 100, // Episode count threshold for long-running shows
  longRunningThresholdYears: 5, // Years old threshold for long-running shows
}

