import { z } from 'zod'
import { router, publicProcedure } from '../lib/trpc'
import { db, getCacheStrategy } from '../lib/db'
import { Prisma } from '@prisma/client'
import { createSeriesEntries } from '../lib/series-grouping'

// Content filter to exclude adult content (Hentai, explicit material)
// Export for use in other routers (recommendations, social, etc.)
export const getContentFilter = (): Prisma.AnimeWhereInput => ({
  AND: [
    {
      NOT: {
        rating: { contains: 'Hentai', mode: Prisma.QueryMode.insensitive }
      }
    },
    {
      NOT: {
        rating: { startsWith: 'Rx', mode: Prisma.QueryMode.insensitive }
      }
    },
    {
      NOT: {
        genres: {
          some: {
            genre: {
              name: { in: ['Hentai', 'Erotica'], mode: Prisma.QueryMode.insensitive }
            }
          }
        }
      }
    }
  ]
})

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
        db.anime.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          ...getCacheStrategy(300), // 5 minutes - use Prisma Accelerate caching
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
        }),
        db.anime.count({ 
          where,
          ...getCacheStrategy(300) // 5 minutes - use Prisma Accelerate caching
        })
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
      } = await import('../lib/series-grouping')

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
