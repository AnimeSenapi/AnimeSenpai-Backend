import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from '../lib/trpc'
import { db, getCacheStrategy } from '../lib/db'
import { getContentFilter } from './anime'
import { generateEpisodeSchedule, getNextAirDate } from '../lib/broadcast-parser'
import { logger } from '../lib/logger'
import { syncAiringAnimeCalendarData, syncAnimeById } from '../lib/calendar-sync'

export const calendarRouter = router({
  /**
   * Get episode schedule for a date range
   * Returns episodes from currently airing anime within the specified date range
   */
  getEpisodeSchedule: publicProcedure
    .input(
      z.object({
        startDate: z.string(), // ISO date string (YYYY-MM-DD)
        endDate: z.string(), // ISO date string (YYYY-MM-DD)
        userId: z.string().optional(), // Optional user ID for filtering watched anime
      })
    )
    .query(async ({ input }) => {
      const { startDate, endDate, userId } = input
      const start = new Date(startDate)
      const end = new Date(endDate)
      
      logger.debug('getEpisodeSchedule called', { startDate, endDate, userId })

      // Query currently airing anime that overlap with the date range
      const airingAnime = await db.anime.findMany({
        where: {
          status: 'Currently Airing',
          airing: true,
          OR: [
            // Anime that starts before or during the range
            {
              startDate: {
                lte: end,
              },
            },
            // Anime that ends after or during the range
            {
              endDate: {
                gte: start,
              },
            },
            // Anime with no end date (still airing)
            {
              endDate: null,
            },
          ],
          ...getContentFilter(),
        },
        select: {
          id: true,
          slug: true,
          title: true,
          titleEnglish: true,
          coverImage: true,
          broadcast: true,
          startDate: true,
          endDate: true,
          episodes: true,
          duration: true,
          studios: true,
          season: true,
          year: true,
          type: true,
          genres: {
            select: {
              genre: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        ...getCacheStrategy(300), // 5 minutes cache
      })

      logger.debug('Found airing anime', { count: airingAnime.length })

      // Get user's anime list if userId is provided
      let userAnimeList: Map<string, { status: string; progress: number }> = new Map()
      if (userId) {
        const userList = await db.userAnimeList.findMany({
          where: {
            userId,
            animeId: { in: airingAnime.map((a) => a.id) },
          },
          select: {
            animeId: true,
            status: true,
            progress: true,
          },
        })

        userList.forEach((item) => {
          userAnimeList.set(item.animeId, {
            status: item.status,
            progress: item.progress,
          })
        })
      }

      // Generate episode schedule for each anime
      const episodes: Array<{
        id: string
        animeId: string
        animeTitle: string
        animeSlug: string
        animeImage?: string
        episodeNumber: number
        title?: string
        airDate: string
        airTime: string
        duration?: number
        isNewEpisode: boolean
        isWatching: boolean
        isCompleted: boolean
        studio?: string
        season?: string
        year?: number
      }> = []

      for (const anime of airingAnime) {
        const schedule = generateEpisodeSchedule(
          anime.broadcast,
          start,
          end,
          anime.startDate,
          anime.episodes
        )

        const userListEntry = userAnimeList.get(anime.id)
        const isWatching = userListEntry?.status === 'watching' || false
        const isCompleted = userListEntry?.status === 'completed' || false
        const userProgress = userListEntry?.progress || 0

        for (const episode of schedule) {
          // Determine if this is a new episode (episode number > user's progress)
          const isNewEpisode = episode.episodeNumber > userProgress

          // Parse duration (e.g., "24 min per ep" -> 24)
          let duration: number | undefined
          if (anime.duration) {
            const durationMatch = anime.duration.match(/(\d+)\s*min/i)
            if (durationMatch) {
              duration = parseInt(durationMatch[1] || '0', 10)
            }
          }

          episodes.push({
            id: `${anime.id}-ep-${episode.episodeNumber}`,
            animeId: anime.id,
            animeTitle: anime.titleEnglish || anime.title,
            animeSlug: anime.slug,
            animeImage: anime.coverImage || undefined,
            episodeNumber: episode.episodeNumber,
            airDate: episode.date,
            airTime: episode.time,
            duration,
            isNewEpisode,
            isWatching,
            isCompleted,
            studio: anime.studios?.[0] || undefined,
            season: anime.season || undefined,
            year: anime.year || undefined,
            genres: anime.genres.map((g) => g.genre.name),
            type: anime.type || undefined,
          })
        }
      }

      // Sort by air date and time
      episodes.sort((a, b) => {
        const dateA = new Date(`${a.airDate}T${a.airTime}`).getTime()
        const dateB = new Date(`${b.airDate}T${b.airTime}`).getTime()
        return dateA - dateB
      })

      logger.debug('Generated episode schedule', { episodeCount: episodes.length })

      return episodes
    }),

  /**
   * Get seasonal anime for a specific season and year
   */
  getSeasonalAnime: publicProcedure
    .input(
      z.object({
        season: z.enum(['Winter', 'Spring', 'Summer', 'Fall']),
        year: z.number(),
        userId: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const { season, year, userId } = input
      
      logger.debug('getSeasonalAnime called', { season, year, userId })

      // Query anime for the specified season and year
      const seasonalAnime = await db.anime.findMany({
        where: {
          season: season.toLowerCase(),
          year,
          ...getContentFilter(),
        },
        select: {
          id: true,
          slug: true,
          title: true,
          titleEnglish: true,
          coverImage: true,
          status: true,
          episodes: true,
          studios: true,
          genres: {
            select: {
              genre: {
                select: {
                  name: true,
                },
              },
            },
          },
          averageRating: true,
          popularity: true,
          startDate: true,
          endDate: true,
        },
        orderBy: {
          popularity: 'desc',
        },
        ...getCacheStrategy(600), // 10 minutes cache
      })

      // Get user's anime list if userId is provided
      let userAnimeList: Map<string, { status: string; isFavorite: boolean }> = new Map()
      if (userId) {
        const userList = await db.userAnimeList.findMany({
          where: {
            userId,
            animeId: { in: seasonalAnime.map((a) => a.id) },
          },
          select: {
            animeId: true,
            status: true,
            isFavorite: true,
          },
        })

        userList.forEach((item) => {
          userAnimeList.set(item.animeId, {
            status: item.status,
            isFavorite: item.isFavorite,
          })
        })
      }

      // Transform to match SeasonalAnime interface
      const result = seasonalAnime.map((anime) => {
        const userListEntry = userAnimeList.get(anime.id)
        const status = anime.status === 'Currently Airing' 
          ? 'Airing' 
          : anime.status === 'Not yet aired' 
          ? 'Upcoming' 
          : 'Completed'

        return {
          id: anime.id,
          title: anime.title,
          titleEnglish: anime.titleEnglish || undefined,
          slug: anime.slug,
          image: anime.coverImage || undefined,
          season: season as 'Winter' | 'Spring' | 'Summer' | 'Fall',
          year,
          status: status as 'Airing' | 'Upcoming' | 'Completed',
          episodes: anime.episodes || 0,
          episodesAired: anime.status === 'Currently Airing' ? anime.episodes || 0 : undefined,
          genres: anime.genres.map((g) => g.genre.name),
          studios: anime.studios || [],
          score: anime.averageRating ? Math.round(anime.averageRating * 10) / 10 : undefined,
          popularity: anime.popularity || 0,
          isWatching: userListEntry?.status === 'watching' || false,
          isCompleted: userListEntry?.status === 'completed' || false,
          isPlanToWatch: userListEntry?.status === 'plan-to-watch' || false,
          airDate: anime.startDate?.toISOString().split('T')[0] || undefined,
          endDate: anime.endDate?.toISOString().split('T')[0] || undefined,
        }
      })

      logger.debug('Found seasonal anime', { count: result.length })

      return result
    }),

  /**
   * Get calendar statistics (episodes this week, trending, watching count)
   */
  getCalendarStats: protectedProcedure
    .input(
      z.object({
        startDate: z.string().optional(), // Optional: defaults to start of current week
        endDate: z.string().optional(), // Optional: defaults to end of current week
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      // Default to current week
      const now = new Date()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      startOfWeek.setHours(0, 0, 0, 0)
      
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      endOfWeek.setHours(23, 59, 59, 999)

      const startDate = input?.startDate ? new Date(input.startDate) : startOfWeek
      const endDate = input?.endDate ? new Date(input.endDate) : endOfWeek

      logger.debug('getCalendarStats called', { userId: ctx.user.id, startDate, endDate })

      // Query currently airing anime that overlap with the date range
      const airingAnime = await db.anime.findMany({
        where: {
          status: 'Currently Airing',
          airing: true,
          OR: [
            {
              startDate: {
                lte: endDate,
              },
            },
            {
              endDate: {
                gte: startDate,
              },
            },
            {
              endDate: null,
            },
          ],
          ...getContentFilter(),
        },
        select: {
          id: true,
          slug: true,
          title: true,
          titleEnglish: true,
          broadcast: true,
          startDate: true,
          endDate: true,
          episodes: true,
        },
        ...getCacheStrategy(300),
      })

      // Get user's anime list
      const userAnimeList = await db.userAnimeList.findMany({
        where: {
          userId: ctx.user.id,
          animeId: { in: airingAnime.map((a) => a.id) },
        },
        select: {
          animeId: true,
          status: true,
          progress: true,
        },
      })

      const userListMap = new Map<string, { status: string; progress: number }>()
      userAnimeList.forEach((item) => {
        userListMap.set(item.animeId, {
          status: item.status,
          progress: item.progress,
        })
      })

      // Generate episodes and count them
      let episodesThisWeek = 0
      let watchingEpisodes = 0

      for (const anime of airingAnime) {
        const schedule = generateEpisodeSchedule(
          anime.broadcast,
          startDate,
          endDate,
          anime.startDate,
          anime.episodes
        )

        episodesThisWeek += schedule.length

        const userListEntry = userListMap.get(anime.id)
        const isWatching = userListEntry?.status === 'watching' || false
        const userProgress = userListEntry?.progress || 0

        if (isWatching) {
          watchingEpisodes += schedule.filter((ep) => ep.episodeNumber > userProgress).length
        }
      }

      // Get trending anime (currently airing, sorted by popularity)
      const trendingAnime = await db.anime.findMany({
        where: {
          status: 'Currently Airing',
          airing: true,
          ...getContentFilter(),
        },
        select: {
          id: true,
        },
        take: 8,
        orderBy: {
          popularity: 'desc',
        },
        ...getCacheStrategy(300),
      })

      const trendingCount = trendingAnime.length

      logger.debug('Calendar stats calculated', {
        episodesThisWeek,
        watchingEpisodes,
        trendingCount,
      })

      return {
        episodesThisWeek,
        watchingEpisodes,
        trendingCount,
      }
    }),

  /**
   * Manually trigger calendar sync (admin/authenticated users)
   * Useful for refreshing data on-demand
   */
  syncCalendarData: protectedProcedure
    .input(
      z.object({
        animeId: z.string().optional(), // Optional: sync specific anime, or all airing anime
      }).optional()
    )
    .mutation(async ({ input, ctx }) => {
      logger.debug('Manual calendar sync triggered', { userId: ctx.user.id, animeId: input?.animeId })

      if (input?.animeId) {
        // Sync specific anime
        const success = await syncAnimeById(input.animeId)
        return {
          success,
          message: success ? 'Anime calendar data synced' : 'Failed to sync anime calendar data',
        }
      } else {
        // Sync all airing anime (in background)
        syncAiringAnimeCalendarData().catch((error) => {
          logger.error('Background calendar sync failed', error as Error, {}, {})
        })

        return {
          success: true,
          message: 'Calendar sync started in background',
        }
      }
    }),
})

