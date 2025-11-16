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
        // Get both users' lists - cached by Prisma Accelerate
        const [myList, friendList] = await Promise.all([
          db.userAnimeList.findMany({
            where: { userId: ctx.user.id },
            select: {
              animeId: true,
              status: true,
              score: true
            },
            ...getCacheStrategy(300) // 5 minutes
          }),
          db.userAnimeList.findMany({
            where: { userId: input.friendId },
            select: {
              animeId: true,
              status: true,
              score: true
            },
            ...getCacheStrategy(300) // 5 minutes
          })
        ])
        
        // Get anime details for common and recommended anime - cached by Prisma Accelerate
        const allAnimeIds = [...new Set([...myList.map((a: typeof myList[0]) => a.animeId), ...friendList.map((a: typeof friendList[0]) => a.animeId)])]
        const animeDetails = await db.anime.findMany({
          where: { id: { in: allAnimeIds } },
          select: {
            id: true,
            slug: true,
            title: true,
            titleEnglish: true,
            coverImage: true
          },
          ...getCacheStrategy(300) // 5 minutes
        })
        
        const animeMap = new Map(animeDetails.map((a: typeof animeDetails[0]) => [a.id, a]))
        
        const myAnimeIds = new Set(myList.map((a: typeof myList[0]) => a.animeId))
        const friendAnimeIds = new Set(friendList.map((a: typeof friendList[0]) => a.animeId))
        
        // Find common anime
        const commonAnimeIds = [...myAnimeIds].filter(id => friendAnimeIds.has(id))
        const commonAnime = myList
          .filter((a: typeof myList[0]) => commonAnimeIds.includes(a.animeId))
          .map((item: typeof myList[0]) => {
            const friendItem = friendList.find((f: typeof friendList[0]) => f.animeId === item.animeId)
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
          .filter((item: { anime: typeof animeMap extends Map<any, infer V> ? V : any }) => item.anime) // Filter out any missing anime
        
        // Find what friend has that you don't
        const friendHasButYouDont = friendList
          .filter((a: typeof friendList[0]) => !myAnimeIds.has(a.animeId))
          .map((item: typeof friendList[0]) => {
            const anime = animeMap.get(item.animeId)
            return {
              anime,
              friendStatus: item.status,
              friendScore: item.score
            }
          })
          .filter((item: { anime: typeof animeMap extends Map<any, infer V> ? V : any }) => item.anime)
        
        // Find what you have that friend doesn't
        const youHaveButFriendDoesnt = myList
          .filter((a: typeof myList[0]) => !friendAnimeIds.has(a.animeId))
          .map((item: typeof myList[0]) => {
            const anime = animeMap.get(item.animeId)
            return {
              anime,
              myStatus: item.status,
              myScore: item.score
            }
          })
          .filter((item: { anime: typeof animeMap extends Map<any, infer V> ? V : any }) => item.anime)
        
        // Calculate compatibility score
        const totalUnique = myAnimeIds.size + friendAnimeIds.size - commonAnimeIds.length
        const compatibilityScore = totalUnique > 0 
          ? Math.floor((commonAnimeIds.length / totalUnique) * 100)
          : 0
        
        // Find taste similarity (based on ratings of common anime)
        type CommonAnimeItem = typeof commonAnime[0]
        const ratedCommon = commonAnime.filter((a: CommonAnimeItem) => a.myScore && a.friendScore)
        const averageDifference = ratedCommon.length > 0
          ? ratedCommon.reduce((sum: number, a: CommonAnimeItem) => sum + (a.scoreDifference || 0), 0) / ratedCommon.length
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
          orderBy: { updatedAt: 'desc' },
          ...getCacheStrategy(300) // 5 minutes
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
        // Verify all collaborators are friends - cached by Prisma Accelerate
        if (input.collaborators.length > 0) {
          const friendships = await db.friendship.findMany({
            where: {
              OR: [
                { user1Id: ctx.user.id, user2Id: { in: input.collaborators }, status: 'accepted' },
                { user1Id: { in: input.collaborators }, user2Id: ctx.user.id, status: 'accepted' }
              ]
            },
            ...getCacheStrategy(300) // 5 minutes
          })
          
          const friendIds = friendships.map((f: typeof friendships[0]) => 
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
        // Check ownership or collaborator status - cached by Prisma Accelerate
        const list = await db.sharedList.findUnique({
          where: { id: input.listId },
          ...getCacheStrategy(300) // 5 minutes
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

