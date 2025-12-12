import { z } from 'zod'
import { router, publicProcedure } from '../lib/trpc.js'
import { db, getCacheStrategy, safeQuery } from '../lib/db.js'
import { Prisma } from '@prisma/client'
import { createSeriesEntries } from '../lib/series-grouping.js'
import { ANIME_FILTERS } from '../types/anime-filters.js'
import { TRPCError } from '@trpc/server'

// Configuration constants for children's show filtering
// Uses shared filter configuration where applicable
const CHILDRENS_DEMOGRAPHICS = ANIME_FILTERS.excludedDemographics
const CHILDRENS_GENRES = ['Kids', ...ANIME_FILTERS.excludedGenres.filter(g => g.toLowerCase() !== 'hentai' && g.toLowerCase() !== 'erotica')]
const CHILDRENS_RATINGS = ['G', 'PG'] // Include PG as it's often children's content (PG-13 is too broad, includes many teen shows)
const LONG_RUNNING_THRESHOLD_EPISODES = ANIME_FILTERS.longRunningThresholdEpisodes ?? 100
const LONG_RUNNING_YEARS_OLD = ANIME_FILTERS.longRunningThresholdYears ?? 5
const EDUCATIONAL_THEMES = ANIME_FILTERS.excludedThemes
// Stricter exception threshold - require BOTH high rating AND high popularity to bypass children's filter
const MIN_QUALITY_RATING_FOR_EXCEPTION = 8.0 // Raised from 7.5 - only truly exceptional anime bypass
const MIN_POPULARITY_FOR_EXCEPTION = 5000 // Require significant popularity to bypass

// Children's show filter to automatically exclude children's content, educational shows, and long-running children's series
// Uses database metadata (demographics, genres, ratings, themes) instead of hardcoded title patterns
// More sophisticated: allows exceptions for highly-rated anime and uses multiple indicators
// Export for use in other routers (calendar, recommendations, etc.)
export const getChildrensShowFilter = (): Prisma.AnimeWhereInput => {
  const fiveYearsAgo = new Date()
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - LONG_RUNNING_YEARS_OLD)

  // Build the OR conditions for children's indicators
  const childrensIndicators: Prisma.AnimeWhereInput[] = [
    // Children's demographics
    {
      demographics: {
        hasSome: CHILDRENS_DEMOGRAPHICS
      }
    },
    // Children's genres
    {
      genres: {
        some: {
          genre: {
            name: {
              in: CHILDRENS_GENRES,
              mode: Prisma.QueryMode.insensitive
            }
          }
        }
      }
    },
    // Children's ratings
    {
      rating: {
        in: CHILDRENS_RATINGS,
        mode: Prisma.QueryMode.insensitive
      }
    },
    // Educational content
    {
      OR: [
        {
          themes: {
            hasSome: EDUCATIONAL_THEMES
          }
        },
        {
          tags: {
            hasSome: EDUCATIONAL_THEMES
          }
        }
      ]
    }
  ]

  // Add long-running children's shows filter if enabled
  if (ANIME_FILTERS.excludeLongRunningChildrenShows !== false) {
    childrensIndicators.push({
      // Long-running low-quality series (high episode count + old + low rating + low popularity)
      AND: [
        { episodes: { gte: LONG_RUNNING_THRESHOLD_EPISODES } },
        { startDate: { lte: fiveYearsAgo } },
        {
          OR: [
            // Low rating
            { averageRating: { lt: 6.5 } },
            // Low popularity indicators
            {
              AND: [
                { viewCount: { lt: 500 } },
                { popularity: { lt: 500 } }
              ]
            }
          ]
        }
      ]
    })
  }

  return {
    AND: [
      // Exclude anime that match children's criteria UNLESS they're both highly rated AND very popular
      {
        NOT: {
          AND: [
            // Must match at least one children's indicator
            {
              OR: childrensIndicators
            },
            // BUT allow exception ONLY if BOTH conditions are met (stricter filtering)
            {
              NOT: {
                AND: [
                  // Must have exceptional rating
                  { averageRating: { gte: MIN_QUALITY_RATING_FOR_EXCEPTION } },
                  // AND must have significant popularity (viewCount OR popularity OR members)
                  {
                    OR: [
                      { viewCount: { gte: MIN_POPULARITY_FOR_EXCEPTION } },
                      { popularity: { gte: MIN_POPULARITY_FOR_EXCEPTION } },
                      { members: { gte: MIN_POPULARITY_FOR_EXCEPTION } }
                    ]
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  }
}

// Content filter to exclude adult content (Hentai, explicit material)
// Uses shared filter configuration from anime-filters.ts
// Export for use in other routers (recommendations, social, etc.)
export const getContentFilter = (): Prisma.AnimeWhereInput => {
  const conditions: Prisma.AnimeWhereInput[] = []

  // Exclude anime without genres (incomplete data)
  // Anime must have at least one genre to be included if excludeWithoutGenres is enabled
  if (ANIME_FILTERS.excludeWithoutGenres !== false) {
    conditions.push({
      genres: {
        some: {} // Must have at least one genre
      }
    })
  }

  // Exclude anime without tags/themes (incomplete data)
  // Anime must have at least one tag or theme if excludeWithoutTags is enabled
  if (ANIME_FILTERS.excludeWithoutTags !== false) {
    conditions.push({
      OR: [
        { themes: { isEmpty: false } }, // Has themes
        { tags: { isEmpty: false } }, // Has tags
        // If genres are allowed, they can count as tags
        ...(ANIME_FILTERS.excludeWithoutGenres === false ? [{ genres: { some: {} } }] : [])
      ]
    })
  }

  // Exclude ratings
  for (const excludedRating of ANIME_FILTERS.excludedRatings) {
    conditions.push({
      NOT: {
        rating: { contains: excludedRating, mode: Prisma.QueryMode.insensitive }
      }
    })
    // Also check for ratings that start with the excluded rating (e.g., "Rx")
    if (excludedRating.length <= 5) {
      conditions.push({
        NOT: {
          rating: { startsWith: excludedRating, mode: Prisma.QueryMode.insensitive }
        }
      })
    }
  }

  // Exclude genres
  if (ANIME_FILTERS.excludedGenres.length > 0) {
    conditions.push({
      NOT: {
        genres: {
          some: {
            genre: {
              name: { in: ANIME_FILTERS.excludedGenres, mode: Prisma.QueryMode.insensitive }
            }
          }
        }
      }
    })
  }

  // Exclude non-anime types (Music, Manga, etc.)
  if (ANIME_FILTERS.excludedTypes && ANIME_FILTERS.excludedTypes.length > 0) {
    conditions.push({
      NOT: {
        type: { in: ANIME_FILTERS.excludedTypes, mode: Prisma.QueryMode.insensitive }
      }
    })
  }

  // Include children's show filter to exclude children's content
  const childrensFilter = getChildrensShowFilter()
  const childrensFilterConditions = Array.isArray(childrensFilter.AND) ? childrensFilter.AND : []
  if (childrensFilterConditions.length > 0) {
    conditions.push(...childrensFilterConditions)
  }

  return {
    AND: conditions
  }
}
// Quality filter to exclude obscure anime that no one has heard of
// Filters out low-quality anime based on rating, popularity, and view count
// More nuanced approach: different thresholds for different eras and considers multiple quality indicators
// Also excludes children's shows and educational content via getChildrensShowFilter()
// Export for use in other routers (calendar, recommendations, etc.)
export const getQualityFilter = (): Prisma.AnimeWhereInput => {
  const childrensFilter = getChildrensShowFilter()
  const childrensFilterConditions = Array.isArray(childrensFilter.AND) ? childrensFilter.AND : []
  
  return {
    AND: [
      // Exclude children's shows and educational content
      ...childrensFilterConditions,
      // Quality requirements - must meet at least one of these
      {
        OR: [
          // Exceptionally well-rated AND popular anime (any era)
          {
            AND: [
              { averageRating: { gte: 7.5 } },
              {
                OR: [
                  { viewCount: { gte: 1500 } },
                  { popularity: { gte: 1500 } },
                  { members: { gte: 2000 } }, // Consider member count
                  { favorites: { gte: 100 } } // Consider favorites
                ]
              }
            ]
          },
          // Very popular anime (even if rating is lower)
          {
            AND: [
              {
                OR: [
                  { viewCount: { gte: 3000 } },
                  { popularity: { gte: 3000 } },
                  { members: { gte: 5000 } }
                ]
              },
              { averageRating: { gte: 6.5 } } // Still needs decent rating
            ]
          },
          // Classic anime (pre-2010) - more lenient thresholds
          {
            AND: [
              { year: { lt: 2010 } },
              {
                OR: [
                  { averageRating: { gte: 7.0 } },
                  { viewCount: { gte: 1000 } },
                  { popularity: { gte: 1000 } },
                  { members: { gte: 1500 } }
                ]
              }
            ]
          },
          // Recent anime (2010-2014) - moderate requirements
          {
            AND: [
              { year: { gte: 2010, lt: 2015 } },
              {
                OR: [
                  // High rating with some popularity
                  {
                    AND: [
                      { averageRating: { gte: 7.3 } },
                      {
                        OR: [
                          { viewCount: { gte: 1000 } },
                          { popularity: { gte: 1000 } }
                        ]
                      }
                    ]
                  },
                  // Moderate rating with high popularity
                  {
                    AND: [
                      { averageRating: { gte: 6.8 } },
                      {
                        OR: [
                          { viewCount: { gte: 2000 } },
                          { popularity: { gte: 2000 } }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          // Modern anime (2015-2019) - stricter requirements
          {
            AND: [
              { year: { gte: 2015, lt: 2020 } },
              { averageRating: { gte: 7.2 } },
              {
                OR: [
                  { viewCount: { gte: 1500 } },
                  { popularity: { gte: 1500 } },
                  { members: { gte: 2000 } }
                ]
              }
            ]
          },
          // Very recent anime (2020+) - strict quality requirements
          {
            AND: [
              { year: { gte: 2020 } },
              { averageRating: { gte: 7.0 } },
              {
                OR: [
                  { viewCount: { gte: 1200 } },
                  { popularity: { gte: 1200 } },
                  { members: { gte: 1500 } }
                ]
              }
            ]
          },
          // Highly favorited anime (indicator of quality even if other metrics are lower)
          {
            AND: [
              { favorites: { gte: 500 } },
              { averageRating: { gte: 6.8 } }
            ]
          }
        ]
      }
    ]
  }
}

export const animeRouter = router({
  // Get all anime with pagination and filters
  getAll: publicProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20), // Reduced max to prevent API size limit errors
      search: z.string().optional(),
      genre: z.string().optional(),
      genres: z.array(z.string()).optional(), // Multiple genres
      studio: z.string().optional(),
      studios: z.array(z.string()).optional(), // Multiple studios
      season: z.string().optional(),
      seasons: z.array(z.string()).optional(), // Multiple seasons
      status: z.string().optional(),
      statuses: z.array(z.string()).optional(), // Multiple statuses
      year: z.number().optional(),
      years: z.array(z.number()).optional(), // Multiple years
      type: z.string().optional(),
      types: z.array(z.string()).optional(), // Multiple types
      minRating: z.number().min(0).max(10).optional(),
      maxRating: z.number().min(0).max(10).optional(),
      sortBy: z.enum(['title', 'year', 'averageRating', 'viewCount', 'createdAt', 'episodes', 'popularity']).default('averageRating'),
      sortOrder: z.enum(['asc', 'desc']).default('desc')
    }))
    .query(async ({ input = {} }) => {
      const {
        page = 1,
        limit = 20,
        search,
        genre,
        genres,
        studio,
        studios,
        season,
        seasons,
        status,
        statuses,
        year,
        years,
        type,
        types,
        minRating,
        maxRating,
        sortBy = 'averageRating',
        sortOrder = 'desc'
      } = input
      
      const skip = (page - 1) * limit

      const where: any = {
        ...getContentFilter()
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { titleEnglish: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { titleJapanese: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: search, mode: Prisma.QueryMode.insensitive } }
        ]
      }

      // Genre filter (single or multiple)
      if (genre || (genres && genres.length > 0)) {
        const genreList = genres && genres.length > 0 ? genres : genre ? [genre] : []
        if (genreList.length > 0) {
          where.genres = {
            some: {
              genre: {
                OR: genreList.flatMap(g => [
                  { slug: { equals: g.toLowerCase(), mode: Prisma.QueryMode.insensitive } },
                  { name: { equals: g, mode: Prisma.QueryMode.insensitive } }
                ])
              }
            }
          }
        }
      }

      // Studio filter (single or multiple)
      if (studio || (studios && studios.length > 0)) {
        const studioList = studios && studios.length > 0 ? studios : studio ? [studio] : []
        if (studioList.length > 0) {
          where.studio = {
            in: studioList,
            mode: Prisma.QueryMode.insensitive
          }
        }
      }

      // Season filter (single or multiple)
      if (season || (seasons && seasons.length > 0)) {
        const seasonList = seasons && seasons.length > 0 ? seasons : season ? [season] : []
        if (seasonList.length > 0) {
          where.season = {
            in: seasonList,
            mode: Prisma.QueryMode.insensitive
          }
        }
      }

      // Status filter (single or multiple)
      if (status || (statuses && statuses.length > 0)) {
        const statusList = statuses && statuses.length > 0 ? statuses : status ? [status] : []
        if (statusList.length > 0) {
          where.status = {
            in: statusList,
            mode: Prisma.QueryMode.insensitive
          }
        }
      }

      // Year filter (single or multiple)
      if (year || (years && years.length > 0)) {
        const yearList = years && years.length > 0 ? years : year ? [year] : []
        if (yearList.length > 0) {
          where.year = {
            in: yearList
          }
        }
      }

      // Type filter (single or multiple)
      if (type || (types && types.length > 0)) {
        const typeList = types && types.length > 0 ? types : type ? [type] : []
        if (typeList.length > 0) {
          where.type = {
            in: typeList,
            mode: Prisma.QueryMode.insensitive
          }
        }
      }

      // Rating range filter
      if (minRating !== undefined || maxRating !== undefined) {
        where.averageRating = {}
        if (minRating !== undefined) {
          where.averageRating.gte = minRating
        }
        if (maxRating !== undefined) {
          where.averageRating.lte = maxRating
        }
      }

      const [anime, total] = await Promise.all([
        safeQuery((cacheStrategy) => 
          db.anime.findMany({
            where,
            skip,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
            ...cacheStrategy,
            select: {
              id: true,
              slug: true,
              title: true,
              titleEnglish: true,
              titleJapanese: true,
              titleSynonyms: true,
              year: true,
              rating: true,
              status: true,
              type: true,
              episodes: true,
              duration: true,
              season: true,
              coverImage: true,
              bannerImage: true,
              trailerUrl: true,
              viewCount: true,
              ratingCount: true,
              averageRating: true,
              genres: {
                select: {
                  genre: {
                    select: {
                      name: true,
                      slug: true,
                    }
                  }
                },
                take: 5 // Limit genres to top 5 for performance
              }
            }
          }), 300
        ),
        safeQuery((cacheStrategy) => 
          db.anime.count({ 
            where,
            ...cacheStrategy
          }), 300
        )
      ])

      const result = {
        anime: anime.map((item: typeof anime[0]) => ({
          id: item.id,
          slug: item.slug,
          title: item.title,
          titleEnglish: item.titleEnglish,
          titleJapanese: item.titleJapanese,
          titleSynonyms: item.titleSynonyms,
          year: item.year,
          rating: item.rating,
          status: item.status,
          type: item.type,
          episodes: item.episodes,
          duration: item.duration,
          season: item.season,
          coverImage: item.coverImage,
          bannerImage: item.bannerImage,
          trailerUrl: item.trailerUrl,
          genres: item.genres?.map((g: typeof item.genres[0]) => g.genre) || [],
          stats: {
            viewCount: item.viewCount,
            ratingCount: item.ratingCount,
            averageRating: item.averageRating
          }
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }

      // Result is already cached by Prisma Accelerate
      return result
    }),

  // Search anime (dedicated endpoint with better performance)
  search: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(50).default(10)
    }))
    .query(async ({ input }) => {
      const { query, limit } = input

      const anime = await db.anime.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { titleEnglish: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { titleJapanese: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { description: { contains: query, mode: Prisma.QueryMode.insensitive } }
          ]
        },
        take: limit,
        orderBy: [
          { averageRating: 'desc' },
          { viewCount: 'desc' }
        ],
        ...getCacheStrategy(180), // 3 minutes - search results change frequently
        select: {
          id: true,
          slug: true,
          title: true,
          titleEnglish: true,
          titleJapanese: true,
          coverImage: true,
          year: true,
          type: true,
          status: true,
          averageRating: true,
          genres: {
            select: {
              genre: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  color: true,
                }
              }
            }
          }
        }
      })

      return anime.map((item: typeof anime[0]) => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        titleEnglish: item.titleEnglish,
        titleJapanese: item.titleJapanese,
        coverImage: item.coverImage,
        year: item.year,
        type: item.type,
        status: item.status,
        averageRating: item.averageRating,
        genres: item.genres.map((g: typeof item.genres[0]) => g.genre)
      }))
    }),

  // Get anime by slug
  getBySlug: publicProcedure
    .input(z.object({
      slug: z.string()
    }).optional())
    .query(async ({ input = { slug: 'attack-on-titan' } }) => {
      const anime = await db.anime.findFirst({
        where: { 
          ...(input.slug ? { slug: input.slug } : {}),
          ...getContentFilter(),
        },
        select: {
          id: true,
          slug: true,
          title: true,
          titleEnglish: true,
          titleJapanese: true,
          synopsis: true,
          description: true,
          background: true,
          year: true,
          rating: true,
          status: true,
          type: true,
          source: true,
          episodes: true,
          duration: true,
          season: true,
          aired: true,
          broadcast: true,
          coverImage: true,
          bannerImage: true,
          trailer: true,
          trailerUrl: true,
          viewCount: true,
          ratingCount: true,
          averageRating: true,
          producers: true,
          licensors: true,
          studios: true,
          themes: true,
          demographics: true,
          malId: true,
          genres: {
            select: {
              genre: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  color: true,
                }
              }
            }
          }
        },
        ...getCacheStrategy(600) // 10 minutes - anime metadata doesn't change frequently
      })

      if (!anime) {
        throw new Error('Anime not found')
      }

      // Increment view count asynchronously (don't wait)
      db.anime.update({
        where: { slug: input.slug },
        data: { viewCount: { increment: 1 } }
      }).catch(() => {}) // Ignore errors

      return {
        id: anime.id,
        slug: anime.slug,
        title: anime.title,
        titleEnglish: anime.titleEnglish,
        titleJapanese: anime.titleJapanese,
        synopsis: anime.synopsis,
        description: anime.description,
        background: anime.background,
        year: anime.year,
        rating: anime.rating,
        status: anime.status,
        type: anime.type,
        source: anime.source,
        episodes: anime.episodes,
        duration: anime.duration,
        season: anime.season,
        aired: anime.aired,
        broadcast: anime.broadcast,
        coverImage: anime.coverImage,
        bannerImage: anime.bannerImage,
        trailer: anime.trailer,
        trailerUrl: anime.trailerUrl,
        producers: anime.producers,
        licensors: anime.licensors,
        studios: anime.studios,
        themes: anime.themes,
        demographics: anime.demographics,
        malId: anime.malId,
        genres: anime.genres?.map((g: any) => g.genre) || [],
        stats: {
          viewCount: anime.viewCount,
          ratingCount: anime.ratingCount,
          averageRating: anime.averageRating
        }
      }
    }),

  // Get all seasons/related anime for a series
  getSeasons: publicProcedure
    .input(z.object({
      animeId: z.string().optional(),
      slug: z.string().optional()
    }))
    .query(async ({ input }) => {
      if (!input.animeId && !input.slug) {
        throw new Error('Either animeId or slug is required')
      }

      // Get the anime first
      const anime = await db.anime.findFirst({
        where: input.animeId ? { id: input.animeId } : (input.slug ? { slug: input.slug } : {}),
        select: {
          id: true,
          title: true,
          titleEnglish: true
        },
        ...getCacheStrategy(600) // 10 minutes - basic anime info
      })

      if (!anime) {
        return { seasons: [], seriesName: '' }
      }

      // Import grouping utilities
      const { 
        extractSeriesInfo, 
        buildSeasonGraph, 
        validateSeasonOrder,
        mergeSeasonsFromSources
      } = await import('../lib/series-grouping.js')

      // PRIMARY: Try to get seasons from database relationships
      let dbSeasons = await buildSeasonGraph(anime.id)

      // FALLBACK: If database relationships are sparse, use title-based matching
      let titleSeasons: typeof dbSeasons = []
      
      if (dbSeasons.length <= 1) {
        // Extract series name for title-based fallback
        const { seriesName } = extractSeriesInfo(anime.title, anime.titleEnglish)
        const cleanSeriesName = seriesName.replace(/\b(The|A|An)\b/gi, '').trim()
        
        // Find anime with similar titles (first pass - broad search)
        const candidateAnime = await db.anime.findMany({
          where: {
            OR: [
              { title: { contains: cleanSeriesName, mode: Prisma.QueryMode.insensitive } },
              { titleEnglish: { contains: cleanSeriesName, mode: Prisma.QueryMode.insensitive } }
            ],
            ...getContentFilter()
          },
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
          },
          take: 50, // Limit to prevent performance issues
          ...getCacheStrategy(600) // 10 minutes - series relationships don't change often
        })
        
        // Filter to only exact series matches (second pass - strict filter)
        const relatedAnime = candidateAnime.filter((a: typeof candidateAnime[0]) => {
          const aInfo = extractSeriesInfo(a.title, a.titleEnglish)
          // Must have exact same series name (case-insensitive)
          const aSeriesClean = aInfo.seriesName.replace(/\b(The|A|An)\b/gi, '').trim().toLowerCase()
          const targetSeriesClean = seriesName.replace(/\b(The|A|An)\b/gi, '').trim().toLowerCase()
          return aSeriesClean === targetSeriesClean
        })

        // Convert to SeasonInfo format
        titleSeasons = relatedAnime.map((a: typeof relatedAnime[0]) => {
          const info = extractSeriesInfo(a.title, a.titleEnglish)
          return {
            animeId: a.id,
            slug: a.slug,
            title: a.title,
            titleEnglish: a.titleEnglish,
            year: a.year,
            type: a.type,
            episodes: a.episodes,
            coverImage: a.coverImage,
            averageRating: a.averageRating,
            status: a.status,
            startDate: a.startDate,
            seasonNumber: info.seasonNumber,
            seasonName: info.seasonName
          }
        })
      }

      // Merge seasons from both sources (database has priority)
      const mergedSeasons = mergeSeasonsFromSources(dbSeasons, titleSeasons)

      // Validate and sort seasons
      const validatedSeasons = validateSeasonOrder(mergedSeasons)

      // Extract series name for response
      const { seriesName } = extractSeriesInfo(anime.title, anime.titleEnglish)

      // Format as seasons (remove confidence/source metadata for API response)
      const seasons = validatedSeasons.map((s) => ({
        seasonNumber: s.seasonNumber,
        seasonName: s.seasonName,
        animeId: s.animeId,
        slug: s.slug,
        title: s.title,
        titleEnglish: s.titleEnglish,
        year: s.year,
        type: s.type,
        episodes: s.episodes,
        coverImage: s.coverImage,
        averageRating: s.averageRating,
        status: s.status
      }))

      return { 
        seriesName,
        seasons 
      }
    }),

  // Get trending anime (optimized with viewCount + averageRating)
  getTrending: publicProcedure
    .query(async () => {
      const limit = 10
      
      // Use Prisma Accelerate caching
      const anime = await db.anime.findMany({
        where: {
          ...getContentFilter()
        },
        take: limit,
        orderBy: [
          { viewCount: 'desc' },
          { averageRating: 'desc' }
        ],
        select: {
          id: true,
          slug: true,
          title: true,
          titleEnglish: true,
          titleJapanese: true,
          titleSynonyms: true,
          description: true,
          year: true,
          rating: true,
          status: true,
          type: true,
          episodes: true,
          duration: true,
          season: true,
          coverImage: true,
          bannerImage: true,
          trailerUrl: true,
          viewCount: true,
          ratingCount: true,
          averageRating: true,
          genres: {
            select: {
              genre: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  color: true,
                }
              }
            }
          }
        },
        ...getCacheStrategy(300) // 5 minutes - trending changes more frequently
      })

      return anime.map((item: typeof anime[0]) => ({
            id: item.id,
            slug: item.slug,
            title: item.title,
            titleEnglish: item.titleEnglish,
            titleJapanese: item.titleJapanese,
            titleSynonyms: item.titleSynonyms,
            description: item.description,
            year: item.year,
            rating: item.rating,
            status: item.status,
            type: item.type,
            episodes: item.episodes,
            duration: item.duration,
            season: item.season,
            coverImage: item.coverImage,
            bannerImage: item.bannerImage,
            trailerUrl: item.trailerUrl,
            genres: item.genres?.map((g: typeof item.genres[0]) => g.genre) || [],
            stats: {
              viewCount: item.viewCount,
              ratingCount: item.ratingCount,
              averageRating: item.averageRating
            }
          }))
    }),

  // Get all anime grouped by series (Crunchyroll-style)
  getAllSeries: publicProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
      search: z.string().optional(),
      genre: z.string().optional(),
      sortBy: z.enum(['rating', 'year', 'title']).default('rating'),
      sortOrder: z.enum(['asc', 'desc']).default('desc')
    }))
    .query(async ({ input }) => {
      const {
        page = 1,
        limit = 20,
        search,
        genre,
        sortBy = 'rating',
        sortOrder = 'desc'
      } = input
      
      // First, get all matching anime (not grouped yet)
      const where: any = {
        ...getContentFilter()
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { titleEnglish: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: search, mode: Prisma.QueryMode.insensitive } }
        ]
      }

      if (genre) {
        where.genres = {
          some: {
            genre: {
              OR: [
                { slug: { equals: genre.toLowerCase(), mode: Prisma.QueryMode.insensitive } },
                { name: { equals: genre, mode: Prisma.QueryMode.insensitive } }
              ]
            }
          }
        }
      }

      const allAnime = await db.anime.findMany({
        where,
        take: 500, // Reduced from 1000 for better performance
        orderBy: { averageRating: 'desc' },
        ...getCacheStrategy(600), // 10 minutes - series grouping doesn't change often
        select: {
          id: true,
          slug: true,
          title: true,
          titleEnglish: true,
          year: true,
          episodes: true,
          coverImage: true,
          averageRating: true,
          genres: {
            select: {
              genre: {
                select: {
                  id: true,
                  name: true,
                }
              }
            }
          }
        }
      })

      // Group into series
      const series = createSeriesEntries(allAnime.map((item: typeof allAnime[0]) => ({
        ...item,
        rating: item.averageRating,
        genres: item.genres?.map((g: typeof item.genres[0]) => g.genre) || []
      })))

      // Sort series
      const sortedSeries = series.sort((a, b) => {
        if (sortBy === 'rating') {
          return sortOrder === 'desc' ? (b.rating || 0) - (a.rating || 0) : (a.rating || 0) - (b.rating || 0)
        } else if (sortBy === 'year') {
          return sortOrder === 'desc' ? (b.year || 0) - (a.year || 0) : (a.year || 0) - (b.year || 0)
        } else {
          return sortOrder === 'desc' 
            ? (b.displayTitle || b.title).localeCompare(a.displayTitle || a.title)
            : (a.displayTitle || a.title).localeCompare(b.displayTitle || b.title)
        }
      })

      // Paginate
      const skip = (page - 1) * limit
      const paginatedSeries = sortedSeries.slice(skip, skip + limit)

      const result = {
        series: paginatedSeries,
        pagination: {
          page,
          limit,
          total: sortedSeries.length,
          pages: Math.ceil(sortedSeries.length / limit)
        }
      }
      
      // Result is already cached by Prisma Accelerate
      return result
    }),

  // Get genres (select only needed fields) - cached via Prisma Accelerate
  getGenres: publicProcedure
    .query(async () => {
      const genres = await db.genre.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
        },
        orderBy: {
          name: 'asc'
        },
        ...getCacheStrategy(3600) // 1 hour - genres rarely change
      })

      return genres
    }),

})
