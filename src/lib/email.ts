import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private static instance: EmailService;
  private fromEmail: string;
  private fromName: string;
  private frontendUrl: string;

  private constructor() {
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@animesenpai.app';
    this.fromName = process.env.EMAIL_FROM_NAME || 'AnimeSenpai';
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private async sendEmail(template: EmailTemplate): Promise<boolean> {
    try {
      const result = await resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: template.to,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      console.log('Email sent successfully:', result);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  // Email Verification
  async sendEmailVerification(email: string, token: string, name?: string): Promise<boolean> {
    const verificationUrl = `${this.frontendUrl}/auth/verify-email/${token}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email - AnimeSenpai</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #06b6d4 0%, #ec4899 100%); padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0;">
              <h1 style="margin: 0; color: white; font-size: 32px; font-weight: bold;">🎌 AnimeSenpai</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 18px;">Welcome Aboard!</p>
            </div>
            
            <!-- Content -->
            <div style="background: #1e293b; padding: 40px 30px; border-radius: 0 0 16px 16px;">
              <h2 style="color: white; font-size: 24px; margin: 0 0 20px;">Hi${name ? ` ${name}` : ''}! 👋</h2>
              
              <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Thank you for joining <strong style="color: #06b6d4;">AnimeSenpai</strong>! We're excited to help you discover amazing anime. To get started, please verify your email address.
              </p>
              
              <!-- Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #ec4899 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 14px 0 rgba(6, 182, 212, 0.3);">
                  ✨ Verify Email Address
                </a>
              </div>
              
              <!-- Link Backup -->
              <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid rgba(255,255,255,0.1);">
                <p style="color: #94a3b8; font-size: 12px; margin: 0 0 8px;">Or copy and paste this link:</p>
                <p style="color: #06b6d4; font-size: 12px; word-break: break-all; margin: 0;">${verificationUrl}</p>
              </div>
              
              <!-- Info Box -->
              <div style="background: rgba(6, 182, 212, 0.1); border-left: 4px solid #06b6d4; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #cbd5e1; font-size: 14px; margin: 0;"><strong style="color: white;">⏰ Important:</strong> This verification link will expire in 24 hours.</p>
              </div>
              
              <p style="color: #94a3b8; font-size: 14px; margin: 20px 0 0;">
                If you didn't create an account with AnimeSenpai, you can safely ignore this email.
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
      Welcome to AnimeSenpai!
      
      Hi${name ? ` ${name}` : ''}!
      
      Thank you for signing up for AnimeSenpai! To complete your registration and start discovering amazing anime, please verify your email address.
      
      Click this link to verify: ${verificationUrl}
      
      This link will expire in 24 hours.
      
      If you didn't create an account with AnimeSenpai, you can safely ignore this email.
      
      © 2024 AnimeSenpai. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Verify Your Email - AnimeSenpai',
      html,
      text,
    });
  }

  // Password Reset
  async sendPasswordReset(email: string, token: string, name?: string): Promise<boolean> {
    const resetUrl = `${this.frontendUrl}/auth/reset-password/${token}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password - AnimeSenpai</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0;">
              <h1 style="margin: 0; color: white; font-size: 32px; font-weight: bold;">🔒 Password Reset</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Secure your account</p>
            </div>
            
            <!-- Content -->
            <div style="background: #1e293b; padding: 40px 30px; border-radius: 0 0 16px 16px;">
              <h2 style="color: white; font-size: 24px; margin: 0 0 20px;">Hi${name ? ` ${name}` : ''}! 👋</h2>
              
              <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                We received a request to reset your password for your <strong style="color: #06b6d4;">AnimeSenpai</strong> account. Click the button below to create a new password.
              </p>
              
              <!-- Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 14px 0 rgba(239, 68, 68, 0.4);">
                  🔑 Reset Your Password
                </a>
              </div>
              
              <!-- Link Backup -->
              <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid rgba(255,255,255,0.1);">
                <p style="color: #94a3b8; font-size: 12px; margin: 0 0 8px;">Or copy and paste this link:</p>
                <p style="color: #06b6d4; font-size: 12px; word-break: break-all; margin: 0;">${resetUrl}</p>
              </div>
              
              <!-- Warning Box -->
              <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #fca5a5; font-size: 14px; margin: 0 0 12px;"><strong>⚠️ Security Notice:</strong></p>
                <ul style="color: #cbd5e1; font-size: 14px; margin: 0; padding-left: 20px;">
                  <li style="margin-bottom: 8px;">This link will expire in <strong>1 hour</strong></li>
                  <li style="margin-bottom: 8px;">If you didn't request this, please ignore this email</li>
                  <li>Your current password remains active until you reset it</li>
                </ul>
              </div>
              
              <p style="color: #94a3b8; font-size: 14px; margin: 20px 0 0;">
                If you're having trouble, reply to this email and we'll help you out!
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
      Password Reset Request - AnimeSenpai
      
      Hi${name ? ` ${name}` : ''}!
      
      We received a request to reset your password for your AnimeSenpai account.
      
      Click this link to reset your password: ${resetUrl}
      
      Security Notice:
      - This link will expire in 1 hour
      - If you didn't request this reset, please ignore this email
      - Your password will remain unchanged until you click the link above
      
      © 2024 AnimeSenpai. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Reset Your Password - AnimeSenpai',
      html,
      text,
    });
  }

  // Welcome Email
  async sendWelcomeEmail(email: string, name?: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to AnimeSenpai!</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #06b6d4 0%, #ec4899 100%); padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0;">
              <h1 style="margin: 0; color: white; font-size: 36px; font-weight: bold;">🎉 Welcome!</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 18px;">Your anime journey starts now</p>
            </div>
            
            <!-- Content -->
            <div style="background: #1e293b; padding: 40px 30px; border-radius: 0 0 16px 16px;">
              <h2 style="color: white; font-size: 28px; margin: 0 0 20px;">Hi${name ? ` ${name}` : ''}! 👋</h2>
              
              <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                Welcome to <strong style="background: linear-gradient(135deg, #06b6d4, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">AnimeSenpai</strong>! Your account is now active and you're ready to dive into the world of anime.
              </p>
              
              <!-- Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${this.frontendUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #ec4899 100%); color: white; padding: 18px 48px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 18px; box-shadow: 0 4px 14px 0 rgba(6, 182, 212, 0.4);">
                  🚀 Go to Dashboard
                </a>
              </div>
              
              <!-- Features -->
              <h3 style="color: white; font-size: 20px; margin: 30px 0 20px;">What you can do:</h3>
              
              <div style="background: rgba(6, 182, 212, 0.1); border-left: 4px solid #06b6d4; padding: 20px; border-radius: 8px; margin-bottom: 16px;">
                <h4 style="color: #06b6d4; font-size: 16px; margin: 0 0 8px;">📺 Track Your Anime</h4>
                <p style="color: #cbd5e1; font-size: 14px; margin: 0;">Create your personalized watchlist and never lose track of what you're watching.</p>
              </div>
              
              <div style="background: rgba(236, 72, 153, 0.1); border-left: 4px solid #ec4899; padding: 20px; border-radius: 8px; margin-bottom: 16px;">
                <h4 style="color: #ec4899; font-size: 16px; margin: 0 0 8px;">⭐ Get Recommendations</h4>
                <p style="color: #cbd5e1; font-size: 14px; margin: 0;">Discover anime based on your taste with our ML-powered recommendation engine.</p>
              </div>
              
              <div style="background: rgba(34, 197, 94, 0.1); border-left: 4px solid #22c55e; padding: 20px; border-radius: 8px; margin-bottom: 16px;">
                <h4 style="color: #22c55e; font-size: 16px; margin: 0 0 8px;">👥 Connect with Fans</h4>
                <p style="color: #cbd5e1; font-size: 14px; margin: 0;">Follow friends, see what they're watching, and share your favorites.</p>
              </div>
              
              <div style="background: rgba(168, 85, 247, 0.1); border-left: 4px solid #a855f7; padding: 20px; border-radius: 8px;">
                <h4 style="color: #a855f7; font-size: 16px; margin: 0 0 8px;">🎯 Rate & Review</h4>
                <p style="color: #cbd5e1; font-size: 14px; margin: 0;">Share your thoughts and help others discover great anime.</p>
              </div>
              
              <p style="color: #94a3b8; font-size: 14px; margin: 30px 0 0; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                Need help? Reply to this email anytime – we're here to help! 💬
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
      Welcome to AnimeSenpai!
      
      Hi${name ? ` ${name}` : ''}!
      
      Welcome to AnimeSenpai! Your email has been verified and your account is now active. You're ready to start your anime journey!
      
      Go to your dashboard: ${this.frontendUrl}/dashboard
      
      What you can do on AnimeSenpai:
      - Create Your Anime List: Add anime to your watchlist, mark episodes as watched, and track your progress
      - Rate & Review: Rate your favorite anime and share your thoughts with the community
      - Discover New Anime: Find trending anime, browse by genre, and get personalized recommendations
      
      If you have any questions, feel free to reach out to our support team.
      
      © 2024 AnimeSenpai. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Welcome to AnimeSenpai! 🎉',
      html,
      text,
    });
  }

  // Security Alert
  async sendSecurityAlert(email: string, eventType: string, name?: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Security Alert - AnimeSenpai</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0;">
              <h1 style="margin: 0; color: white; font-size: 32px; font-weight: bold;">🚨 Security Alert</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Account activity detected</p>
            </div>
            
            <!-- Content -->
            <div style="background: #1e293b; padding: 40px 30px; border-radius: 0 0 16px 16px;">
              <h2 style="color: white; font-size: 24px; margin: 0 0 20px;">Hi${name ? ` ${name}` : ''}! 👋</h2>
              
              <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                We detected a security event on your <strong style="color: #06b6d4;">AnimeSenpai</strong> account.
              </p>
              
              <!-- Event Box -->
              <div style="background: rgba(245, 158, 11, 0.1); border: 2px solid #f59e0b; padding: 20px; border-radius: 12px; margin: 20px 0;">
                <p style="color: #fbbf24; font-size: 16px; margin: 0 0 12px;"><strong>📋 Event Details:</strong></p>
                <table style="width: 100%; color: #cbd5e1; font-size: 14px;">
                  <tr>
                    <td style="padding: 8px 0; color: #94a3b8;">Event:</td>
                    <td style="padding: 8px 0; color: white; font-weight: bold;">${eventType}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #94a3b8;">Time:</td>
                    <td style="padding: 8px 0; color: white;">${new Date().toLocaleString()}</td>
                  </tr>
                </table>
              </div>
              
              <!-- Action Box -->
              <div style="background: rgba(6, 182, 212, 0.1); border-left: 4px solid #06b6d4; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #cbd5e1; font-size: 14px; margin: 0;">
                  <strong style="color: white;">✅ Was this you?</strong> No action needed – your account is secure.
                </p>
              </div>
              
              <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #cbd5e1; font-size: 14px; margin: 0;">
                  <strong style="color: #fca5a5;">⚠️ Wasn't you?</strong> Secure your account immediately by changing your password.
                </p>
              </div>
              
              <!-- Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${this.frontendUrl}/user/settings?tab=security" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 14px 0 rgba(245, 158, 11, 0.4);">
                  🔒 Secure Account
                </a>
              </div>
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

    return this.sendEmail({
      to: email,
      subject: '🚨 Security Alert - AnimeSenpai',
      html,
    });
  }
}

export const emailService = EmailService.getInstance();
