/**
 * List Tools Router - Phase 3 Social Features
 * 
 * Advanced list features:
 * - Compare lists with friends
 * - Find common anime
 * - List compatibility score
 * - Shared list collaboration
 */

import { z } from 'zod'
import { router, protectedProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import { TRPCError } from '@trpc/server'
import { logger, extractLogContext } from '../lib/logger'

export const listToolsRouter = router({
  /**
   * Compare your list with a friend's list
   */
  compareWithFriend: protectedProcedure
    .input(z.object({
      friendId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        // Get both users' lists
        const [myList, friendList] = await Promise.all([
          db.userAnimeList.findMany({
            where: { userId: ctx.user.id },
            select: {
              animeId: true,
              status: true,
              score: true
            }
          }),
          db.userAnimeList.findMany({
            where: { userId: input.friendId },
            select: {
              animeId: true,
              status: true,
              score: true
            }
          })
        ])
        
        // Get anime details for common and recommended anime
        const allAnimeIds = [...new Set([...myList.map(a => a.animeId), ...friendList.map(a => a.animeId)])]
        const animeDetails = await db.anime.findMany({
          where: { id: { in: allAnimeIds } },
          select: {
            id: true,
            slug: true,
            title: true,
            titleEnglish: true,
            coverImage: true
          }
        })
        
        const animeMap = new Map(animeDetails.map(a => [a.id, a]))
        
        const myAnimeIds = new Set(myList.map(a => a.animeId))
        const friendAnimeIds = new Set(friendList.map(a => a.animeId))
        
        // Find common anime
        const commonAnimeIds = [...myAnimeIds].filter(id => friendAnimeIds.has(id))
        const commonAnime = myList
          .filter(a => commonAnimeIds.includes(a.animeId))
          .map(item => {
            const friendItem = friendList.find(f => f.animeId === item.animeId)
            const anime = animeMap.get(item.animeId)
            return {
              anime,
              myStatus: item.status,
              myScore: item.score,
              friendStatus: friendItem?.status,
              friendScore: friendItem?.score,
              scoreDifference: item.score && friendItem?.score 
                ? Math.abs(item.score - friendItem.score)
                : null
            }
          })
          .filter(item => item.anime) // Filter out any missing anime
        
        // Find what friend has that you don't
        const friendHasButYouDont = friendList
          .filter(a => !myAnimeIds.has(a.animeId))
          .map(item => {
            const anime = animeMap.get(item.animeId)
            return {
              anime,
              friendStatus: item.status,
              friendScore: item.score
            }
          })
          .filter(item => item.anime)
        
        // Find what you have that friend doesn't
        const youHaveButFriendDoesnt = myList
          .filter(a => !friendAnimeIds.has(a.animeId))
          .map(item => {
            const anime = animeMap.get(item.animeId)
            return {
              anime,
              myStatus: item.status,
              myScore: item.score
            }
          })
          .filter(item => item.anime)
        
        // Calculate compatibility score
        const totalUnique = myAnimeIds.size + friendAnimeIds.size - commonAnimeIds.length
        const compatibilityScore = totalUnique > 0 
          ? Math.floor((commonAnimeIds.length / totalUnique) * 100)
          : 0
        
        // Find taste similarity (based on ratings of common anime)
        const ratedCommon = commonAnime.filter(a => a.myScore && a.friendScore)
        const averageDifference = ratedCommon.length > 0
          ? ratedCommon.reduce((sum, a) => sum + (a.scoreDifference || 0), 0) / ratedCommon.length
          : 0
        const tasteSimilarity = Math.max(0, 100 - (averageDifference * 10))
        
        logger.info('Lists compared', logContext, {
          userId: ctx.user.id,
          friendId: input.friendId,
          commonCount: commonAnimeIds.length,
          compatibilityScore
        })
        
        return {
          common: commonAnime,
          friendRecommendations: friendHasButYouDont.slice(0, 20),
          yourRecommendations: youHaveButFriendDoesnt.slice(0, 20),
          stats: {
            myTotal: myList.length,
            friendTotal: friendList.length,
            commonCount: commonAnimeIds.length,
            compatibilityScore,
            tasteSimilarity: Math.floor(tasteSimilarity)
          }
        }
        
      } catch (error) {
        logger.error('Failed to compare lists', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Get shared lists (collaborative lists)
   */
  getSharedLists: protectedProcedure
    .query(async ({ ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        const sharedLists = await db.sharedList.findMany({
          where: {
            OR: [
              { ownerId: ctx.user.id },
              { collaborators: { has: ctx.user.id } }
            ]
          },
          include: {
            owner: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true
              }
            }
          },
          orderBy: { updatedAt: 'desc' }
        })
        
        return {
          sharedLists
        }
        
      } catch (error) {
        logger.error('Failed to fetch shared lists', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Create a shared list
   */
  createSharedList: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      animeIds: z.array(z.string()).default([]),
      collaborators: z.array(z.string()).default([]),
      isPublic: z.boolean().default(false)
    }))
    .mutation(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        // Verify all collaborators are friends
        if (input.collaborators.length > 0) {
          const friendships = await db.friendship.findMany({
            where: {
              OR: [
                { user1Id: ctx.user.id, user2Id: { in: input.collaborators }, status: 'accepted' },
                { user1Id: { in: input.collaborators }, user2Id: ctx.user.id, status: 'accepted' }
              ]
            }
          })
          
          const friendIds = friendships.map(f => 
            f.user1Id === ctx.user.id ? f.user2Id : f.user1Id
          )
          
          const invalidCollaborators = input.collaborators.filter(id => !friendIds.includes(id))
          if (invalidCollaborators.length > 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Some collaborators are not your friends'
            })
          }
        }
        
        const sharedList = await db.sharedList.create({
          data: {
            ownerId: ctx.user.id,
            name: input.name,
            description: input.description,
            animeIds: input.animeIds,
            collaborators: input.collaborators,
            isPublic: input.isPublic
          }
        })
        
        logger.info('Shared list created', logContext, {
          userId: ctx.user.id,
          listId: sharedList.id,
          collaboratorCount: input.collaborators.length
        })
        
        return {
          success: true,
          sharedList
        }
        
      } catch (error) {
        logger.error('Failed to create shared list', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Update shared list
   */
  updateSharedList: protectedProcedure
    .input(z.object({
      listId: z.string(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      animeIds: z.array(z.string()).optional(),
      collaborators: z.array(z.string()).optional(),
      isPublic: z.boolean().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        // Check ownership or collaborator status
        const list = await db.sharedList.findUnique({
          where: { id: input.listId }
        })
        
        if (!list) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Shared list not found'
          })
        }
        
        const isOwner = list.ownerId === ctx.user.id
        const isCollaborator = list.collaborators.includes(ctx.user.id)
        
        if (!isOwner && !isCollaborator) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have permission to edit this list'
          })
        }
        
        // Only owner can change collaborators or make public
        if (!isOwner && (input.collaborators || input.isPublic !== undefined)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Only the owner can change collaborators or publicity'
          })
        }
        
        const updated = await db.sharedList.update({
          where: { id: input.listId },
          data: {
            ...(input.name && { name: input.name }),
            ...(input.description !== undefined && { description: input.description }),
            ...(input.animeIds && { animeIds: input.animeIds }),
            ...(input.collaborators && { collaborators: input.collaborators }),
            ...(input.isPublic !== undefined && { isPublic: input.isPublic })
          }
        })
        
        logger.info('Shared list updated', logContext, {
          userId: ctx.user.id,
          listId: input.listId
        })
        
        return {
          success: true,
          sharedList: updated
        }
        
      } catch (error) {
        logger.error('Failed to update shared list', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    })
})

