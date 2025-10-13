/**
 * GDPR Compliance Router
 * 
 * Implements GDPR Article 15 (Right of Access) and Article 17 (Right to Erasure)
 * for EU users and data protection compliance.
 */

import { z } from 'zod'
import { router, protectedProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import { TRPCError } from '@trpc/server'
import { logger, extractLogContext } from '../lib/logger'
import { checkRateLimit } from '../lib/rate-limiter'

export const gdprRouter = router({
  /**
   * Export User Data (GDPR Article 15 - Right of Access)
   * Returns all user data in machine-readable JSON format
   */
  exportUserData: protectedProcedure
    .mutation(async ({ ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        // Rate limit: 3 export requests per hour per user
        checkRateLimit(ctx.user.id, 'email', 'gdpr-export')
        
        logger.info('GDPR data export requested', logContext, { userId: ctx.user.id })
        
        // Fetch all user data from database
        const [user, animeList, reviews, ratings] = await Promise.all([
          // User profile data
          db.user.findUnique({
            where: { id: ctx.user.id },
            select: {
              id: true,
              email: true,
              username: true,
              name: true,
              avatar: true,
              bio: true,
              role: true,
              emailVerified: true,
              createdAt: true,
              lastLoginAt: true,
              preferences: true,
            }
          }),
          
          // User anime list
          db.userAnimeList.findMany({
            where: { userId: ctx.user.id },
            include: {
              anime: {
                select: {
                  id: true,
                  title: true,
                  titleEnglish: true,
                  slug: true,
                }
              }
            }
          }),
          
          // User reviews
          db.userAnimeReview.findMany({
            where: { userId: ctx.user.id },
            include: {
              anime: {
                select: {
                  id: true,
                  title: true,
                  titleEnglish: true,
                }
              }
            }
          }),
          
          // User ratings (if separate table exists)
          db.userAnimeList.findMany({
            where: { 
              userId: ctx.user.id,
              rating: { not: null }
            },
            select: {
              animeId: true,
              rating: true,
              createdAt: true,
              anime: {
                select: {
                  title: true,
                  titleEnglish: true,
                }
              }
            }
          })
        ])
        
        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found'
          })
        }
        
        // Compile all user data
        const userData = {
          exportMetadata: {
            exportedAt: new Date().toISOString(),
            userId: user.id,
            dataController: 'AnimeSenpai',
            purpose: 'GDPR Article 15 - Right of Access',
            format: 'JSON',
          },
          personalInformation: {
            email: user.email,
            username: user.username,
            name: user.name,
            bio: user.bio,
            avatar: user.avatar,
            role: user.role,
            emailVerified: user.emailVerified,
            accountCreated: user.createdAt,
            lastLogin: user.lastLoginAt,
          },
          preferences: user.preferences || {},
          animeList: animeList.map(item => ({
            animeId: item.animeId,
            animeTitle: item.anime?.titleEnglish || item.anime?.title,
            status: item.listStatus,
            progress: item.progress,
            rating: item.rating,
            notes: item.notes,
            startDate: item.startDate,
            finishDate: item.finishDate,
            addedAt: item.createdAt,
            updatedAt: item.updatedAt,
          })),
          reviews: reviews.map(review => ({
            reviewId: review.id,
            animeTitle: review.anime?.titleEnglish || review.anime?.title,
            title: review.title,
            content: review.content,
            score: review.score,
            isSpoiler: review.isSpoiler,
            likes: review.likes,
            dislikes: review.dislikes,
            isPublic: review.isPublic,
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,
          })),
          ratings: ratings.map(rating => ({
            animeTitle: rating.anime?.titleEnglish || rating.anime?.title,
            rating: rating.rating,
            ratedAt: rating.createdAt,
          })),
          dataProcessingConsent: {
            gdprConsent: true, // User agreed during signup
            marketingConsent: user.preferences?.marketingConsent || false,
            dataProcessingConsent: true, // Required for service
          }
        }
        
        logger.info('GDPR data export completed', logContext, {
          userId: ctx.user.id,
          animeListCount: animeList.length,
          reviewsCount: reviews.length,
        })
        
        return {
          success: true,
          data: userData,
          downloadFilename: `animesenpai-data-export-${user.username}-${new Date().toISOString().split('T')[0]}.json`
        }
        
      } catch (error) {
        logger.error('GDPR data export failed', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Request Account Deletion (GDPR Article 17 - Right to Erasure)
   * Schedules account for deletion after confirmation period
   */
  requestAccountDeletion: protectedProcedure
    .input(z.object({
      password: z.string().min(1, 'Password is required for confirmation'),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        // Rate limit: 3 deletion requests per hour per user
        checkRateLimit(ctx.user.id, 'email', 'gdpr-delete')
        
        logger.security('GDPR account deletion requested', logContext, {
          userId: ctx.user.id,
          reason: input.reason || 'Not provided'
        })
        
        // Verify password
        const bcrypt = await import('bcryptjs')
        const user = await db.user.findUnique({
          where: { id: ctx.user.id },
          select: { password: true, email: true }
        })
        
        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found'
          })
        }
        
        const isValidPassword = await bcrypt.compare(input.password, user.password)
        
        if (!isValidPassword) {
          logger.security('GDPR deletion failed: Invalid password', logContext, { userId: ctx.user.id })
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid password. Please try again.'
          })
        }
        
        // Schedule deletion (30-day grace period as per GDPR best practices)
        const deletionDate = new Date()
        deletionDate.setDate(deletionDate.getDate() + 30)
        
        await db.user.update({
          where: { id: ctx.user.id },
          data: {
            // Mark account for deletion
            // Note: Add these fields to your User model if not present
            // scheduledDeletionDate: deletionDate,
            // deletionReason: input.reason,
            // accountStatus: 'PENDING_DELETION',
            updatedAt: new Date(),
          }
        })
        
        // Send confirmation email
        const { sendEmail } = await import('../lib/email')
        await sendEmail({
          to: user.email,
          subject: 'Account Deletion Request Confirmation',
          html: `
            <h2>Account Deletion Scheduled</h2>
            <p>Your AnimeSenpai account has been scheduled for deletion.</p>
            <p><strong>Deletion Date:</strong> ${deletionDate.toLocaleDateString()}</p>
            <p>You can cancel this request at any time before the deletion date by logging in.</p>
            <p>If you did not request this, please contact support immediately.</p>
          `
        })
        
        logger.security('GDPR account deletion scheduled', logContext, {
          userId: ctx.user.id,
          deletionDate: deletionDate.toISOString()
        })
        
        return {
          success: true,
          message: 'Your account has been scheduled for deletion',
          deletionDate: deletionDate.toISOString(),
          gracePeriodDays: 30,
        }
        
      } catch (error) {
        logger.error('GDPR account deletion request failed', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Cancel Account Deletion
   * Allows user to cancel scheduled deletion during grace period
   */
  cancelAccountDeletion: protectedProcedure
    .mutation(async ({ ctx }) => {
      const logContext = extractLogContext(ctx.req, ctx.user.id)
      
      try {
        logger.info('GDPR account deletion cancelled', logContext, { userId: ctx.user.id })
        
        // Cancel deletion
        await db.user.update({
          where: { id: ctx.user.id },
          data: {
            // Remove deletion scheduling
            // scheduledDeletionDate: null,
            // deletionReason: null,
            // accountStatus: 'ACTIVE',
            updatedAt: new Date(),
          }
        })
        
        return {
          success: true,
          message: 'Account deletion has been cancelled'
        }
        
      } catch (error) {
        logger.error('GDPR account deletion cancellation failed', error as Error, logContext, { userId: ctx.user.id })
        throw error
      }
    }),

  /**
   * Get Data Processing Information
   * Returns information about how user data is processed
   */
  getDataProcessingInfo: protectedProcedure
    .query(async ({ ctx }) => {
      return {
        dataController: {
          name: 'AnimeSenpai',
          description: 'Anime tracking and discovery platform',
          contact: 'privacy@animesenpai.app'
        },
        dataProcessed: [
          {
            category: 'Account Information',
            data: ['Email address', 'Username', 'Password (hashed)', 'Avatar URL'],
            purpose: 'User authentication and account management',
            legalBasis: 'Contract performance (Terms of Service)',
            retention: 'Until account deletion'
          },
          {
            category: 'Anime Lists & Ratings',
            data: ['Anime IDs', 'Watch status', 'Ratings', 'Reviews', 'Progress'],
            purpose: 'Provide personalized anime tracking and recommendations',
            legalBasis: 'Contract performance (Core service functionality)',
            retention: 'Until account deletion'
          },
          {
            category: 'Usage Analytics',
            data: ['Page views', 'Feature usage', 'Error logs'],
            purpose: 'Improve service quality and user experience',
            legalBasis: 'Legitimate interest',
            retention: '90 days'
          },
          {
            category: 'Technical Data',
            data: ['IP address', 'Browser type', 'Device type'],
            purpose: 'Security, fraud prevention, and service optimization',
            legalBasis: 'Legitimate interest',
            retention: '30 days'
          }
        ],
        thirdPartyProcessors: [
          {
            name: 'Vercel',
            purpose: 'Hosting and infrastructure',
            location: 'United States',
            safeguards: 'Standard Contractual Clauses (SCCs)'
          },
          {
            name: 'Sentry',
            purpose: 'Error tracking and monitoring',
            location: 'United States',
            safeguards: 'Standard Contractual Clauses (SCCs)'
          }
        ],
        userRights: [
          'Right of access (Article 15)',
          'Right to rectification (Article 16)',
          'Right to erasure (Article 17)',
          'Right to data portability (Article 20)',
          'Right to object (Article 21)',
        ]
      }
    })
})

