import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import { cache, cacheKeys, cacheTTL } from '../lib/cache'

export const animeRouter = router({
  // Get all anime with pagination and filters
  getAll: publicProcedure
    .query(async () => {
      const page = 1
      const limit = 20
      const search = undefined
      const genre = undefined
      const status = undefined
      const year = undefined
      const sortBy = 'averageRating'
      const sortOrder = 'desc'
      const skip = (page - 1) * limit

      const where: any = {}

      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { studio: { contains: search, mode: 'insensitive' } }
        ]
      }

      if (genre) {
        where.genres = {
          some: {
            genre: {
              slug: genre
            }
          }
        }
      }

      if (status) {
        where.status = status
      }

      if (year) {
        where.year = year
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
          genres: item.genres.map(g => g.genre),
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

  // Get anime by slug
  getBySlug: publicProcedure
    .input(z.object({
      slug: z.string()
    }).optional())
    .query(async ({ input = { slug: 'attack-on-titan' } }) => {
      const anime = await db.anime.findUnique({
        where: { slug: input.slug },
        select: {
          id: true,
          slug: true,
          title: true,
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
        description: anime.description,
        year: anime.year,
        rating: anime.rating,
        status: anime.status,
        type: anime.type,
        episodes: anime.episodes,
        duration: anime.duration,
        season: anime.season,
        coverImage: anime.coverImage,
        bannerImage: anime.bannerImage,
        trailerUrl: anime.trailerUrl,
        genres: anime.genres.map(g => g.genre),
        stats: {
          viewCount: anime.viewCount,
          ratingCount: anime.ratingCount,
          averageRating: anime.averageRating
        }
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
        take: limit,
        orderBy: [
          { viewCount: 'desc' },
          { averageRating: 'desc' }
        ],
        select: {
          id: true,
          slug: true,
          title: true,
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
            genres: item.genres.map(g => g.genre),
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
