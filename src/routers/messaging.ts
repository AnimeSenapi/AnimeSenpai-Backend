/**
 * Messaging Router - Phase 3 Social Features
 * 
 * Simple messaging system for anime recommendations between friends.
 * Focus: Recommend anime to friends, not general chat.
 */

import { z } from 'zod'
import { router, protectedProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import { TRPCError } from '@trpc/server'
import { logger, extractLogContext } from '../lib/logger'
import { checkRateLimit } from '../lib/rate-limiter'

export const messagingRouter = router({
  /**
   * Send a message to a friend
   */
  sendMessage: protectedProcedure
    .input(z.object({
      receiverId: z.string(),
      content: z.string().min(1).max(500),
      animeId: z.string().optional() // Optional anime recommendation
    }))
    .mutation(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        // Rate limit: 50 messages per user
        checkRateLimit(ctx.user.id, 'authenticated', 'send-message')
        
        // Check if users are friends
        const friendship = await db.friendship.findFirst({
          where: {
            OR: [
              { user1Id: ctx.user.id, user2Id: input.receiverId, status: 'accepted' },
              { user1Id: input.receiverId, user2Id: ctx.user.id, status: 'accepted' }
            ]
          }
        })
        
        if (!friendship) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You can only message friends'
          })
        }
        
        // Check if receiver allows messages
        const receiverPrivacy = await db.userPrivacySettings.findUnique({
          where: { userId: input.receiverId }
        })
        
        if (receiverPrivacy && !receiverPrivacy.allowMessages) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'This user has disabled direct messages'
          })
        }
        
        // Check if sender is blocked
        const isBlocked = await db.blockedUser.findFirst({
          where: {
            userId: input.receiverId,
            blockedId: ctx.user.id
          }
        })
        
        if (isBlocked) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You cannot message this user'
          })
        }
        
        // Create message
        const message = await db.message.create({
          data: {
            senderId: ctx.user.id,
            receiverId: input.receiverId,
            content: input.content,
            animeId: input.animeId
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true
              }
            },
            anime: input.animeId ? {
              select: {
                id: true,
                slug: true,
                title: true,
                titleEnglish: true,
                coverImage: true
              }
            } : undefined
          }
        })
        
        // Create notification
        await db.notification.create({
          data: {
            userId: input.receiverId,
            fromUserId: ctx.user.id,
            type: input.animeId ? 'anime_recommended' : 'message_received',
            animeId: input.animeId,
            relatedId: message.id,
            message: input.animeId 
              ? `${ctx.user.username} recommended an anime to you`
              : `${ctx.user.username} sent you a message`,
            actionUrl: `/messages/${ctx.user.id}`
          }
        })
        
        logger.info('Message sent', logContext, {
          userId: ctx.user.id,
          receiverId: input.receiverId,
          hasAnime: !!input.animeId
        })
        
        return {
          success: true,
          message
        }
        
      } catch (error) {
        logger.error('Failed to send message', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Get conversations (list of users messaged with)
   */
  getConversations: protectedProcedure
    .query(async ({ ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        // Get all unique users we've messaged with
        const sentTo = await db.message.findMany({
          where: { senderId: ctx.user.id },
          select: { receiverId: true },
          distinct: ['receiverId']
        })
        
        const receivedFrom = await db.message.findMany({
          where: { receiverId: ctx.user.id },
          select: { senderId: true },
          distinct: ['senderId']
        })
        
        const userIds = [
          ...sentTo.map(m => m.receiverId),
          ...receivedFrom.map(m => m.senderId)
        ]
        const uniqueUserIds = [...new Set(userIds)]
        
        // Get user details and last message for each conversation
        const conversations = await Promise.all(
          uniqueUserIds.map(async (userId) => {
            const user = await db.user.findUnique({
              where: { id: userId },
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true
              }
            })
            
            const lastMessage = await db.message.findFirst({
              where: {
                OR: [
                  { senderId: ctx.user.id, receiverId: userId },
                  { senderId: userId, receiverId: ctx.user.id }
                ]
              },
              orderBy: { createdAt: 'desc' },
              include: {
                anime: {
                  select: {
                    slug: true,
                    title: true,
                    titleEnglish: true
                  }
                }
              }
            })
            
            const unreadCount = await db.message.count({
              where: {
                senderId: userId,
                receiverId: ctx.user.id,
                isRead: false
              }
            })
            
            return {
              user,
              lastMessage,
              unreadCount
            }
          })
        )
        
        // Sort by last message timestamp
        conversations.sort((a, b) => {
          const aTime = a.lastMessage?.createdAt?.getTime() || 0
          const bTime = b.lastMessage?.createdAt?.getTime() || 0
          return bTime - aTime
        })
        
        return {
          conversations
        }
        
      } catch (error) {
        logger.error('Failed to fetch conversations', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Get messages with a specific user
   */
  getMessages: protectedProcedure
    .input(z.object({
      userId: z.string(),
      limit: z.number().min(1).max(50).default(50),
      cursor: z.string().optional()
    }))
    .query(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        const messages = await db.message.findMany({
          where: {
            OR: [
              { senderId: ctx.user.id, receiverId: input.userId },
              { senderId: input.userId, receiverId: ctx.user.id }
            ],
            ...(input.cursor ? { createdAt: { lt: new Date(input.cursor) } } : {})
          },
          take: input.limit + 1,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true
              }
            },
            anime: {
              select: {
                id: true,
                slug: true,
                title: true,
                titleEnglish: true,
                coverImage: true
              }
            }
          }
        })
        
        let nextCursor: string | null = null
        if (messages.length > input.limit) {
          const nextItem = messages.pop()
          nextCursor = nextItem!.createdAt.toISOString()
        }
        
        // Mark messages from other user as read
        await db.message.updateMany({
          where: {
            senderId: input.userId,
            receiverId: ctx.user.id,
            isRead: false
          },
          data: {
            isRead: true
          }
        })
        
        return {
          messages: messages.reverse(), // Oldest first for chat display
          nextCursor
        }
        
      } catch (error) {
        logger.error('Failed to fetch messages', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Get unread message count
   */
  getUnreadCount: protectedProcedure
    .query(async ({ ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        const count = await db.message.count({
          where: {
            receiverId: ctx.user.id,
            isRead: false
          }
        })
        
        return {
          count
        }
        
      } catch (error) {
        logger.error('Failed to fetch unread message count', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Delete a message
   */
  deleteMessage: protectedProcedure
    .input(z.object({
      messageId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        // Check if message belongs to user (sender only can delete)
        const message = await db.message.findUnique({
          where: { id: input.messageId }
        })
        
        if (!message) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Message not found'
          })
        }
        
        if (message.senderId !== ctx.user.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You can only delete your own messages'
          })
        }
        
        await db.message.delete({
          where: { id: input.messageId }
        })
        
        logger.info('Message deleted', logContext, {
          userId: ctx.user.id,
          messageId: input.messageId
        })
        
        return {
          success: true
        }
        
      } catch (error) {
        logger.error('Failed to delete message', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    })
})

