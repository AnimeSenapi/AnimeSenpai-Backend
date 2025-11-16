import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { publicProcedure, router } from '../lib/trpc'
import { logger } from '../lib/logger'
import { db } from '../lib/db'

// Analytics Event Schema
const AnalyticsEventSchema = z.object({
  event: z.string(),
  properties: z.record(z.any()).optional(),
  userId: z.string().optional(),
  sessionId: z.string(),
  timestamp: z.number(),
  url: z.string(),
  userAgent: z.string(),
  viewport: z.object({
    width: z.number(),
    height: z.number()
  }),
  referrer: z.string().optional()
})

const UserSessionSchema = z.object({
  sessionId: z.string(),
  userId: z.string().optional(),
  startTime: z.number(),
  lastActivity: z.number(),
  pageViews: z.number(),
  events: z.number(),
  referrer: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional()
})

export const analyticsRouter = router({
  // Track analytics events
  track: publicProcedure
    .input(z.object({
      events: z.array(AnalyticsEventSchema),
      session: UserSessionSchema
    }))
    .mutation(async ({ input }) => {
      try {
        const { events, session } = input

        // Process and store events
        for (const event of events) {
          await processAnalyticsEvent(event)
        }

        // Update session data
        await updateUserSession(session)

        return { success: true, processed: events.length }
      } catch (error) {
        logger.error(
          'Failed to process analytics events',
          error instanceof Error ? error : new Error(String(error)),
          undefined,
          { eventCount: input.events.length }
        )
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process analytics events'
        })
      }
    }),

  // Get user analytics summary
  getUserAnalytics: publicProcedure
    .input(z.object({
      userId: z.string(),
      timeRange: z.enum(['day', 'week', 'month', 'year']).default('week')
    }))
    .query(async ({ input }) => {
      try {
        const { userId, timeRange } = input
        const timeRangeMs = getTimeRangeMs(timeRange)
        const startTime = Date.now() - timeRangeMs

        // Get user activity summary
        const activitySummary = await getUserActivitySummary(userId, startTime)
        
        // Get feature usage
        const featureUsage = await getFeatureUsage(userId, startTime)
        
        // Get search analytics
        const searchAnalytics = await getSearchAnalytics(userId, startTime)
        
        // Get anime interaction analytics
        const animeAnalytics = await getAnimeAnalytics(userId, startTime)

        return {
          success: true,
          analytics: {
            activity: activitySummary,
            features: featureUsage,
            search: searchAnalytics,
            anime: animeAnalytics
          }
        }
      } catch (error) {
        logger.error(
          'Failed to get user analytics',
          error instanceof Error ? error : new Error(String(error)),
          undefined,
          { userId: input.userId }
        )
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get user analytics'
        })
      }
    }),

  // Get content analytics
  getContentAnalytics: publicProcedure
    .input(z.object({
      timeRange: z.enum(['day', 'week', 'month', 'year']).default('week')
    }))
    .query(async ({ input }) => {
      try {
        const { timeRange } = input
        const timeRangeMs = getTimeRangeMs(timeRange)
        const startTime = Date.now() - timeRangeMs

        // Get most popular anime
        const popularAnime = await getPopularAnime(startTime)
        
        // Get genre analytics
        const genreAnalytics = await getGenreAnalytics(startTime)
        
        // Get studio analytics
        const studioAnalytics = await getStudioAnalytics(startTime)
        
        // Get trending content
        const trendingContent = await getTrendingContent(startTime)

        return {
          success: true,
          analytics: {
            popularAnime,
            genres: genreAnalytics,
            studios: studioAnalytics,
            trending: trendingContent
          }
        }
      } catch (error) {
        logger.error(
          'Failed to get content analytics',
          error instanceof Error ? error : new Error(String(error))
        )
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get content analytics'
        })
      }
    }),

  // Get growth metrics
  getGrowthMetrics: publicProcedure
    .input(z.object({
      timeRange: z.enum(['day', 'week', 'month', 'year']).default('month')
    }))
    .query(async ({ input }) => {
      try {
        const { timeRange } = input
        const timeRangeMs = getTimeRangeMs(timeRange)
        const startTime = Date.now() - timeRangeMs

        // Get user growth metrics
        const userGrowth = await getUserGrowthMetrics(startTime)
        
        // Get engagement metrics
        const engagement = await getEngagementMetrics(startTime)
        
        // Get retention metrics
        const retention = await getRetentionMetrics(startTime)

        return {
          success: true,
          metrics: {
            userGrowth,
            engagement,
            retention
          }
        }
      } catch (error) {
        logger.error(
          'Failed to get growth metrics',
          error instanceof Error ? error : new Error(String(error))
        )
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get growth metrics'
        })
      }
    })
})

// Helper functions
async function processAnalyticsEvent(event: any) {
  // Store event in database
  await db.analyticsEvent.create({
    data: {
      event: event.event,
      properties: event.properties || {},
      userId: event.userId,
      sessionId: event.sessionId,
      timestamp: new Date(event.timestamp),
      url: event.url,
      userAgent: event.userAgent,
      viewport: event.viewport,
      referrer: event.referrer
    }
  })

  // Process specific event types
  switch (event.event) {
    case 'search':
      await processSearchEvent(event)
      break
    case 'anime_interaction':
      await processAnimeInteractionEvent(event)
      break
    case 'feature_usage':
      await processFeatureUsageEvent(event)
      break
    case 'user_action':
      await processUserActionEvent(event)
      break
  }
}

async function updateUserSession(session: any) {
  // Update or create user session
  await db.userSession.upsert({
    where: { sessionId: session.sessionId },
    update: {
      userId: session.userId,
      lastActivity: new Date(session.lastActivity),
      pageViews: session.pageViews,
      events: session.events,
      utmSource: session.utmSource,
      utmMedium: session.utmMedium,
      utmCampaign: session.utmCampaign
    },
    create: {
      sessionId: session.sessionId,
      userId: session.userId,
      startTime: new Date(session.startTime),
      lastActivity: new Date(session.lastActivity),
      pageViews: session.pageViews,
      events: session.events,
      referrer: session.referrer,
      utmSource: session.utmSource,
      utmMedium: session.utmMedium,
      utmCampaign: session.utmCampaign
    }
  })
}

async function processSearchEvent(event: any) {
  const { query, results, filters } = event.properties || {}
  
  if (query) {
    await db.searchAnalytics.upsert({
      where: { query },
      update: {
        count: { increment: 1 },
        totalResults: { increment: results || 0 },
        lastSearched: new Date()
      },
      create: {
        query,
        count: 1,
        totalResults: results || 0,
        firstSearched: new Date(),
        lastSearched: new Date(),
        filters: filters || {}
      }
    })
  }
}

async function processAnimeInteractionEvent(event: any) {
  const { animeId, action } = event.properties || {}
  
  if (animeId && action) {
    await db.animeAnalytics.upsert({
      where: { animeId },
      update: {
        [action]: { increment: 1 },
        lastInteraction: new Date()
      },
      create: {
        animeId,
        [action]: 1,
        firstInteraction: new Date(),
        lastInteraction: new Date()
      }
    })
  }
}

async function processFeatureUsageEvent(event: any) {
  const { feature } = event.properties || {}
  
  if (feature) {
    await db.featureAnalytics.upsert({
      where: { feature },
      update: {
        usageCount: { increment: 1 },
        lastUsed: new Date()
      },
      create: {
        feature,
        usageCount: 1,
        firstUsed: new Date(),
        lastUsed: new Date()
      }
    })
  }
}

async function processUserActionEvent(event: any) {
  const { action, target } = event.properties || {}
  
  if (action) {
    await db.userActionAnalytics.upsert({
      where: { action },
      update: {
        count: { increment: 1 },
        lastAction: new Date()
      },
      create: {
        action,
        target,
        count: 1,
        firstAction: new Date(),
        lastAction: new Date()
      }
    })
  }
}

// Analytics query functions
async function getUserActivitySummary(userId: string, startTime: number) {
  const events = await db.analyticsEvent.findMany({
    where: {
      userId,
      timestamp: { gte: new Date(startTime) }
    },
    select: {
      event: true,
      timestamp: true
    }
  })

  const eventCounts = events.reduce((acc: Record<string, number>, event: typeof events[0]) => {
    acc[event.event] = (acc[event.event] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return {
    totalEvents: events.length,
    eventTypes: eventCounts,
    lastActivity: events.length > 0 ? Math.max(...events.map((e: typeof events[0]) => e.timestamp.getTime())) : null
  }
}

async function getFeatureUsage(userId: string, startTime: number) {
  const featureEvents = await db.analyticsEvent.findMany({
    where: {
      userId,
      event: 'feature_usage',
      timestamp: { gte: new Date(startTime) }
    },
    select: {
      properties: true
    }
  })

  const featureCounts = featureEvents.reduce((acc: Record<string, number>, event: typeof featureEvents[0]) => {
    const feature = event.properties?.feature
    if (feature) {
      acc[feature] = (acc[feature] || 0) + 1
    }
    return acc
  }, {} as Record<string, number>)

  return featureCounts
}

async function getSearchAnalytics(userId: string, startTime: number) {
  const searchEvents = await db.analyticsEvent.findMany({
    where: {
      userId,
      event: 'search',
      timestamp: { gte: new Date(startTime) }
    },
    select: {
      properties: true
    }
  })

  return {
    totalSearches: searchEvents.length,
    uniqueQueries: new Set(searchEvents.map((e: typeof searchEvents[0]) => e.properties?.query).filter(Boolean)).size,
    averageResults: searchEvents.reduce((sum: number, e: typeof searchEvents[0]) => sum + (e.properties?.results || 0), 0) / searchEvents.length || 0
  }
}

async function getAnimeAnalytics(userId: string, startTime: number) {
  const animeEvents = await db.analyticsEvent.findMany({
    where: {
      userId,
      event: 'anime_interaction',
      timestamp: { gte: new Date(startTime) }
    },
    select: {
      properties: true
    }
  })

  const actionCounts = animeEvents.reduce((acc: Record<string, number>, event: typeof animeEvents[0]) => {
    const action = event.properties?.action
    if (action) {
      acc[action] = (acc[action] || 0) + 1
    }
    return acc
  }, {} as Record<string, number>)

  return {
    totalInteractions: animeEvents.length,
    uniqueAnime: new Set(animeEvents.map((e: typeof animeEvents[0]) => e.properties?.animeId).filter(Boolean)).size,
    actions: actionCounts
  }
}

async function getPopularAnime(startTime: number) {
  const popularAnime = await db.animeAnalytics.findMany({
    where: {
      lastInteraction: { gte: new Date(startTime) }
    },
    orderBy: {
      views: 'desc'
    },
    take: 20,
    select: {
      animeId: true,
      views: true,
      likes: true,
      shares: true
    }
  })

  return popularAnime
}

async function getGenreAnalytics(startTime: number) {
  // Get top genres by view count and interaction
  const topGenres = await db.animeGenre.groupBy({
    by: ['genreId'],
    _count: {
      animeId: true
    },
    where: {
      anime: {
        viewCount: { gt: 0 },
        OR: [
          { updatedAt: { gte: new Date(startTime) } },
          { createdAt: { gte: new Date(startTime) } }
        ]
      }
    },
    orderBy: {
      _count: {
        animeId: 'desc'
      }
    },
    take: 10
  })

  // Get genre details
  const genreIds = topGenres.map((g: { genreId: string; _count: { animeId: number } }) => g.genreId)
  const genres = await db.genre.findMany({
    where: { id: { in: genreIds } },
    select: {
      id: true,
      name: true,
      slug: true
    },
    ...getCacheStrategy(3600) // 1 hour - genres don't change often
  })

  const genreMap = new Map(genres.map((g: { id: string; name: string; slug: string }) => [g.id, g]))
  
  const topGenresData = topGenres.map((g: { genreId: string; _count: { animeId: number } }) => ({
    genre: genreMap.get(g.genreId),
    animeCount: g._count.animeId
  })).filter((g: { genre?: { id: string; name: string; slug: string }; animeCount: number }) => g.genre !== undefined)

  // Get genre trends (anime added in time period)
  const genreTrends = await db.animeGenre.groupBy({
    by: ['genreId'],
    _count: {
      animeId: true
    },
    where: {
      anime: {
        createdAt: { gte: new Date(startTime) }
      }
    },
    orderBy: {
      _count: {
        animeId: 'desc'
      }
    },
    take: 5
  })

  const trendGenreIds = genreTrends.map((g: { genreId: string; _count: { animeId: number } }) => g.genreId)
  const trendGenres = await db.genre.findMany({
    where: { id: { in: trendGenreIds } },
    select: {
      id: true,
      name: true,
      slug: true
    },
    ...getCacheStrategy(3600)
  })

  const trendGenreMap = new Map(trendGenres.map((g: { id: string; name: string; slug: string }) => [g.id, g]))
  
  const genreTrendsData = genreTrends.map((g: { genreId: string; _count: { animeId: number } }) => ({
    genre: trendGenreMap.get(g.genreId),
    newAnimeCount: g._count.animeId
  })).filter((g: { genre?: { id: string; name: string; slug: string }; newAnimeCount: number }) => g.genre !== undefined)

  return {
    topGenres: topGenresData,
    genreTrends: genreTrendsData
  }
}

async function getStudioAnalytics(startTime: number) {
  // Get all anime with studios in the time period
  const animeWithStudios = await db.anime.findMany({
    where: {
      OR: [
        { updatedAt: { gte: new Date(startTime) } },
        { createdAt: { gte: new Date(startTime) } }
      ],
      studios: { isEmpty: false }
    },
    select: {
      studios: true,
      viewCount: true,
      averageRating: true,
      createdAt: true
    },
    ...getCacheStrategy(600) // 10 minutes
  })

  // Count studios by popularity
  const studioCounts = new Map<string, { count: number; totalViews: number; avgRating: number }>()
  
  for (const anime of animeWithStudios) {
    for (const studio of anime.studios) {
      if (!studio) continue
      
      const existing = studioCounts.get(studio) || { count: 0, totalViews: 0, avgRating: 0 }
      studioCounts.set(studio, {
        count: existing.count + 1,
        totalViews: existing.totalViews + anime.viewCount,
        avgRating: existing.avgRating + (anime.averageRating || 0)
      })
    }
  }

  // Convert to array and sort
  const topStudios = Array.from(studioCounts.entries())
    .map(([name, data]) => ({
      name,
      animeCount: data.count,
      totalViews: data.totalViews,
      averageRating: data.count > 0 ? data.avgRating / data.count : 0
    }))
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 10)

  // Get studio trends (new anime in time period)
  const newAnime = await db.anime.findMany({
    where: {
      createdAt: { gte: new Date(startTime) },
      studios: { isEmpty: false }
    },
    select: {
      studios: true
    },
    ...getCacheStrategy(600)
  })

  const studioTrends = new Map<string, number>()
  for (const anime of newAnime) {
    for (const studio of anime.studios) {
      if (!studio) continue
      studioTrends.set(studio, (studioTrends.get(studio) || 0) + 1)
    }
  }

  const studioTrendsData = Array.from(studioTrends.entries())
    .map(([name, count]) => ({ name, newAnimeCount: count }))
    .sort((a, b) => b.newAnimeCount - a.newAnimeCount)
    .slice(0, 5)

  return {
    topStudios,
    studioTrends: studioTrendsData
  }
}

async function getTrendingContent(startTime: number) {
  const trending = await db.animeAnalytics.findMany({
    where: {
      lastInteraction: { gte: new Date(startTime) }
    },
    orderBy: {
      views: 'desc'
    },
    take: 10,
    select: {
      animeId: true,
      views: true,
      likes: true
    }
  })

  return trending
}

async function getUserGrowthMetrics(startTime: number) {
  const newUsers = await db.user.count({
    where: {
      createdAt: { gte: new Date(startTime) }
    }
  })

  const totalUsers = await db.user.count()

  return {
    newUsers,
    totalUsers,
    growthRate: totalUsers > 0 ? (newUsers / totalUsers) * 100 : 0
  }
}

async function getEngagementMetrics(startTime: number) {
  const activeSessions = await db.userSession.count({
    where: {
      lastActivity: { gte: new Date(startTime) }
    }
  })

  const totalEvents = await db.analyticsEvent.count({
    where: {
      timestamp: { gte: new Date(startTime) }
    }
  })

  return {
    activeSessions,
    totalEvents,
    averageEventsPerSession: activeSessions > 0 ? totalEvents / activeSessions : 0
  }
}

async function getRetentionMetrics(_startTime: number) {
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const weekMs = 7 * dayMs
  const monthMs = 30 * dayMs

  const dayStart = now - dayMs
  const weekStart = now - weekMs
  const monthStart = now - monthMs

  // Get active users for each period
  const [dailyActiveUsers, weeklyActiveUsers, monthlyActiveUsers] = await Promise.all([
    db.userSession.count({
      where: {
        lastActivity: { gte: new Date(dayStart) }
      },
      ...getCacheStrategy(300) // 5 minutes
    }),
    db.userSession.count({
      where: {
        lastActivity: { gte: new Date(weekStart) }
      },
      ...getCacheStrategy(300)
    }),
    db.userSession.count({
      where: {
        lastActivity: { gte: new Date(monthStart) }
      },
      ...getCacheStrategy(300)
    })
  ])

  // Calculate retention rates (simplified - compare this week vs last week)
  const lastWeekStart = weekStart - weekMs
  const lastWeekActive = await db.userSession.count({
    where: {
      lastActivity: { gte: new Date(lastWeekStart), lt: new Date(weekStart) }
    },
    ...getCacheStrategy(300)
  })

  const thisWeekActive = weeklyActiveUsers
  const retentionRate = lastWeekActive > 0 
    ? ((thisWeekActive / lastWeekActive) * 100) 
    : 100

  return {
    dailyActiveUsers,
    weeklyActiveUsers,
    monthlyActiveUsers,
    retentionRates: {
      weekly: Math.round(retentionRate * 100) / 100
    }
  }
}

function getTimeRangeMs(timeRange: string): number {
  const ranges = {
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000
  }
  return ranges[timeRange as keyof typeof ranges] || ranges.week
}
