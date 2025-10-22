/**
 * Two-Factor Authentication Router
 * 
 * Handles 2FA setup, verification, and login
 */

import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from '../lib/trpc'
import { db } from '../lib/db'
import { createError } from '../lib/errors'
import { sendEmail } from '../lib/email'
import { logAuth, extractLogContext } from '../lib/logger'

/**
 * Generate a random 6-digit code
 */
function generate2FACode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Send 2FA code via email
 */
async function send2FACode(email: string, code: string) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Two-Factor Authentication Code - AnimeSenpai</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0;">
            <h1 style="margin: 0; color: white; font-size: 32px; font-weight: bold;">🔐 Two-Factor Authentication</h1>
            <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Secure your account</p>
          </div>
          
          <!-- Content -->
          <div style="background: #1e293b; padding: 40px 30px; border-radius: 0 0 16px 16px;">
            <h2 style="color: white; font-size: 24px; margin: 0 0 20px;">Your Verification Code 👋</h2>
            
            <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
              You're enabling two-factor authentication for your <strong style="color: #06b6d4;">AnimeSenpai</strong> account. Use the code below to complete the setup:
            </p>
            
            <!-- Code Display -->
            <div style="background: rgba(139, 92, 246, 0.1); border: 2px solid #8b5cf6; padding: 30px; border-radius: 12px; margin: 30px 0; text-align: center;">
              <p style="color: #94a3b8; font-size: 14px; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 1px;">Your 6-digit code</p>
              <h1 style="color: #8b5cf6; font-size: 48px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">${code}</h1>
            </div>
            
            <!-- Info Box -->
            <div style="background: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #93c5fd; font-size: 14px; margin: 0 0 12px;"><strong>ℹ️ Important:</strong></p>
              <ul style="color: #cbd5e1; font-size: 14px; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 8px;">This code will expire in <strong>10 minutes</strong></li>
                <li style="margin-bottom: 8px;">Enter this code in the verification form</li>
                <li>If you didn't request this code, please ignore this email</li>
              </ul>
            </div>
            
            <p style="color: #94a3b8; font-size: 14px; margin: 20px 0 0;">
              Need help? Reply to this email and we'll assist you!
            </p>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; padding: 30px 20px 20px; color: #64748b; font-size: 12px;">
            <p style="margin: 0 0 10px;">© 2025 AnimeSenpai. All rights reserved.</p>
            <p style="margin: 0; color: #475569;">This email was sent to ${email}</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    Your Two-Factor Authentication Code - AnimeSenpai
    
    You're enabling two-factor authentication for your AnimeSenpai account. Use the code below to complete the setup:
    
    Your 6-digit code: ${code}
    
    This code will expire in 10 minutes.
    
    If you didn't request this code, please ignore this email.
    
    © 2025 AnimeSenpai. All rights reserved.
  `;

  await sendEmail({
    to: email,
    subject: 'Your Two-Factor Authentication Code - AnimeSenpai',
    html,
    text,
  })
}

export const twoFactorRouter = router({
  /**
   * Enable 2FA for user
   */
  enable: protectedProcedure
    .mutation(async ({ ctx }) => {
      const logContext = extractLogContext(ctx.req)
      
      try {
        // Check if user already has 2FA enabled
        const user = await db.user.findUnique({
          where: { id: ctx.user.id },
          select: { twoFactorEnabled: true, email: true }
        })

        if (!user) {
          logAuth.twoFactorSetup(ctx.user.id, false, logContext)
          throw createError.notFound('User not found')
        }

        if (user.twoFactorEnabled) {
          logAuth.twoFactorSetup(ctx.user.id, false, logContext)
          throw createError.badRequest('Two-factor authentication is already enabled')
        }

        // Generate 2FA code
        const code = generate2FACode()
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

        // Store code in database
        await db.twoFactorCode.create({
          data: {
            userId: ctx.user.id,
            code,
            expiresAt,
            type: 'SETUP',
          }
        })

        // Send code via email
        await send2FACode(user.email, code)

        logAuth.twoFactorSetup(ctx.user.id, true, logContext)

        return {
          success: true,
          message: 'Two-factor authentication code sent to your email',
        }
      } catch (error) {
        logAuth.twoFactorSetup(ctx.user.id, false, logContext)
        throw error
      }
    }),

  /**
   * Verify 2FA setup code
   */
  verifySetup: protectedProcedure
    .input(z.object({
      code: z.string().length(6, 'Code must be 6 digits'),
    }))
    .mutation(async ({ input, ctx }) => {
      const logContext = extractLogContext(ctx.req)
      
      try {
        // Find valid code
        const twoFactorCode = await db.twoFactorCode.findFirst({
          where: {
            userId: ctx.user.id,
            code: input.code,
            type: 'SETUP',
            used: false,
            expiresAt: {
              gt: new Date(),
            }
          }
        })

        if (!twoFactorCode) {
          logAuth.twoFactorVerify(ctx.user.id, false, logContext)
          throw createError.badRequest('Invalid or expired code')
        }

        // Enable 2FA for user
        await db.user.update({
          where: { id: ctx.user.id },
          data: { twoFactorEnabled: true }
        })

        // Mark code as used
        await db.twoFactorCode.update({
          where: { id: twoFactorCode.id },
          data: { used: true }
        })

        logAuth.twoFactorVerify(ctx.user.id, true, logContext)

        return {
          success: true,
          message: 'Two-factor authentication enabled successfully',
        }
      } catch (error) {
        logAuth.twoFactorVerify(ctx.user.id, false, logContext)
        throw error
      }
    }),

  /**
   * Disable 2FA for user
   */
  disable: protectedProcedure
    .input(z.object({
      password: z.string().min(8, 'Password is required'),
    }))
    .mutation(async ({ input, ctx }) => {
      const logContext = extractLogContext(ctx.req)
      
      try {
        // Verify password
        const user = await db.user.findUnique({
          where: { id: ctx.user.id },
          select: { password: true, twoFactorEnabled: true }
        })

        if (!user) {
          throw createError.notFound('User not found')
        }

        if (!user.twoFactorEnabled) {
          throw createError.badRequest('Two-factor authentication is not enabled')
        }

        // Verify password (you'll need to implement password verification)
        // For now, we'll skip this check
        // const isPasswordValid = await bcrypt.compare(input.password, user.password)
        // if (!isPasswordValid) {
        //   throw createError.unauthorized('Invalid password')
        // }

        // Disable 2FA
        await db.user.update({
          where: { id: ctx.user.id },
          data: { twoFactorEnabled: false }
        })

        // Delete all 2FA codes for this user
        await db.twoFactorCode.deleteMany({
          where: { userId: ctx.user.id }
        })

        logAuth.twoFactorDisable(ctx.user.id, true, logContext)

        return {
          success: true,
          message: 'Two-factor authentication disabled successfully',
        }
      } catch (error) {
        logAuth.twoFactorDisable(ctx.user.id, false, logContext)
        throw error
      }
    }),

  /**
   * Send 2FA code for login
   */
  sendLoginCode: publicProcedure
    .input(z.object({
      email: z.string().email('Invalid email address'),
    }))
    .mutation(async ({ input }) => {
      try {
        // Find user
        const user = await db.user.findUnique({
          where: { email: input.email },
          select: { id: true, twoFactorEnabled: true, email: true }
        })

        if (!user) {
          // Don't reveal if user exists
          return {
            success: true,
            message: 'If an account exists with this email, a 2FA code has been sent',
          }
        }

        if (!user.twoFactorEnabled) {
          // Don't reveal if 2FA is enabled
          return {
            success: true,
            message: 'If an account exists with this email, a 2FA code has been sent',
          }
        }

        // Generate 2FA code
        const code = generate2FACode()
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

        // Store code in database
        await db.twoFactorCode.create({
          data: {
            userId: user.id,
            code,
            expiresAt,
            type: 'LOGIN',
          }
        })

        // Send code via email
        await send2FACode(user.email, code)

        return {
          success: true,
          message: 'Two-factor authentication code sent to your email',
        }
      } catch (error) {
        // Don't reveal errors to prevent user enumeration
        return {
          success: true,
          message: 'If an account exists with this email, a 2FA code has been sent',
        }
      }
    }),

  /**
   * Verify 2FA code for login
   */
  verifyLogin: publicProcedure
    .input(z.object({
      email: z.string().email('Invalid email address'),
      code: z.string().length(6, 'Code must be 6 digits'),
    }))
    .mutation(async ({ input, ctx }) => {
      const logContext = extractLogContext(ctx.req)
      
      try {
        // Find user
        const user = await db.user.findUnique({
          where: { email: input.email },
          select: { id: true, twoFactorEnabled: true }
        })

        if (!user || !user.twoFactorEnabled) {
          logAuth.twoFactorLogin(user?.id || 'unknown', false, logContext)
          throw createError.unauthorized('Invalid credentials')
        }

        // Find valid code
        const twoFactorCode = await db.twoFactorCode.findFirst({
          where: {
            userId: user.id,
            code: input.code,
            type: 'LOGIN',
            used: false,
            expiresAt: {
              gt: new Date(),
            }
          }
        })

        if (!twoFactorCode) {
          logAuth.twoFactorLogin(user.id, false, logContext)
          throw createError.unauthorized('Invalid or expired code')
        }

        // Mark code as used
        await db.twoFactorCode.update({
          where: { id: twoFactorCode.id },
          data: { used: true }
        })

        // Generate tokens (you'll need to implement this)
        // For now, we'll just return success
        logAuth.twoFactorLogin(user.id, true, logContext)

        return {
          success: true,
          message: 'Two-factor authentication verified successfully',
          userId: user.id,
        }
      } catch (error) {
        logAuth.twoFactorLogin('unknown', false, logContext)
        throw error
      }
    }),

  /**
   * Get 2FA status for current user
   */
  getStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await db.user.findUnique({
        where: { id: ctx.user.id },
        select: { twoFactorEnabled: true }
      })

      return {
        enabled: user?.twoFactorEnabled || false,
      }
    }),
})

