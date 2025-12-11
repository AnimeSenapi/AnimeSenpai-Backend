/**
 * Grouping Router
 * 
 * Handles anime grouping queries and feedback collection
 */

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure, publicProcedure } from '../lib/trpc.js'
import { db } from '../lib/db.js'
import { getAnimeGrouping, groupAnimeWithLearning } from '../lib/enhanced-grouping.js'
import { learnFromFeedback } from '../lib/grouping-learning.js'

export const groupingRouter = router({
  /**
   * Get grouping information for a specific anime
   */
  getAnimeGrouping: publicProcedure
    .input(
      z.object({
        animeId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const anime = await db.anime.findUnique({
        where: { id: input.animeId },
        select: { id: true },
      })

      if (!anime) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Anime not found',
        })
      }

      const grouping = await getAnimeGrouping(input.animeId)
      return grouping
    }),

  /**
   * Group a list of anime
   */
  groupAnime: publicProcedure
    .input(
      z.object({
        animeIds: z.array(z.string()).max(1000), // Limit to prevent performance issues
      })
    )
    .query(async ({ input }) => {
      // Fetch anime data
      const animeList = await db.anime.findMany({
        where: {
          id: { in: input.animeIds },
        },
        select: {
          id: true,
          title: true,
          titleEnglish: true,
          year: true,
          studio: true,
          slug: true,
          coverImage: true,
          averageRating: true,
        },
      })

      if (animeList.length === 0) {
        return []
      }

      // Group anime with learning
      const groups = await groupAnimeWithLearning(animeList)
      return groups
    }),

  /**
   * Submit feedback on grouping
   */
  submitGroupingFeedback: protectedProcedure
    .input(
      z.object({
        animeId: z.string(),
        groupType: z.enum(['series', 'franchise', 'ungrouped']),
        action: z.enum(['merge', 'split', 'correct', 'create_group']),
        sourceGroupId: z.string().optional(),
        targetGroupId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Verify anime exists
      const anime = await db.anime.findUnique({
        where: { id: input.animeId },
        select: { id: true },
      })

      if (!anime) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Anime not found',
        })
      }

      // Learn from feedback
      await learnFromFeedback({
        animeId: input.animeId,
        groupType: input.groupType,
        action: input.action,
        sourceGroupId: input.sourceGroupId ?? null,
        targetGroupId: input.targetGroupId ?? null,
      })

      return { success: true }
    }),

  /**
   * Get low-confidence groupings for admin review
   */
  suggestGroupingCorrections: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        minConfidence: z.number().min(0).max(1).default(0.6),
      })
    )
    .query(async () => {
      // Check if user is admin (you'll need to implement this check based on your auth system)
      // For now, we'll allow any authenticated user to see suggestions

      // This would require storing grouping results with confidence scores
      // For now, return empty array as this is a future enhancement
      return []
    }),
})
