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
          await processAnalyticsEvent(event, session)
        }

        // Update session data
        await updateUserSession(session)

        return { success: true, processed: events.length }
      } catch (error) {
        logger.error('Failed to process analytics events', { error, eventCount: input.events.length })
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
        logger.error('Failed to get user analytics', { error, userId: input.userId })
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
        logger.error('Failed to get content analytics', { error })
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
        logger.error('Failed to get growth metrics', { error })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get growth metrics'
        })
      }
    })
})

// Helper functions
async function processAnalyticsEvent(event: any, session: any) {
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

  const eventCounts = events.reduce((acc, event) => {
    acc[event.event] = (acc[event.event] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return {
    totalEvents: events.length,
    eventTypes: eventCounts,
    lastActivity: events.length > 0 ? Math.max(...events.map(e => e.timestamp.getTime())) : null
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

  const featureCounts = featureEvents.reduce((acc, event) => {
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
    uniqueQueries: new Set(searchEvents.map(e => e.properties?.query).filter(Boolean)).size,
    averageResults: searchEvents.reduce((sum, e) => sum + (e.properties?.results || 0), 0) / searchEvents.length || 0
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

  const actionCounts = animeEvents.reduce((acc, event) => {
    const action = event.properties?.action
    if (action) {
      acc[action] = (acc[action] || 0) + 1
    }
    return acc
  }, {} as Record<string, number>)

  return {
    totalInteractions: animeEvents.length,
    uniqueAnime: new Set(animeEvents.map(e => e.properties?.animeId).filter(Boolean)).size,
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
  // This would require joining with anime data to get genres
  // For now, return placeholder data
  return {
    topGenres: [],
    genreTrends: []
  }
}

async function getStudioAnalytics(startTime: number) {
  // This would require joining with anime data to get studios
  // For now, return placeholder data
  return {
    topStudios: [],
    studioTrends: []
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

async function getRetentionMetrics(startTime: number) {
  // This would require more complex cohort analysis
  // For now, return placeholder data
  return {
    dailyActiveUsers: 0,
    weeklyActiveUsers: 0,
    monthlyActiveUsers: 0,
    retentionRates: {}
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
