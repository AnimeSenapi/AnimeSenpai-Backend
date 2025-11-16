/**
 * 🎯 Recommendations Router
 * 
 * Endpoints for personalized anime recommendations.
 * Senpai knows what you'll love!
 */

import { z } from 'zod'
import { router, protectedProcedure, publicProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import {
  getForYouRecommendations,
  getBecauseYouWatchedRecommendations,
  getHiddenGems,
  getTrendingInFavoriteGenres,
  getTrendingAnime,
  getNewReleases,
  getDiscoveryRecommendations,
  getContinueWatchingRecommendations,
  getFansLikeYouRecommendations,
  trackInteraction,
  submitRecommendationFeedback
} from '../lib/recommendations'
import {
  findSimilarAnimeByEmbedding,
  searchBySemanticSimilarity,
  getEmbeddingStats,
  generateAllAnimeEmbeddings
} from '../lib/ml-embeddings'
import { TRPCError } from '@trpc/server'

export const recommendationsRouter = router({
  // Get personalized "For You" feed
  getForYou: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20)
    }).optional())
    .query(async ({ input, ctx }) => {
      const limit = input?.limit || 20
      const recommendations = await getForYouRecommendations(ctx.user.id, limit)
      
      return {
        recommendations: recommendations.map(r => ({
          anime: {
            id: r.anime.id,
            slug: r.anime.slug,
            title: r.anime.title,
            description: r.anime.description,
            coverImage: r.anime.coverImage,
            bannerImage: r.anime.bannerImage,
            year: r.anime.year,
            type: r.anime.type,
            episodes: r.anime.episodes,
            rating: r.anime.rating,
            averageRating: r.anime.averageRating,
            viewCount: r.anime.viewCount,
            tags: r.anime.tags,
            genres: r.anime.genres.map(g => ({
              id: g.genre.id,
              name: g.genre.name,
              slug: g.genre.slug
            }))
          },
          score: r.score,
          reason: r.reason
        })),
        total: recommendations.length
      }
    }),

  // Get "Because You Watched" recommendations
  getBecauseYouWatched: protectedProcedure
    .input(z.object({
      animeId: z.string(),
      limit: z.number().min(1).max(20).default(12)
    }))
    .query(async ({ input, ctx }) => {
      const recommendations = await getBecauseYouWatchedRecommendations(
        ctx.user.id,
        input.animeId,
        input.limit
      )
      
      return {
        recommendations: recommendations.map(r => ({
          anime: {
            id: r.anime.id,
            slug: r.anime.slug,
            title: r.anime.title,
            description: r.anime.description,
            coverImage: r.anime.coverImage,
            year: r.anime.year,
            averageRating: r.anime.averageRating,
            genres: r.anime.genres.map(g => ({
              id: g.genre.id,
              name: g.genre.name,
              slug: g.genre.slug
            }))
          },
          score: r.score,
          reason: r.reason
        }))
      }
    }),

  // Get hidden gems
  getHiddenGems: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(20).default(8)
    }).optional())
    .query(async ({ input, ctx }) => {
      const limit = input?.limit || 8
      const recommendations = await getHiddenGems(ctx.user.id, limit)
      
      return {
        recommendations: recommendations.map(r => ({
          anime: {
            id: r.anime.id,
            slug: r.anime.slug,
            title: r.anime.title,
            coverImage: r.anime.coverImage,
            averageRating: r.anime.averageRating,
            viewCount: r.anime.viewCount,
            genres: r.anime.genres.map(g => ({
              id: g.genre.id,
              name: g.genre.name
            }))
          },
          reason: r.reason
        }))
      }
    }),

  // Get trending in favorite genres
  getTrendingForYou: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(20).default(12)
    }).optional())
    .query(async ({ input, ctx }) => {
      const limit = input?.limit || 12
      const recommendations = await getTrendingInFavoriteGenres(ctx.user.id, limit)
      
      return {
        recommendations: recommendations.map(r => ({
          anime: {
            id: r.anime.id,
            slug: r.anime.slug,
            title: r.anime.title,
            coverImage: r.anime.coverImage,
            averageRating: r.anime.averageRating,
            viewCount: r.anime.viewCount,
            genres: r.anime.genres.map(g => ({
              id: g.genre.id,
              name: g.genre.name
            }))
          },
          reason: r.reason
        }))
      }
    }),

  // Get discovery recommendations (new genres)
  getDiscovery: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(20).default(10)
    }).optional())
    .query(async ({ input, ctx }) => {
      const limit = input?.limit || 10
      const recommendations = await getDiscoveryRecommendations(ctx.user.id, limit)
      
      return {
        recommendations: recommendations.map(r => ({
          anime: {
            id: r.anime.id,
            slug: r.anime.slug,
            title: r.anime.title,
            coverImage: r.anime.coverImage,
            averageRating: r.anime.averageRating,
            genres: r.anime.genres.map(g => ({
              id: g.genre.id,
              name: g.genre.name
            }))
          },
          reason: r.reason
        }))
      }
    }),

  // Get "Fans Like You Also Watched" - Collaborative filtering
  getFansLikeYou: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(20).default(12)
    }).optional())
    .query(async ({ input, ctx }) => {
      const limit = input?.limit || 12
      const recommendations = await getFansLikeYouRecommendations(ctx.user.id, limit)
      
      return {
        recommendations: recommendations.map(r => ({
          anime: {
            id: r.anime.id,
            slug: r.anime.slug,
            title: r.anime.title,
            coverImage: r.anime.coverImage,
            bannerImage: r.anime.bannerImage,
            year: r.anime.year,
            averageRating: r.anime.averageRating,
            viewCount: r.anime.viewCount,
            genres: r.anime.genres.map(g => ({
              id: g.genre.id,
              name: g.genre.name,
              slug: g.genre.slug
            }))
          },
          score: r.score,
          reason: r.reason
        }))
      }
    }),

  // Get continue watching
  getContinueWatching: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(10).default(6)
    }).optional())
    .query(async ({ input, ctx }) => {
      const limit = input?.limit || 6
      const recommendations = await getContinueWatchingRecommendations(ctx.user.id, limit)
      
      return {
        recommendations: recommendations.map(r => ({
          anime: {
            id: r.anime.id,
            slug: r.anime.slug,
            title: r.anime.title,
            coverImage: r.anime.coverImage,
            episodes: r.anime.episodes,
            genres: r.anime.genres.map(g => ({
              id: g.genre.id,
              name: g.genre.name
            }))
          },
          reason: r.reason
        }))
      }
    }),

  // Get trending anime (public, non-personalized)
  getTrending: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(20).default(12)
    }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit || 12
      const recommendations = await getTrendingAnime(limit)
      
      return {
        recommendations: recommendations.map(r => ({
          anime: {
            id: r.anime.id,
            slug: r.anime.slug,
            title: r.anime.title,
            coverImage: r.anime.coverImage,
            averageRating: r.anime.averageRating,
            viewCount: r.anime.viewCount,
            genres: r.anime.genres.map(g => ({
              id: g.genre.id,
              name: g.genre.name
            }))
          }
        }))
      }
    }),

  // Get new releases (public)
  getNewReleases: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(20).default(12)
    }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit || 12
      const recommendations = await getNewReleases(limit)
      
      return {
        recommendations: recommendations.map(r => ({
          anime: {
            id: r.anime.id,
            slug: r.anime.slug,
            title: r.anime.title,
            coverImage: r.anime.coverImage,
            year: r.anime.year,
            genres: r.anime.genres.map(g => ({
              id: g.genre.id,
              name: g.genre.name
            }))
          },
          reason: r.reason
        }))
      }
    }),

  // Submit feedback on recommendation (hide/dismiss)
  submitFeedback: protectedProcedure
    .input(z.object({
      animeId: z.string(),
      feedbackType: z.enum(['dismiss', 'hide', 'not_interested_genre']),
      reason: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      await submitRecommendationFeedback(
        ctx.user.id,
        input.animeId,
        input.feedbackType,
        input.reason
      )
      
      return { success: true }
    }),

  // Track interaction (for analytics and improving recommendations)
  trackInteraction: protectedProcedure
    .input(z.object({
      animeId: z.string().optional(),
      actionType: z.enum(['view_page', 'search', 'click', 'hover', 'add_to_list']),
      metadata: z.any().optional(),
      duration: z.number().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      await trackInteraction(
        ctx.user.id,
        input.animeId || null,
        input.actionType,
        input.metadata,
        input.duration
      )
      
      return { success: true }
    }),

  // Get ML-enhanced similar anime (using embeddings)
  getSimilarByEmbedding: publicProcedure
    .input(z.object({
      animeId: z.string(),
      limit: z.number().min(1).max(20).default(12)
    }))
    .query(async ({ input }) => {
      // Security: Validate anime exists
      const anime = await db.anime.findUnique({
        where: { id: input.animeId },
        select: { id: true }
      })
      
      if (!anime) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Anime not found'
        })
      }
      
      let similar = await findSimilarAnimeByEmbedding(input.animeId, input.limit)
      let useEmbeddings = similar.length > 0
      
      // Fallback to genre-based similarity if no embeddings exist
      if (similar.length === 0) {
        const sourceAnime = await db.anime.findUnique({
          where: { id: input.animeId },
          include: {
            genres: {
              include: {
                genre: true
              }
            }
          }
        })
        
        if (sourceAnime) {
          const genreIds = sourceAnime.genres.map((g: typeof sourceAnime.genres[0]) => g.genreId)
          
          // Find anime with similar genres
          const candidateAnime = await db.anime.findMany({
            where: {
              id: { not: input.animeId },
              genres: {
                some: {
                  genreId: { in: genreIds }
                }
              }
            },
            include: {
              genres: {
                include: {
                  genre: true
                }
              }
            },
            take: input.limit * 2, // Get more to filter down
            orderBy: {
              averageRating: 'desc'
            }
          })
          
          // Score by genre overlap
          similar = candidateAnime.map((anime: typeof candidateAnime[0]) => {
            const animeGenres = anime.genres.map((g: typeof anime.genres[0]) => g.genreId)
            const overlap = genreIds.filter((g: typeof genreIds[0]) => animeGenres.includes(g)).length
            const union = new Set([...genreIds, ...animeGenres]).size
            const similarity = overlap / union
            
            return {
              animeId: anime.id,
              similarity
            }
          })
          .sort((a: { animeId: string; similarity: number }, b: { animeId: string; similarity: number }) => b.similarity - a.similarity)
          .slice(0, input.limit)
        }
      }
      
      // Get anime details
      const animeIds = similar.map(s => s.animeId)
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
      
      const animeMap = new Map<string, typeof animeDetails[0]>(animeDetails.map((a: typeof animeDetails[0]) => [a.id, a]))
      
      return {
        recommendations: similar.map(s => {
          const anime = animeMap.get(s.animeId)
          if (!anime) return null
          
          return {
            anime: {
              id: anime.id,
              slug: anime.slug,
              title: anime.title,
              titleEnglish: anime.titleEnglish,
              titleJapanese: anime.titleJapanese,
              coverImage: anime.coverImage,
              year: anime.year,
              averageRating: anime.averageRating,
              genres: anime.genres.map((g: typeof anime.genres[0]) => ({
                id: g.genre.id,
                name: g.genre.name
              }))
            },
            similarity: s.similarity,
            reason: useEmbeddings ? 'Semantically similar' : 'Similar genres'
          }
        }).filter(Boolean)
      }
    }),

  // Semantic search (ML-powered search by description)
  semanticSearch: publicProcedure
    .input(z.object({
      query: z.string().min(3).max(500), // Security: Length limits
      limit: z.number().min(1).max(20).default(10)
    }))
    .query(async ({ input }) => {
      const results = await searchBySemanticSimilarity(
        input.query,
        input.limit
      )
      
      // Get anime details
      const animeIds = results.map(r => r.animeId)
      const animeDetails = await db.anime.findMany({
        where: { id: { in: animeIds } },
        include: {
          genres: {
            include: { genre: true }
            }
          }
        })
      
      const animeMap = new Map<string, typeof animeDetails[0]>(animeDetails.map((a: typeof animeDetails[0]) => [a.id, a]))
      
      return {
        results: results.map(r => {
          const anime = animeMap.get(r.animeId)
          if (!anime) return null
          
          return {
            anime: {
              id: anime.id,
              slug: anime.slug,
              title: anime.title,
              description: anime.description,
              coverImage: anime.coverImage,
              year: anime.year,
              averageRating: anime.averageRating,
              genres: anime.genres.map((g: typeof anime.genres[0]) => ({
                id: g.genre.id,
                name: g.genre.name
              }))
            },
            similarity: r.similarity
          }
        }).filter(Boolean)
      }
    }),

  // Get embedding statistics (for monitoring)
  getEmbeddingStats: protectedProcedure
    .query(async ({ ctx }) => {
      // Security: Only allow admins to see stats
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required'
        })
      }
      
      return await getEmbeddingStats()
    }),

  // Generate embeddings for all anime (admin only)
  generateEmbeddings: protectedProcedure
    .input(z.object({
      batchSize: z.number().min(10).max(100).default(50)
    }).optional())
    .mutation(async ({ input, ctx }) => {
      // Security: Only admins can trigger embedding generation
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required'
        })
      }
      
      const batchSize = input?.batchSize || 50
      const result = await generateAllAnimeEmbeddings(batchSize)
      
      return {
        success: true,
        processed: result.processed,
        errors: result.errors
      }
    }),

  /**
   * Get "Friends who liked this also watched" recommendations
   * Phase 2 Social Feature
   */
  getFriendsAlsoWatched: protectedProcedure
    .input(z.object({
      animeId: z.string(),
      limit: z.number().min(1).max(20).default(10)
    }))
    .query(async ({ ctx, input }) => {
      try {
        // Get user's friends
        const friendships = await db.friendship.findMany({
          where: {
            OR: [
              { user1Id: ctx.user.id, status: 'accepted' },
              { user2Id: ctx.user.id, status: 'accepted' }
            ]
          },
          select: {
            user1Id: true,
            user2Id: true
          }
        })
        
        const friendIds = friendships.map((f: typeof friendships[0]) => 
          f.user1Id === ctx.user.id ? f.user2Id : f.user1Id
        )
        
        if (friendIds.length === 0) {
          return { recommendations: [] }
        }
        
        // Find friends who liked/rated this anime highly
        const friendsWhoLiked = await db.userAnimeList.findMany({
          where: {
            animeId: input.animeId,
            userId: { in: friendIds },
            score: { gte: 7 } // 7+ rating means they liked it
          },
          select: {
            userId: true
          }
        })
        
        const friendsWhoLikedIds = friendsWhoLiked.map((f: typeof friendsWhoLiked[0]) => f.userId)
        
        if (friendsWhoLikedIds.length === 0) {
          return { recommendations: [] }
        }
        
        // Get what those friends also watched and liked
        const otherAnime = await db.userAnimeList.findMany({
          where: {
            userId: { in: friendsWhoLikedIds },
            animeId: { not: input.animeId }, // Exclude current anime
            score: { gte: 7 }, // They also liked these
          },
          select: {
            animeId: true,
            score: true,
            userId: true
          }
        })
        
        // Count how many friends liked each anime
        const animeCounts = otherAnime.reduce((acc: Record<string, { count: number; totalScore: number; friendIds: string[] }>, item: typeof otherAnime[0]) => {
          if (!acc[item.animeId]) {
            acc[item.animeId] = {
              count: 0,
              totalScore: 0,
              friendIds: []
            }
          }
          const animeEntry = acc[item.animeId]!
          animeEntry.count++
          animeEntry.totalScore += item.score || 0
          animeEntry.friendIds.push(item.userId)
          return acc
        }, {} as Record<string, { count: number; totalScore: number; friendIds: string[] }>)
        
        // Sort by number of friends who liked it, then by average score
        const sortedAnimeIds = (Object.entries(animeCounts) as [string, { count: number; totalScore: number; friendIds: string[] }][])
          .sort((a, b) => {
            if (b[1].count !== a[1].count) {
              return b[1].count - a[1].count
            }
            return (b[1].totalScore / b[1].count) - (a[1].totalScore / a[1].count)
          })
          .slice(0, input.limit)
          .map(([animeId]) => animeId)
        
        // Fetch anime details
        const recommendations = await db.anime.findMany({
          where: {
            id: { in: sortedAnimeIds }
          },
          include: {
            genres: {
              include: {
                genre: true
              }
            }
          }
        })
        
        // Sort recommendations to match the sorted order
        const sortedRecommendations = sortedAnimeIds
          .map(id => recommendations.find((a: typeof recommendations[0]) => a.id === id))
          .filter(Boolean)
          .map(anime => ({
            anime: {
              id: anime!.id,
              slug: anime!.slug,
              title: anime!.title,
              titleEnglish: anime!.titleEnglish,
              titleJapanese: anime!.titleJapanese,
              titleSynonyms: anime!.titleSynonyms,
              coverImage: anime!.coverImage,
              year: anime!.year,
              averageRating: anime!.averageRating,
              genres: anime!.genres.map((g: typeof recommendations[0]['genres'][0]) => ({
                id: g.genre.id,
                name: g.genre.name
              }))
            },
            reason: `${animeCounts[anime!.id].count} friend${animeCounts[anime!.id].count > 1 ? 's' : ''} who liked this also watched`,
            score: animeCounts[anime!.id].totalScore / animeCounts[anime!.id].count,
            friendCount: animeCounts[anime!.id].count
          }))
        
        return {
          recommendations: sortedRecommendations
        }
        
      } catch (error) {
        throw error
      }
    })
})

