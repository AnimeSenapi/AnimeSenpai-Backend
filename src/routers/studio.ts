/**
 * Studio Router
 * 
 * Handles studio-related operations and anime listings by studio
 */

import { z } from 'zod'
import { router, publicProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import { TRPCError } from '@trpc/server'
import { logger, extractLogContext } from '../lib/logger'
import { cache } from '../lib/cache'

export const studioRouter = router({
  /**
   * Get studio details with anime list
   */
  getStudioBySlug: publicProcedure
    .input(z.object({
      slug: z.string(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(24),
      sortBy: z.enum(['rating', 'year', 'popularity', 'title']).default('year'),
      order: z.enum(['asc', 'desc']).default('desc'),
    }))
    .query(async ({ input, ctx }) => {
      const logContext = extractLogContext(ctx.req)
      const { slug, page, limit, sortBy, order } = input
      const skip = (page - 1) * limit
      
      try {
        const cacheKey = `studio:${slug}:page:${page}:limit:${limit}:sort:${sortBy}:${order}`
        const cached = cache.get(cacheKey)
        if (cached) {
          return cached
        }
        
        // Decode slug (studios may have spaces)
        const studioName = slug.replace(/-/g, ' ')
        
        // Search for anime with this studio (case-insensitive)
        const where = {
          OR: [
            { studios: { has: studioName } },
            { studios: { has: studioName.toLowerCase() } },
            { studios: { has: studioName.toUpperCase() } },
            // Also check old studio field
            { studio: { equals: studioName, mode: 'insensitive' as const } },
          ]
        }
        
        // Build order by
        let orderBy: any = {}
        switch (sortBy) {
          case 'rating':
            orderBy = { averageRating: order }
            break
          case 'year':
            orderBy = { year: order }
            break
          case 'popularity':
            orderBy = { members: order }
            break
          case 'title':
            orderBy = { titleEnglish: order }
            break
        }
        
        const [anime, total] = await Promise.all([
          db.anime.findMany({
            where,
            skip,
            take: limit,
            orderBy,
            select: {
              id: true,
              slug: true,
              title: true,
              titleEnglish: true,
              titleJapanese: true,
              titleSynonyms: true,
              type: true,
              status: true,
              episodes: true,
              season: true,
              year: true,
              coverImage: true,
              bannerImage: true,
              synopsis: true,
              averageRating: true,
              rating: true,
              scoredBy: true,
              popularity: true,
              members: true,
              favorites: true,
              viewCount: true,
              studios: true,
              studio: true,
              producers: true,
              licensors: true,
              genres: {
                select: {
                  genre: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                    }
                  }
                }
              }
            }
          }),
          db.anime.count({ where })
        ])
        
        if (anime.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `No anime found for studio "${studioName}"`
          })
        }
        
        // Get studio info from first anime
        const studioInfo = {
          name: studioName,
          slug: slug,
          animeCount: total,
          // Get the properly cased name from the actual data
          displayName: anime[0].studios.find((s: string) => 
            s.toLowerCase() === studioName.toLowerCase()
          ) || studioName
        }
        
        const result = {
          studio: studioInfo,
          anime: anime.map(a => ({
            ...a,
            genres: a.genres.map((g: any) => g.genre)
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasMore: page * limit < total
          }
        }
        
        cache.set(cacheKey, result, 300000) // 5 minutes
        
        logger.info('Studio page loaded', logContext, {
          studio: studioName,
          animeCount: total,
          page
        })
        
        return result
        
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        
        logger.error('Failed to load studio page', error as Error, logContext, {
          slug
        })
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to load studio page'
        })
      }
    }),

  /**
   * Get all studios with anime count
   */
  getAllStudios: publicProcedure
    .input(z.object({
      search: z.string().optional(),
      minAnimeCount: z.number().min(0).default(1),
      limit: z.number().min(1).max(100).default(50),
    }).optional())
    .query(async ({ input = {}, ctx }) => {
      const logContext = extractLogContext(ctx.req)
      const { search, minAnimeCount = 1, limit = 50 } = input
      
      try {
        const cacheKey = `studios:all:search:${search || 'none'}:min:${minAnimeCount}:limit:${limit}`
        const cached = cache.get(cacheKey)
        if (cached) {
          return cached
        }
        
        // Get all unique studios from anime
        const allAnime = await db.anime.findMany({
          select: {
            studios: true,
            studio: true
          }
        })
        
        // Count occurrences of each studio
        const studioCount = new Map<string, number>()
        
        allAnime.forEach(anime => {
          // Count from studios array
          anime.studios.forEach((studio: string) => {
            if (studio) {
              const normalized = studio.trim()
              studioCount.set(normalized, (studioCount.get(normalized) || 0) + 1)
            }
          })
          
          // Also count from old studio field
          if (anime.studio) {
            const normalized = anime.studio.trim()
            studioCount.set(normalized, (studioCount.get(normalized) || 0) + 1)
          }
        })
        
        // Convert to array and filter
        let studios = Array.from(studioCount.entries())
          .filter(([_, count]) => count >= minAnimeCount)
          .map(([name, count]) => ({
            name,
            slug: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
            animeCount: count
          }))
          .sort((a, b) => b.animeCount - a.animeCount)
        
        // Apply search filter if provided
        if (search) {
          const searchLower = search.toLowerCase()
          studios = studios.filter(s => 
            s.name.toLowerCase().includes(searchLower)
          )
        }
        
        // Limit results
        studios = studios.slice(0, limit)
        
        const result = {
          studios,
          total: studios.length
        }
        
        cache.set(cacheKey, result, 600000) // 10 minutes
        
        return result
        
      } catch (error) {
        logger.error('Failed to load studios list', error as Error, logContext)
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to load studios'
        })
      }
    })
})

