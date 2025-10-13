/**
 * Social Features Router - Phase 1
 * 
 * Implements:
 * - Follow/Friend hybrid system
 * - User profiles
 * - Notifications
 * - Privacy settings
 */

import { z } from 'zod'
import { router, protectedProcedure, publicProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import { TRPCError } from '@trpc/server'
import { logger, extractLogContext } from '../lib/logger'
import { checkRateLimit } from '../lib/rate-limiter'

export const socialRouter = router({
  // ============================================================================
  // FOLLOW SYSTEM (One-way, instant)
  // ============================================================================

  /**
   * Follow a user (instant, no approval needed)
   */
  followUser: protectedProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        // Can't follow yourself
        if (input.userId === ctx.user.id) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'You cannot follow yourself'
          })
        }
        
        // Check if target user exists
        const targetUser = await db.user.findUnique({
          where: { id: input.userId },
          select: { id: true, username: true }
        })
        
        if (!targetUser) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found'
          })
        }
        
        // Check if already following
        const existing = await db.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: ctx.user.id,
              followingId: input.userId
            }
          }
        })
        
        if (existing) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'You are already following this user'
          })
        }
        
        // Create follow
        await db.follow.create({
          data: {
            followerId: ctx.user.id,
            followingId: input.userId
          }
        })
        
        // Create notification for target user
        await db.notification.create({
          data: {
            userId: input.userId,
            fromUserId: ctx.user.id,
            type: 'new_follower',
            message: `${ctx.user.username} started following you`,
            actionUrl: `/user/${ctx.user.username}`
          }
        })
        
        // Create activity
        await db.activityFeed.create({
          data: {
            userId: ctx.user.id,
            activityType: 'followed_user',
            targetUserId: input.userId,
            isPublic: true
          }
        })
        
        logger.info('User followed', logContext, {
          followerId: ctx.user.id,
          followingId: input.userId
        })
        
        return { success: true, message: `Now following ${targetUser.username}` }
        
      } catch (error) {
        logger.error('Failed to follow user', error as Error, logContext)
        throw error
      }
    }),

  /**
   * Unfollow a user
   */
  unfollowUser: protectedProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        const deleted = await db.follow.deleteMany({
          where: {
            followerId: ctx.user.id,
            followingId: input.userId
          }
        })
        
        if (deleted.count === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'You are not following this user'
          })
        }
        
        logger.info('User unfollowed', logContext, {
          followerId: ctx.user.id,
          followingId: input.userId
        })
        
        return { success: true }
        
      } catch (error) {
        logger.error('Failed to unfollow user', error as Error, logContext)
        throw error
      }
    }),

  // ============================================================================
  // FRIEND SYSTEM (Two-way, requires acceptance)
  // ============================================================================

  /**
   * Send friend request
   */
  sendFriendRequest: protectedProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        checkRateLimit(ctx.user.id, 'authenticated', 'send-friend-request')
        
        // Can't friend yourself
        if (input.userId === ctx.user.id) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'You cannot send a friend request to yourself'
          })
        }
        
        // Check if already friends
        const existing = await db.friendship.findFirst({
          where: {
            OR: [
              { user1Id: ctx.user.id, user2Id: input.userId },
              { user1Id: input.userId, user2Id: ctx.user.id }
            ]
          }
        })
        
        if (existing) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'You are already friends with this user'
          })
        }
        
        // Check if request already exists
        const existingRequest = await db.friendRequest.findFirst({
          where: {
            OR: [
              { senderId: ctx.user.id, receiverId: input.userId, status: 'pending' },
              { senderId: input.userId, receiverId: ctx.user.id, status: 'pending' }
            ]
          }
        })
        
        if (existingRequest) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'A friend request already exists between you and this user'
          })
        }
        
        // Create friend request
        const request = await db.friendRequest.create({
          data: {
            senderId: ctx.user.id,
            receiverId: input.userId,
            status: 'pending'
          }
        })
        
        // Create notification
        await db.notification.create({
          data: {
            userId: input.userId,
            fromUserId: ctx.user.id,
            type: 'friend_request',
            relatedId: request.id,
            message: `${ctx.user.username} sent you a friend request`,
            actionUrl: `/notifications`
          }
        })
        
        logger.info('Friend request sent', logContext, {
          senderId: ctx.user.id,
          receiverId: input.userId
        })
        
        return { success: true, requestId: request.id }
        
      } catch (error) {
        logger.error('Failed to send friend request', error as Error, logContext)
        throw error
      }
    }),

  /**
   * Accept friend request
   */
  acceptFriendRequest: protectedProcedure
    .input(z.object({
      requestId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        // Get the request
        const request = await db.friendRequest.findUnique({
          where: { id: input.requestId },
          include: {
            sender: { select: { id: true, username: true } }
          }
        })
        
        if (!request) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Friend request not found'
          })
        }
        
        // Verify you're the receiver
        if (request.receiverId !== ctx.user.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You cannot accept this friend request'
          })
        }
        
        if (request.status !== 'pending') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'This friend request has already been responded to'
          })
        }
        
        // Update request status
        await db.friendRequest.update({
          where: { id: input.requestId },
          data: {
            status: 'accepted',
            respondedAt: new Date()
          }
        })
        
        // Create friendship (bidirectional)
        // Always store with smaller ID as user1Id for consistency
        const [user1Id, user2Id] = [request.senderId, ctx.user.id].sort()
        
        await db.friendship.create({
          data: {
            user1Id,
            user2Id
          }
        })
        
        // Create notification for sender
        await db.notification.create({
          data: {
            userId: request.senderId,
            fromUserId: ctx.user.id,
            type: 'friend_accepted',
            message: `${ctx.user.username} accepted your friend request`,
            actionUrl: `/user/${ctx.user.username}`
          }
        })
        
        logger.info('Friend request accepted', logContext, {
          requestId: input.requestId,
          user1Id,
          user2Id
        })
        
        return { success: true, message: `You are now friends with ${request.sender.username}` }
        
      } catch (error) {
        logger.error('Failed to accept friend request', error as Error, logContext)
        throw error
      }
    }),

  /**
   * Decline friend request
   */
  declineFriendRequest: protectedProcedure
    .input(z.object({
      requestId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        const request = await db.friendRequest.findUnique({
          where: { id: input.requestId }
        })
        
        if (!request) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Friend request not found'
          })
        }
        
        if (request.receiverId !== ctx.user.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You cannot decline this friend request'
          })
        }
        
        await db.friendRequest.update({
          where: { id: input.requestId },
          data: {
            status: 'declined',
            respondedAt: new Date()
          }
        })
        
        logger.info('Friend request declined', logContext, { requestId: input.requestId })
        
        return { success: true }
        
      } catch (error) {
        logger.error('Failed to decline friend request', error as Error, logContext)
        throw error
      }
    }),

  /**
   * Unfriend a user
   */
  unfriend: protectedProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        const deleted = await db.friendship.deleteMany({
          where: {
            OR: [
              { user1Id: ctx.user.id, user2Id: input.userId },
              { user1Id: input.userId, user2Id: ctx.user.id }
            ]
          }
        })
        
        if (deleted.count === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'You are not friends with this user'
          })
        }
        
        logger.info('Users unfriended', logContext, {
          user1: ctx.user.id,
          user2: input.userId
        })
        
        return { success: true }
        
      } catch (error) {
        logger.error('Failed to unfriend user', error as Error, logContext)
        throw error
      }
    }),

  // ============================================================================
  // USER RELATIONSHIPS
  // ============================================================================

  /**
   * Get relationship status with a user
   */
  getRelationshipStatus: protectedProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const [isFollowing, isFollowedBy, friendship, pendingRequest] = await Promise.all([
          db.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: ctx.user.id,
                followingId: input.userId
              }
            }
          }),
          db.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: input.userId,
                followingId: ctx.user.id
              }
            }
          }),
          db.friendship.findFirst({
            where: {
              OR: [
                { user1Id: ctx.user.id, user2Id: input.userId },
                { user1Id: input.userId, user2Id: ctx.user.id }
              ]
            }
          }),
          db.friendRequest.findFirst({
            where: {
              OR: [
                { senderId: ctx.user.id, receiverId: input.userId, status: 'pending' },
                { senderId: input.userId, receiverId: ctx.user.id, status: 'pending' }
              ]
            },
            include: {
              sender: { select: { id: true, username: true } },
              receiver: { select: { id: true, username: true } }
            }
          })
        ])
        
        return {
          isFollowing: !!isFollowing,
          isFollowedBy: !!isFollowedBy,
          isFriend: !!friendship,
          pendingFriendRequest: pendingRequest ? {
            id: pendingRequest.id,
            sentByMe: pendingRequest.senderId === ctx.user.id,
            sender: pendingRequest.sender,
            receiver: pendingRequest.receiver
          } : null
        }
        
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get relationship status'
        })
      }
    }),

  /**
   * Get user's friends list
   */
  getFriends: protectedProcedure
    .input(z.object({
      userId: z.string().optional(), // If not provided, get current user's friends
    }).optional())
    .query(async ({ input, ctx }) => {
      try {
        const userId = input?.userId || ctx.user.id
        
        const friendships = await db.friendship.findMany({
          where: {
            OR: [
              { user1Id: userId },
              { user2Id: userId }
            ]
          },
          include: {
            user1: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true,
                bio: true
              }
            },
            user2: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true,
                bio: true
              }
            }
          }
        })
        
        // Extract the friend (not the current user)
        const friends = friendships.map((f: any) => 
          f.user1Id === userId ? f.user2 : f.user1
        )
        
        return { friends, total: friends.length }
        
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get friends list'
        })
      }
    }),

  /**
   * Get pending friend requests
   */
  getPendingFriendRequests: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const requests = await db.friendRequest.findMany({
          where: {
            receiverId: ctx.user.id,
            status: 'pending'
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true,
                bio: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        })
        
        return { requests, total: requests.length }
        
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get friend requests'
        })
      }
    }),

  /**
   * Get followers
   */
  getFollowers: protectedProcedure
    .input(z.object({
      userId: z.string().optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
    }).optional())
    .query(async ({ input = {}, ctx }) => {
      try {
        const { userId = ctx.user.id, page = 1, limit = 20 } = input
        const skip = (page - 1) * limit
        
        const [followers, total] = await Promise.all([
          db.follow.findMany({
            where: { followingId: userId },
            skip,
            take: limit,
            include: {
              follower: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  avatar: true,
                  bio: true,
                  createdAt: true
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          }),
          db.follow.count({
            where: { followingId: userId }
          })
        ])
        
        return {
          followers: followers.map(f => f.follower),
          total,
          page,
          totalPages: Math.ceil(total / limit)
        }
        
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get followers'
        })
      }
    }),

  /**
   * Get following
   */
  getFollowing: protectedProcedure
    .input(z.object({
      userId: z.string().optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
    }).optional())
    .query(async ({ input = {}, ctx }) => {
      try {
        const { userId = ctx.user.id, page = 1, limit = 20 } = input
        const skip = (page - 1) * limit
        
        const [following, total] = await Promise.all([
          db.follow.findMany({
            where: { followerId: userId },
            skip,
            take: limit,
            include: {
              following: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  avatar: true,
                  bio: true,
                  createdAt: true
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          }),
          db.follow.count({
            where: { followerId: userId }
          })
        ])
        
        return {
          following: following.map(f => f.following),
          total,
          page,
          totalPages: Math.ceil(total / limit)
        }
        
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get following list'
        })
      }
    }),

  // ============================================================================
  // USER PROFILES
  // ============================================================================

  /**
   * Get public user profile
   */
  getUserProfile: publicProcedure
    .input(z.object({
      username: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const logContext = extractLogContext(ctx.req)
      
      try {
        const user = await db.user.findUnique({
          where: { username: input.username },
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            bio: true,
            createdAt: true,
            role: true,
          }
        })
        
        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found'
          })
        }
        
        // Get privacy settings
        const privacy = await db.userPrivacySettings.findUnique({
          where: { userId: user.id }
        })
        
        const privacySettings = privacy || {
          profileVisibility: 'public',
          listVisibility: 'public',
          activityVisibility: 'public',
          friendsVisibility: 'public',
          reviewsVisibility: 'public',
          hiddenAnimeIds: []
        }
        
        // Check if current user can view this profile
        const canView = await canViewProfile(user.id, ctx.user?.id, privacySettings.profileVisibility)
        
        if (!canView) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'This profile is private'
          })
        }
        
        // Get stats
        const [followersCount, followingCount, friendsCount, animeCount, reviewsCount] = await Promise.all([
          db.follow.count({ where: { followingId: user.id } }),
          db.follow.count({ where: { followerId: user.id } }),
          db.friendship.count({
            where: {
              OR: [
                { user1Id: user.id },
                { user2Id: user.id }
              ]
            }
          }),
          db.userAnimeList.count({ where: { userId: user.id } }),
          db.userAnimeReview.count({ where: { userId: user.id, isPublic: true } })
        ])
        
        logger.info('User profile viewed', logContext, {
          username: input.username,
          viewerId: ctx.user?.id
        })
        
        return {
          user,
          stats: {
            followers: followersCount,
            following: followingCount,
            friends: friendsCount,
            animeCount,
            reviewsCount
          },
          privacy: privacySettings
        }
        
      } catch (error) {
        if (error instanceof TRPCError) throw error
        
        logger.error('Failed to get user profile', error as Error, logContext)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to load user profile'
        })
      }
    }),

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================

  /**
   * Get notifications for current user
   */
  getNotifications: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(50).default(20),
      unreadOnly: z.boolean().default(false),
    }).optional())
    .query(async ({ input = {}, ctx }) => {
      try {
        const { page = 1, limit = 20, unreadOnly = false } = input
        const skip = (page - 1) * limit
        
        const where = {
          userId: ctx.user.id,
          ...(unreadOnly && { isRead: false })
        }
        
        const [notifications, total, unreadCount] = await Promise.all([
          db.notification.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' }
          }),
          db.notification.count({ where }),
          db.notification.count({
            where: { userId: ctx.user.id, isRead: false }
          })
        ])
        
        return {
          notifications,
          total,
          unreadCount,
          page,
          totalPages: Math.ceil(total / limit)
        }
        
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get notifications'
        })
      }
    }),

  /**
   * Mark notification as read
   */
  markNotificationRead: protectedProcedure
    .input(z.object({
      notificationId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await db.notification.updateMany({
          where: {
            id: input.notificationId,
            userId: ctx.user.id // Ensure user owns the notification
          },
          data: { isRead: true }
        })
        
        return { success: true }
        
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to mark notification as read'
        })
      }
    }),

  /**
   * Mark all notifications as read
   */
  markAllNotificationsRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        await db.notification.updateMany({
          where: {
            userId: ctx.user.id,
            isRead: false
          },
          data: { isRead: true }
        })
        
        return { success: true }
        
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to mark all notifications as read'
        })
      }
    }),

  // ============================================================================
  // PRIVACY SETTINGS
  // ============================================================================

  /**
   * Get user privacy settings
   */
  getPrivacySettings: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        let settings = await db.userPrivacySettings.findUnique({
          where: { userId: ctx.user.id }
        })
        
        // Create default settings if none exist
        if (!settings) {
          settings = await db.userPrivacySettings.create({
            data: {
              userId: ctx.user.id
            }
          })
        }
        
        return settings
        
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get privacy settings'
        })
      }
    }),

  /**
   * Update privacy settings
   */
  updatePrivacySettings: protectedProcedure
    .input(z.object({
      profileVisibility: z.enum(['public', 'friends', 'private']).optional(),
      listVisibility: z.enum(['public', 'friends', 'private']).optional(),
      activityVisibility: z.enum(['public', 'friends', 'private']).optional(),
      friendsVisibility: z.enum(['public', 'friends', 'private']).optional(),
      reviewsVisibility: z.enum(['public', 'friends', 'private']).optional(),
      hiddenAnimeIds: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        const settings = await db.userPrivacySettings.upsert({
          where: { userId: ctx.user.id },
          create: {
            userId: ctx.user.id,
            ...input
          },
          update: input
        })
        
        logger.info('Privacy settings updated', logContext, {
          userId: ctx.user.id,
          changes: Object.keys(input)
        })
        
        return settings
        
      } catch (error) {
        logger.error('Failed to update privacy settings', error as Error, logContext)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update privacy settings'
        })
      }
    }),

  /**
   * Hide specific anime from list (guilty pleasures!)
   */
  hideAnimeFromList: protectedProcedure
    .input(z.object({
      animeId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const settings = await db.userPrivacySettings.upsert({
          where: { userId: ctx.user.id },
          create: {
            userId: ctx.user.id,
            hiddenAnimeIds: [input.animeId]
          },
          update: {
            hiddenAnimeIds: {
              push: input.animeId
            }
          }
        })
        
        return { success: true }
        
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to hide anime'
        })
      }
    }),

  /**
   * Unhide anime from list
   */
  unhideAnimeFromList: protectedProcedure
    .input(z.object({
      animeId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const current = await db.userPrivacySettings.findUnique({
          where: { userId: ctx.user.id }
        })
        
        if (!current) return { success: true }
        
        const updated = current.hiddenAnimeIds.filter((id: string) => id !== input.animeId)
        
        await db.userPrivacySettings.update({
          where: { userId: ctx.user.id },
          data: {
            hiddenAnimeIds: updated
          }
        })
        
        return { success: true }
        
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to unhide anime'
        })
      }
    }),
})

// Helper function to check if user can view profile
async function canViewProfile(
  profileUserId: string,
  viewerId: string | undefined,
  visibility: string
): Promise<boolean> {
  // Public - anyone can view
  if (visibility === 'public') return true
  
  // Private - only owner can view
  if (visibility === 'private') {
    return viewerId === profileUserId
  }
  
  // Friends only - check friendship
  if (visibility === 'friends') {
    if (!viewerId) return false
    if (viewerId === profileUserId) return true
    
    const friendship = await db.friendship.findFirst({
      where: {
        OR: [
          { user1Id: profileUserId, user2Id: viewerId },
          { user1Id: viewerId, user2Id: profileUserId }
        ]
      }
    })
    
    return !!friendship
  }
  
  return false
}
