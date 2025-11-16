/**
 * Enhanced Notifications Router - Phase 2 Social Features
 * 
 * Handles:
 * - Push notification subscriptions
 * - Notification preferences
 * - Sending push notifications
 */

import { z } from 'zod'
import { router, protectedProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import { logger, extractLogContext } from '../lib/logger'

export const notificationsRouter = router({
  /**
   * Subscribe to push notifications
   */
  subscribeToPush: protectedProcedure
    .input(z.object({
      endpoint: z.string(),
      keys: z.object({
        p256dh: z.string(),
        auth: z.string()
      }),
      userAgent: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        // Check if subscription already exists
        const existing = await db.pushSubscription.findUnique({
          where: { endpoint: input.endpoint }
        })
        
        if (existing) {
          // Update existing subscription
          await db.pushSubscription.update({
            where: { endpoint: input.endpoint },
            data: {
              lastUsed: new Date(),
              userAgent: input.userAgent
            }
          })
          
          return {
            success: true,
            subscription: existing
          }
        }
        
        // Create new subscription
        const subscription = await db.pushSubscription.create({
          data: {
            userId: ctx.user.id,
            endpoint: input.endpoint,
            keys: JSON.stringify(input.keys),
            userAgent: input.userAgent
          }
        })
        
        logger.info('Push notification subscription created', logContext, {
          userId: ctx.user.id,
          subscriptionId: subscription.id
        })
        
        return {
          success: true,
          subscription
        }
        
      } catch (error) {
        logger.error('Failed to subscribe to push notifications', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Unsubscribe from push notifications
   */
  unsubscribeFromPush: protectedProcedure
    .input(z.object({
      endpoint: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        await db.pushSubscription.deleteMany({
          where: {
            userId: ctx.user.id,
            endpoint: input.endpoint
          }
        })
        
        logger.info('Push notification subscription removed', logContext, {
          userId: ctx.user.id,
          endpoint: input.endpoint
        })
        
        return {
          success: true
        }
        
      } catch (error) {
        logger.error('Failed to unsubscribe from push notifications', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Get all push subscriptions for user
   */
  getMySubscriptions: protectedProcedure
    .query(async ({ ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        const subscriptions = await db.pushSubscription.findMany({
          where: { userId: ctx.user.id },
          orderBy: { lastUsed: 'desc' }
        })
        
        return {
          subscriptions: subscriptions.map((sub: typeof subscriptions[0]) => ({
            id: sub.id,
            endpoint: sub.endpoint,
            userAgent: sub.userAgent,
            createdAt: sub.createdAt,
            lastUsed: sub.lastUsed
          }))
        }
        
      } catch (error) {
        logger.error('Failed to fetch push subscriptions', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Get all notifications for user
   */
  getNotifications: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      cursor: z.string().optional(),
      unreadOnly: z.boolean().default(false)
    }).optional())
    .query(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      const limit = input?.limit || 20
      const cursor = input?.cursor
      const unreadOnly = input?.unreadOnly || false
      
      try {
        const notifications = await db.notification.findMany({
          where: {
            userId: ctx.user.id,
            ...(unreadOnly ? { isRead: false } : {}),
            ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {})
          },
          take: limit + 1,
          orderBy: { createdAt: 'desc' }
        })
        
        let nextCursor: string | null = null
        if (notifications.length > limit) {
          const nextItem = notifications.pop()
          nextCursor = nextItem!.createdAt.toISOString()
        }
        
        return {
          notifications,
          nextCursor
        }
        
      } catch (error) {
        logger.error('Failed to fetch notifications', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Mark notification as read
   */
  markAsRead: protectedProcedure
    .input(z.object({
      notificationId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        await db.notification.updateMany({
          where: {
            id: input.notificationId,
            userId: ctx.user.id
          },
          data: {
            isRead: true
          }
        })
        
        return {
          success: true
        }
        
      } catch (error) {
        logger.error('Failed to mark notification as read', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Mark all notifications as read
   */
  markAllAsRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        const result = await db.notification.updateMany({
          where: {
            userId: ctx.user.id,
            isRead: false
          },
          data: {
            isRead: true
          }
        })
        
        logger.info('All notifications marked as read', logContext, {
          userId: ctx.user.id,
          count: result.count
        })
        
        return {
          success: true,
          count: result.count
        }
        
      } catch (error) {
        logger.error('Failed to mark all notifications as read', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Get unread notification count
   */
  getUnreadCount: protectedProcedure
    .query(async ({ ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        const count = await db.notification.count({
          where: {
            userId: ctx.user.id,
            isRead: false
          }
        })
        
        return {
          count
        }
        
      } catch (error) {
        logger.error('Failed to fetch unread count', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Delete notification
   */
  deleteNotification: protectedProcedure
    .input(z.object({
      notificationId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        await db.notification.deleteMany({
          where: {
            id: input.notificationId,
            userId: ctx.user.id
          }
        })
        
        return {
          success: true
        }
        
      } catch (error) {
        logger.error('Failed to delete notification', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Clear all read notifications
   */
  clearReadNotifications: protectedProcedure
    .mutation(async ({ ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        const result = await db.notification.deleteMany({
          where: {
            userId: ctx.user.id,
            isRead: true
          }
        })
        
        logger.info('Read notifications cleared', logContext, {
          userId: ctx.user.id,
          count: result.count
        })
        
        return {
          success: true,
          count: result.count
        }
        
      } catch (error) {
        logger.error('Failed to clear read notifications', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    })
})

