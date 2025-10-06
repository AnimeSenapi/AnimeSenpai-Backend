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
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎌 Welcome to AnimeSenpai!</h1>
            </div>
            <div class="content">
              <h2>Hi${name ? ` ${name}` : ''}!</h2>
              <p>Thank you for signing up for AnimeSenpai! To complete your registration and start discovering amazing anime, please verify your email address.</p>
              
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </div>
              
              <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 5px;">${verificationUrl}</p>
              
              <p><strong>This link will expire in 24 hours.</strong></p>
              
              <p>If you didn't create an account with AnimeSenpai, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>© 2024 AnimeSenpai. All rights reserved.</p>
              <p>This email was sent to ${email}</p>
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
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #ff6b6b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔒 Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Hi${name ? ` ${name}` : ''}!</h2>
              <p>We received a request to reset your password for your AnimeSenpai account.</p>
              
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              
              <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 5px;">${resetUrl}</p>
              
              <div class="warning">
                <p><strong>⚠️ Security Notice:</strong></p>
                <ul>
                  <li>This link will expire in 1 hour</li>
                  <li>If you didn't request this reset, please ignore this email</li>
                  <li>Your password will remain unchanged until you click the link above</li>
                </ul>
              </div>
            </div>
            <div class="footer">
              <p>© 2024 AnimeSenpai. All rights reserved.</p>
              <p>This email was sent to ${email}</p>
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
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .feature { background: white; padding: 20px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #667eea; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to AnimeSenpai!</h1>
            </div>
            <div class="content">
              <h2>Hi${name ? ` ${name}` : ''}!</h2>
              <p>Welcome to AnimeSenpai! Your email has been verified and your account is now active. You're ready to start your anime journey!</p>
              
              <div style="text-align: center;">
                <a href="${this.frontendUrl}/dashboard" class="button">Go to Dashboard</a>
              </div>
              
              <h3>What you can do on AnimeSenpai:</h3>
              <div class="feature">
                <h4>📚 Create Your Anime List</h4>
                <p>Add anime to your watchlist, mark episodes as watched, and track your progress.</p>
              </div>
              <div class="feature">
                <h4>⭐ Rate & Review</h4>
                <p>Rate your favorite anime and share your thoughts with the community.</p>
              </div>
              <div class="feature">
                <h4>🔍 Discover New Anime</h4>
                <p>Find trending anime, browse by genre, and get personalized recommendations.</p>
              </div>
              
              <p>If you have any questions, feel free to reach out to our support team.</p>
            </div>
            <div class="footer">
              <p>© 2024 AnimeSenpai. All rights reserved.</p>
              <p>This email was sent to ${email}</p>
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
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #ff6b6b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .alert { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚨 Security Alert</h1>
            </div>
            <div class="content">
              <h2>Hi${name ? ` ${name}` : ''}!</h2>
              <p>We detected a security event on your AnimeSenpai account:</p>
              
              <div class="alert">
                <p><strong>Event:</strong> ${eventType}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
              </div>
              
              <p>If this was you, no action is needed. If you don't recognize this activity, please secure your account immediately.</p>
              
              <div style="text-align: center;">
                <a href="${this.frontendUrl}/auth/signin" class="button">Secure Account</a>
              </div>
            </div>
            <div class="footer">
              <p>© 2024 AnimeSenpai. All rights reserved.</p>
              <p>This email was sent to ${email}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Security Alert - AnimeSenpai',
      html,
    });
  }
}

export const emailService = EmailService.getInstance();
