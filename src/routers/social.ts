/**
 * 🤝 Social Features Router
 * 
 * Connect with friends, share discoveries, and get social recommendations.
 * Privacy-first, secure, and performant.
 */

import { z } from 'zod'
import { router, protectedProcedure, publicProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getMutualFollows,
  getActivityFeed,
  getFriendRecommendations,
  getSocialProof,
  getNotifications,
  markNotificationsRead,
  getSocialCounts,
  isFollowing
} from '../lib/social'
import { TRPCError } from '@trpc/server'

export const socialRouter = router({
  // Follow a user
  follow: protectedProcedure
    .input(z.object({
      userId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      await followUser(ctx.user.id, input.userId)
      return { success: true }
    }),

  // Unfollow a user
  unfollow: protectedProcedure
    .input(z.object({
      userId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      await unfollowUser(ctx.user.id, input.userId)
      return { success: true }
    }),

  // Get followers for a user
  getFollowers: publicProcedure
    .input(z.object({
      userId: z.string(),
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0)
    }))
    .query(async ({ input, ctx }) => {
      const requesterId = ctx.user?.id || null
      return await getFollowers(input.userId, requesterId, input.limit, input.offset)
    }),

  // Get following for a user
  getFollowing: publicProcedure
    .input(z.object({
      userId: z.string(),
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0)
    }))
    .query(async ({ input, ctx }) => {
      const requesterId = ctx.user?.id || null
      return await getFollowing(input.userId, requesterId, input.limit, input.offset)
    }),

  // Get mutual follows (friends)
  getFriends: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50)
    }).optional())
    .query(async ({ input, ctx }) => {
      const limit = input?.limit || 50
      const friends = await getMutualFollows(ctx.user.id, limit)
      
      return {
        friends,
        total: friends.length
      }
    }),

  // Check if following a user
  checkFollowing: publicProcedure
    .input(z.object({
      followerId: z.string(),
      followingId: z.string()
    }))
    .query(async ({ input }) => {
      const following = await isFollowing(input.followerId, input.followingId)
      
      return { following }
    }),

  // Get social counts (followers, following, friends)
  getSocialCounts: publicProcedure
    .input(z.object({
      userId: z.string()
    }))
    .query(async ({ input }) => {
      return await getSocialCounts(input.userId)
    }),

  // Get activity feed
  getActivityFeed: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0)
    }).optional())
    .query(async ({ input, ctx }) => {
      const limit = input?.limit || 20
      const offset = input?.offset || 0
      
      return await getActivityFeed(ctx.user.id, limit, offset)
    }),

  // Get friend-based recommendations
  getFriendRecommendations: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(20).default(12)
    }).optional())
    .query(async ({ input, ctx }) => {
      const limit = input?.limit || 12
      const recommendations = await getFriendRecommendations(ctx.user.id, limit)
      
      // Get anime details
      const animeIds = recommendations.map(r => r.animeId)
      const animeDetails = await db.anime.findMany({
        where: { id: { in: animeIds } },
        include: {
          genres: {
            include: {
              genre: true
            }
          }
        }
      })
      
      const animeMap = new Map(animeDetails.map(a => [a.id, a]))
      
      return {
        recommendations: recommendations.map(rec => {
          const anime = animeMap.get(rec.animeId)
          if (!anime) return null
          
          return {
            anime: {
              id: anime.id,
              slug: anime.slug,
              title: anime.title,
              coverImage: anime.coverImage,
              year: anime.year,
              averageRating: anime.averageRating,
              viewCount: anime.viewCount,
              genres: anime.genres.map(g => ({
                id: g.genre.id,
                name: g.genre.name,
                slug: g.genre.slug
              }))
            },
            friendCount: rec.friendCount,
            averageFriendRating: rec.averageFriendRating,
            friendNames: rec.friendNames,
            reason: rec.friendCount === 1 
              ? `${rec.friendNames[0]} watched this`
              : `${rec.friendCount} friends watched this`
          }
        }).filter(Boolean)
      }
    }),

  // Get social proof for specific anime
  getSocialProofForAnime: protectedProcedure
    .input(z.object({
      animeId: z.string()
    }))
    .query(async ({ input, ctx }) => {
      return await getSocialProof(ctx.user.id, input.animeId)
    }),

  // Get notifications
  getNotifications: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0)
    }).optional())
    .query(async ({ input, ctx }) => {
      const limit = input?.limit || 20
      const offset = input?.offset || 0
      
      return await getNotifications(ctx.user.id, limit, offset)
    }),

  // Mark notifications as read
  markNotificationsRead: protectedProcedure
    .input(z.object({
      notificationIds: z.array(z.string()).max(100) // Security: Limit batch size
    }))
    .mutation(async ({ input, ctx }) => {
      await markNotificationsRead(ctx.user.id, input.notificationIds)
      
      return { success: true }
    }),

  // Mark all notifications as read
  markAllNotificationsRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      await db.notification.updateMany({
        where: {
          userId: ctx.user.id,
          isRead: false
        },
        data: {
          isRead: true
        }
      })
      
      return { success: true }
    }),

  // Search users to follow
  searchUsers: publicProcedure
    .input(z.object({
      query: z.string().min(2).max(50), // Security: Length limits
      limit: z.number().min(1).max(20).default(10)
    }))
    .query(async ({ input }) => {
      // Security: Sanitize query
      const sanitizedQuery = input.query.toLowerCase().trim()
      
      const users = await db.user.findMany({
        where: {
          OR: [
            { username: { contains: sanitizedQuery, mode: 'insensitive' } },
            { name: { contains: sanitizedQuery, mode: 'insensitive' } }
          ],
          preferences: {
            allowFollowers: true // Only show users who allow followers
          }
        },
        select: {
          id: true,
          username: true,
          name: true,
          avatar: true,
          bio: true,
          role: true
        },
        take: input.limit
      })
      
      return { users }
    }),

  // Get suggested users to follow (based on similar taste)
  getSuggestedUsers: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(20).default(10)
    }).optional())
    .query(async ({ input, ctx }) => {
      const limit = input?.limit || 10
      
      // Get users with similar favorite genres
      const userPrefs = await db.userPreferences.findUnique({
        where: { userId: ctx.user.id },
        select: { favoriteGenres: true }
      })
      
      if (!userPrefs || userPrefs.favoriteGenres.length === 0) {
        // Return popular users if no preferences
        const popular = await db.user.findMany({
          where: {
            id: { not: ctx.user.id },
            preferences: {
              allowFollowers: true
            }
          },
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            bio: true
          },
          take: limit
        })
        
        return { users: popular }
      }
      
      // Find users with overlapping favorite genres
      const similarUsers = await db.userPreferences.findMany({
        where: {
          userId: { not: ctx.user.id },
          favoriteGenres: {
            hasSome: userPrefs.favoriteGenres // Overlap in genres
          },
          allowFollowers: true
        },
        select: {
          userId: true
        },
        take: limit * 2 // Get extra to filter out already following
      })
      
      const userIds = similarUsers.map(u => u.userId)
      
      // Get users not already following
      const following = await db.follow.findMany({
        where: {
          followerId: ctx.user.id,
          followingId: { in: userIds }
        },
        select: { followingId: true }
      })
      
      const followingIds = new Set(following.map(f => f.followingId))
      const notFollowingIds = userIds.filter(id => !followingIds.has(id))
      
      // Get user details
      const users = await db.user.findMany({
        where: {
          id: { in: notFollowingIds.slice(0, limit) }
        },
        select: {
          id: true,
          username: true,
          name: true,
          avatar: true,
          bio: true,
          role: true
        }
      })
      
      return { users }
    })
})

