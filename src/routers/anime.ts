import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import { cache, cacheKeys, cacheTTL } from '../lib/cache'
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
      status: z.string().optional(),
      year: z.number().optional(),
      type: z.string().optional(),
      sortBy: z.enum(['title', 'year', 'averageRating', 'viewCount', 'createdAt']).default('averageRating'),
      sortOrder: z.enum(['asc', 'desc']).default('desc')
    }).optional())
    .query(async ({ input = {} }) => {
      const {
        page = 1,
        limit = 20,
        search,
        genre,
        status,
        year,
        type,
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

      if (status) {
        where.status = { equals: status, mode: Prisma.QueryMode.insensitive }
      }

      if (year) {
        where.year = year
      }

      if (type) {
        where.type = { equals: type, mode: Prisma.QueryMode.insensitive }
      }

      const [anime, total] = await Promise.all([
        db.anime.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
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
          }
        }),
        db.anime.count({ where })
      ])

      return {
        anime: anime.map(item => ({
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
          genres: item.genres?.map(g => g.genre) || [],
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
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        },
        take: limit,
        orderBy: [
          { averageRating: 'desc' },
          { viewCount: 'desc' }
        ],
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

      return anime.map(item => ({
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
        genres: item.genres.map(g => g.genre)
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
          slug: input.slug,
          ...getContentFilter()
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
        }
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
        where: input.animeId ? { id: input.animeId } : { slug: input.slug },
        select: {
          id: true,
          title: true,
          titleEnglish: true
        }
      })

      if (!anime) {
        return { seasons: [] }
      }

      // Extract series name
      const { extractSeriesInfo } = await import('../lib/series-grouping')
      const { seriesName } = extractSeriesInfo(anime.title, anime.titleEnglish)

      // Find all anime that belong to this series
      const relatedAnime = await db.anime.findMany({
        where: {
          OR: [
            { title: { contains: seriesName, mode: Prisma.QueryMode.insensitive } },
            { titleEnglish: { contains: seriesName, mode: Prisma.QueryMode.insensitive } }
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
          status: true
        },
        orderBy: [
          { year: 'asc' },
          { title: 'asc' }
        ]
      })

      // Format as seasons
      const seasons = relatedAnime.map((s, index) => {
        const info = extractSeriesInfo(s.title, s.titleEnglish)
        return {
          seasonNumber: info.seasonNumber,
          seasonName: info.seasonName,
          animeId: s.id,
          slug: s.slug,
          title: s.title,
          titleEnglish: s.titleEnglish,
          year: s.year,
          type: s.type,
          episodes: s.episodes,
          coverImage: s.coverImage,
          averageRating: s.averageRating,
          status: s.status
        }
      })

      return { 
        seriesName,
        seasons 
      }
    }),

  // Get trending anime (optimized with viewCount + averageRating)
  getTrending: publicProcedure
    .query(async () => {
      const limit = 10
      
      // Try to get from cache first (5 minute TTL)
      return cache.getOrSet(
        cacheKeys.trending(),
        async () => {
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
        }
      })

          return anime.map(item => ({
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
            genres: item.genres?.map((g: any) => g.genre) || [],
            stats: {
              viewCount: item.viewCount,
              ratingCount: item.ratingCount,
              averageRating: item.averageRating
            }
          }))
        },
        cacheTTL.medium // 5 minutes
      )
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
    }).optional())
    .query(async ({ input = {} }) => {
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
        orderBy: { averageRating: 'desc' },
        select: {
          id: true,
          slug: true,
          title: true,
          titleEnglish: true,
          titleJapanese: true,
          titleSynonyms: true,
          year: true,
          type: true,
          episodes: true,
          coverImage: true,
          averageRating: true,
          status: true,
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

      // Group into series
      const series = createSeriesEntries(allAnime.map(item => ({
        ...item,
        rating: item.averageRating,
        genres: item.genres?.map(g => g.genre) || []
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

      return {
        series: paginatedSeries,
        pagination: {
          page,
          limit,
          total: sortedSeries.length,
          pages: Math.ceil(sortedSeries.length / limit)
        }
      }
    }),

  // Get genres (select only needed fields) - cached for 15 minutes
  getGenres: publicProcedure
    .query(async () => {
      return cache.getOrSet(
        cacheKeys.genres(),
        async () => {
          const genres = await db.genre.findMany({
            select: {
              id: true,
              name: true,
              slug: true,
              color: true,
            },
            orderBy: {
              name: 'asc'
            }
          })

          return genres
        },
        cacheTTL.long // 15 minutes - genres rarely change
      )
    }),

})
