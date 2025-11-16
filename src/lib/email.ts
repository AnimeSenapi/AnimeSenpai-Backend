import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_STYLES = {
  paragraph: "color: #e2e8f0; font-size: 15px; line-height: 1.75; margin: 0 0 18px;",
  small: "color: #c7d2fe; font-size: 12px; line-height: 1.6; margin: 0 0 12px;",
  muted: "color: #94a3b8; font-size: 13px; line-height: 1.7; margin: 0 0 16px;",
  list: "color: #e2e8f0; font-size: 14px; line-height: 1.65; margin: 0; padding-left: 20px;",
  listItem: "margin-bottom: 10px;",
}

export interface EmailLayoutOptions {
  preheader?: string;
  accent?: string;
  accentSolid?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  heroEmoji?: string;
  greeting?: string;
  body: string;
  button?: { label: string; url: string };
  secondaryNote?: string;
  footerNote?: string;
}

export function renderEmailLayout({
  preheader,
  accent = 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
  accentSolid,
  eyebrow,
  title,
  subtitle,
  heroEmoji,
  greeting,
  body,
  button,
  secondaryNote,
  footerNote,
}: EmailLayoutOptions): string {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  const gradientColorMatch = accent?.match(/#(?:[0-9a-fA-F]{3}){1,2}/)
  const effectiveAccentColor = (accentSolid && accentSolid.trim()) || gradientColorMatch?.[0] || '#6366f1'
  const defaultFooter =
    footerNote ??
    `You're receiving this because you have an AnimeSenpai account. <a href="${normalizedBaseUrl}/settings" style="color: #818cf8; text-decoration: none;">Manage preferences</a>`

  const buttonHtml = button
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0 0;">
         <tr>
           <td align="center">
             <a href="${button.url}" style="display: inline-block; background: ${effectiveAccentColor}; color: #ffffff; padding: 16px 44px; text-decoration: none; border-radius: 14px; font-weight: 600; font-size: 16px; box-shadow: 0 12px 35px rgba(99, 102, 241, 0.25);">
               ${button.label}
             </a>
           </td>
         </tr>
       </table>`
    : ''

  const secondaryNoteHtml = secondaryNote
    ? `<div style="background: rgba(129, 140, 248, 0.1); border: 1px solid rgba(129, 140, 248, 0.3); padding: 16px; border-radius: 10px; margin: 24px 0;">
         <p style="${EMAIL_STYLES.small}">${secondaryNote}</p>
       </div>`
    : ''

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - AnimeSenpai</title>
    </head>
    <body style="margin:0; padding:0; background:#020617; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      ${preheader ? `<span style="display:none !important; opacity:0; visibility:hidden; height:0; width:0; color:transparent;">${preheader}</span>` : ''}
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#020617;">
        <tr>
          <td align="center" style="padding:36px 16px 60px;">
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:640px; background:#050a1e; border:1px solid rgba(129, 140, 248, 0.16); border-radius:22px; overflow:hidden; box-shadow:0 24px 65px rgba(15, 23, 42, 0.55);">
              <tr>
                <td style="padding:0;">
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="${effectiveAccentColor}" style="background:${accent ?? effectiveAccentColor}; background-color:${effectiveAccentColor};${accent && accent.includes('linear-gradient') ? ` background-image:${accent}; background-repeat:no-repeat; background-size:cover;` : ''}">
                    <tr>
                      <td style="padding:26px 24px; background-color:${effectiveAccentColor};${accent && accent.includes('linear-gradient') ? ` background-image:${accent}; background-repeat:no-repeat; background-size:cover;` : ''}">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td valign="top" style="padding-right:24px;">
                              <table role="presentation" cellpadding="0" cellspacing="0" style="min-width:220px;">
                                <tr>
                                  <td style="color: rgba(226, 232, 240, 0.86); font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 600; padding-bottom:6px;">
                                    ${eyebrow ?? 'AnimeSenpai'}
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom:6px;">
                                    <span style="margin:0; color: rgba(255,255,255,0.98); font-size: 24px; font-weight:700; letter-spacing:-0.01em; line-height:1.25; display:block;">${title}</span>
                                  </td>
                                </tr>
                                ${subtitle ? `<tr><td style="color: rgba(226, 232, 240, 0.9); font-size: 13px; line-height: 1.6; max-width:360px;">${subtitle}</td></tr>` : ''}
                              </table>
                            </td>
                            <td width="60" valign="top" align="right">
                              <table role="presentation" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td style="width:48px; height:48px; border-radius:18px; background: rgba(15, 23, 42, 0.45); border:1px solid rgba(248, 250, 252, 0.28); text-align:center;">
                                    <span style="display:block; color: rgba(248, 250, 252, 0.95); font-size: 24px; font-weight: 600; letter-spacing: 0.05em; line-height:48px;">${heroEmoji ? heroEmoji : '✦'}</span>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 32px 28px 42px; background: rgba(5, 10, 30, 0.94);">
                  ${greeting ? `<p style="color:#f1f5f9; font-size:17px; font-weight:600; margin:0 0 18px;">${greeting}</p>` : ''}
                  ${body}
                  ${buttonHtml}
                  ${secondaryNoteHtml}
                </td>
              </tr>
            </table>
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:640px;">
              <tr>
                <td style="text-align:center; padding:26px 20px 0; color:#64748b; font-size:12px; line-height:1.6;">
                  <p style="margin:0 0 12px;">${defaultFooter}</p>
                  <p style="margin:0;">© ${new Date().getFullYear()} AnimeSenpai. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`
}

export interface EmailTemplateContent {
  subject: string;
  html: string;
  text?: string;
}

const DEFAULT_FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

function getFrontendUrl(override?: string) {
  return override?.trim() || DEFAULT_FRONTEND_URL
}

export function getEmailVerificationContent(params: { token: string; name?: string; frontendUrl?: string }): EmailTemplateContent {
  const frontendUrl = getFrontendUrl(params.frontendUrl)
  const verificationUrl = `${frontendUrl}/auth/verify-email/${params.token}`
  const paragraph = (content: string) => `<p style="${EMAIL_STYLES.paragraph}">${content}</p>`
  const small = (content: string) => `<p style="${EMAIL_STYLES.small}">${content}</p>`

  const stepsData = [
    {
      title: 'Confirm your email',
      copy: 'Hit the button below to secure your account and unlock personalised recommendations.',
    },
    {
      title: 'Set up your profile',
      copy: 'Add an avatar, bio, and tags so other fans know what you\'re loving right now.',
    },
    {
      title: 'Sync your watchlist',
      copy: 'Import from MAL or Anilist in one click to keep your progress intact.',
    },
  ]

  const stepsSection = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 24px;">
      ${stepsData
        .map(
          (step, index) => `
            <tr>
              <td style="padding-bottom:16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:16px; background: linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(14,165,233,0.08) 100%); border:1px solid rgba(148, 163, 184, 0.24); box-shadow:0 14px 32px rgba(15, 23, 42, 0.22);">
                  <tr>
                    <td width="46" valign="top" style="padding:18px 0 18px 18px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" style="background: rgba(15, 23, 42, 0.35); border:1px solid rgba(148, 163, 184, 0.26); border-radius:12px; width:34px; height:34px; text-align:center;">
                        <tr>
                          <td style="color: rgba(224, 231, 255, 0.95); font-size:14px; font-weight:600;">${index + 1}</td>
                        </tr>
                      </table>
                    </td>
                    <td valign="top" style="padding:18px 18px 18px 6px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="color: rgba(226,232,240,0.75); font-size:10px; letter-spacing:0.16em; text-transform:uppercase; padding-bottom:6px;">Step ${index + 1}</td>
                        </tr>
                        <tr>
                          <td style="color: rgba(248,250,252,0.98); font-size:16px; font-weight:600; padding-bottom:4px;">${step.title}</td>
                        </tr>
                        <tr>
                          <td style="color: rgba(203,213,225,0.9); font-size:13px; line-height:1.6;">${step.copy}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          `,
        )
        .join('')}
    </table>
  `

  const checklistSection = [
    {
      icon: '🪪',
      title: 'Personalise your profile',
      copy: 'Add an avatar, tweak your bio, and showcase your favourite genres.',
    },
    {
      icon: '📥',
      title: 'Import your history',
      copy: 'Bring over lists from MyAnimeList or Anilist to keep progress intact.',
    },
    {
      icon: '🔔',
      title: 'Enable release pings',
      copy: 'Get notified the moment new episodes drop on your watchlist.',
    },
  ]
    .map(
      (item) => `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px; border-radius:14px; background: rgba(15, 23, 42, 0.62); border:1px solid rgba(148, 163, 184, 0.22);">
          <tr>
            <td width="40" valign="top" style="padding:16px 0 16px 18px; color:#ffffff; font-size:18px;">${item.icon}</td>
            <td valign="top" style="padding:16px 18px 16px 6px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color: rgba(248, 250, 252, 0.95); font-size:14px; font-weight:600; padding-bottom:4px;">${item.title}</td>
                </tr>
                <tr>
                  <td style="color: rgba(203, 213, 225, 0.85); font-size:13px; line-height:1.6;">${item.copy}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `,
    )
    .join('')

  const verificationButton = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 20px;">
      <tr>
        <td align="center">
          <a href="${verificationUrl}" style="display:inline-block; background:#6366f1; background-image:linear-gradient(135deg, #6366f1 0%, #a855f7 100%); color:#f8fafc; padding:16px 42px; border-radius:16px; font-size:15px; font-weight:600; text-decoration:none; box-shadow:0 18px 40px rgba(99,102,241,0.3);">Verify email address</a>
        </td>
      </tr>
    </table>
  `

  const fallbackLink = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px; border-radius:16px; background: rgba(15, 23, 42, 0.7); border:1px solid rgba(148, 163, 184, 0.24);">
      <tr>
        <td style="padding:18px; color: rgba(203,213,225,0.9); font-size:13px;">
          Having trouble with the button? Copy and paste this link instead:<br>
          <span style="color:#a5b4ff; font-size:12px; word-break:break-all;">${verificationUrl}</span>
        </td>
      </tr>
    </table>
  `

  const body = [
    paragraph(
      `Welcome to <strong style="color:#c4cfff;">AnimeSenpai</strong> 🎉 Let's secure your account so we can tailor recommendations and keep your watchlist in sync.`,
    ),
    stepsSection,
    checklistSection,
    small(`<strong style="color:#c7d2fe;">Heads up:</strong> this verification link stays active for 24 hours.`),
    verificationButton,
    paragraph(`Didn't create this account? Sit tight and we'll quietly close the loop.`),
    fallbackLink,
    small(`Need help? Email <a href="mailto:contact@animesenpai.com" style="color:#a5b4ff; text-decoration:none;">contact@animesenpai.com</a>.`),
  ].join('')

  const html = renderEmailLayout({
    preheader: 'Verify your email to start exploring AnimeSenpai.',
    accent: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    accentSolid: '#6366f1',
    eyebrow: 'Account verification',
    title: 'Verify your email',
    subtitle: 'Unlock your personalised AnimeSenpai hub',
    heroEmoji: '✨',
    greeting: params.name ? `Hi ${params.name}!` : 'Hi there!',
    body,
  })

  const text = `
AnimeSenpai Email Verification

Hi${params.name ? ` ${params.name}` : ''},

Confirm your email to finish setting up AnimeSenpai:
1. Tap the verify button to activate your account.
2. Add your profile details so other fans recognise you.
3. Import your watch history from MAL or Anilist.

Verification link (valid for 24 hours): ${verificationUrl}

Didn't create this account? Sit tight and we'll quietly close the loop.

Need help? Email contact@animesenpai.com.

Having trouble with the button? Copy and paste this link instead:
${verificationUrl}
  `

  return {
    subject: 'Verify Your Email - AnimeSenpai',
    html,
    text,
  }
}

export function getPasswordResetContent(params: { token: string; name?: string; frontendUrl?: string }): EmailTemplateContent {
  const frontendUrl = getFrontendUrl(params.frontendUrl)
  const resetUrl = `${frontendUrl}/auth/reset-password/${params.token}`
  const paragraph = (content: string) => `<p style="${EMAIL_STYLES.paragraph}">${content}</p>`
  const listItems = [
    'The reset link expires in <strong>1 hour</strong> to protect your account.',
    "If you didn't request this reset, you can safely ignore this email.",
    'Your current password stays active until you finish the reset.',
  ]
    .map((item) => `<li style="${EMAIL_STYLES.listItem}">${item}</li>`)
    .join('')

  const primaryCard = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0; border-radius:20px; background: linear-gradient(135deg, rgba(239, 68, 68, 0.28) 0%, rgba(249, 115, 22, 0.18) 100%); border:1px solid rgba(248, 113, 113, 0.32); box-shadow:0 22px 45px rgba(239, 68, 68, 0.28);">
      <tr>
        <td style="padding:22px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:rgba(254, 226, 226, 0.95); font-size:17px; font-weight:600;">Reset your password</td>
            </tr>
            <tr>
              <td style="color:rgba(254, 226, 226, 0.88); font-size:14px; line-height:1.6; padding-top:12px;">
                This link takes you straight to a secure reset screen. When you're done, we'll sign out other sessions automatically.
              </td>
            </tr>
            <tr>
              <td style="padding-top:18px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <a href="${resetUrl}" style="display:inline-block; background:#ef4444; background-image:linear-gradient(135deg, #ef4444 0%, #f97316 100%); color:#fdf2f2; padding:16px 42px; border-radius:16px; font-size:15px; font-weight:600; text-decoration:none; box-shadow:0 18px 40px rgba(239, 68, 68, 0.32);">Reset password</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `

  const securityCard = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 24px; border-radius:16px; background: rgba(15, 23, 42, 0.65); border:1px solid rgba(248, 113, 113, 0.25);">
      <tr>
        <td style="padding:18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color: rgba(252, 165, 165, 0.95); font-size:15px; font-weight:600; padding-bottom:10px;">Security reminders</td>
            </tr>
            <tr>
              <td>
                <ul style="${EMAIL_STYLES.list}">${listItems}</ul>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `

  const fallbackCard = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px; border-radius:16px; background: rgba(30, 41, 59, 0.7); border:1px solid rgba(148, 163, 184, 0.22); box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.12);">
      <tr>
        <td style="padding:18px; color: rgba(203,213,225,0.9); font-size:13px; line-height:1.6;">
          Prefer a backup option? Copy and paste this link into your browser:<br>
          <span style="color:#fda4af; font-size:12px; word-break:break-all;">${resetUrl}</span>
        </td>
      </tr>
    </table>
  `

  const supportNote = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:14px; background: rgba(15, 23, 42, 0.55); border:1px solid rgba(148, 163, 184, 0.2);">
      <tr>
        <td style="padding:16px;">
          <p style="${EMAIL_STYLES.small}">
            Need help or see unfamiliar activity? Email <a href="mailto:contact@animesenpai.com" style="color:#fda4af; text-decoration:none;">contact@animesenpai.com</a>.
          </p>
        </td>
      </tr>
    </table>
  `

  const body = [
    paragraph(
      `We received a request to reset your <strong style="color:#fca5a5;">AnimeSenpai</strong> password. Follow the secure link below to choose a fresh one.`,
    ),
    primaryCard,
    securityCard,
    fallbackCard,
    supportNote,
  ].join('')

  const html = renderEmailLayout({
    preheader: 'Reset your AnimeSenpai password in one click.',
    accent: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
    accentSolid: '#ef4444',
    eyebrow: 'Account security',
    title: 'Reset your password',
    subtitle: 'Let\'s get you back into AnimeSenpai securely',
    heroEmoji: '🔐',
    greeting: params.name ? `Hi ${params.name}!` : 'Hi there!',
    body,
  })

  const text = `
Reset your AnimeSenpai password

Hi${params.name ? ` ${params.name}` : ''},

We received a password reset request for your AnimeSenpai account.
Finish the process here: ${resetUrl}

Security reminders:
- Link expires in 1 hour
- Your current password stays active until the reset completes
- Didn't request this? Ignore the message or reach out to support

Backup link (copy & paste): ${resetUrl}

Need help? Email contact@animesenpai.com.
  `

  return {
    subject: 'Reset Your Password - AnimeSenpai',
    html,
    text,
  }
}

export function getWelcomeEmailContent(params: { name?: string; frontendUrl?: string }): EmailTemplateContent {
  const frontendUrl = getFrontendUrl(params.frontendUrl)
  const paragraph = (content: string) => `<p style="${EMAIL_STYLES.paragraph}">${content}</p>`

  const highlightData = [
    {
      emoji: '🗂️',
      title: 'Stay organised',
      copy: 'One watchlist that follows you across web, mobile, and TV.',
    },
    {
      emoji: '✨',
      title: 'Discover smarter',
      copy: 'Recommendations adapt as you rate, review, and follow series.',
    },
    {
      emoji: '💬',
      title: 'Share the hype',
      copy: 'Jump into live chats, compare lists, and connect with fans who get it.',
    },
  ]

  const highlightsSection = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 20px;">
      ${highlightData
        .map(
          (item) => `
            <tr>
              <td style="padding-bottom:18px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:16px; background: linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(14,165,233,0.08) 100%); border:1px solid rgba(148, 163, 184, 0.22); box-shadow:0 12px 28px rgba(15, 23, 42, 0.24);">
                  <tr>
                    <td width="44" valign="top" style="padding:18px; font-size:22px; color:#ffffff;">${item.emoji}</td>
                    <td valign="top" style="padding:18px 20px 18px 6px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="color: rgba(226,232,240,0.7); font-size:10px; letter-spacing:0.16em; text-transform:uppercase; padding-bottom:6px;">Core highlight</td>
                        </tr>
                        <tr>
                          <td style="color: rgba(248,250,252,0.98); font-size:16px; font-weight:600; letter-spacing:-0.01em; padding-bottom:6px;">${item.title}</td>
                        </tr>
                        <tr>
                          <td style="color: rgba(203,213,225,0.9); font-size:13px; line-height:1.6;">${item.copy}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          `,
        )
        .join('')}
    </table>
  `

  const quickStartList = [
    `<strong>Personalise your profile:</strong> set an avatar, pick your favourite genres, and let fans know what you're into.`,
    `<strong>Import your history:</strong> bring lists from MyAnimeList or Anilist in seconds, no spreadsheet required.`,
    `<strong>Enable release pings:</strong> get reminded when new episodes drop so you never fall behind.`,
  ]
    .map((item) => `<li style="${EMAIL_STYLES.listItem} color: rgba(203, 213, 225, 0.92);">${item}</li>`)
    .join('')

  const quickStartCard = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0; border-radius:18px; background: linear-gradient(135deg, rgba(59, 130, 246, 0.18) 0%, rgba(147, 51, 234, 0.12) 100%); border:1px solid rgba(99, 102, 241, 0.32); box-shadow:0 18px 35px rgba(30, 64, 175, 0.22);">
      <tr>
        <td style="padding:22px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color: rgba(224,231,255,0.95); font-size:17px; font-weight:600;">Get set in minutes</td>
              <td align="right" style="padding-left:12px;">
                <span style="display:inline-block; padding:6px 12px; border-radius:999px; background: rgba(15, 23, 42, 0.28); border:1px solid rgba(148, 163, 184, 0.24); color: rgba(226, 232, 240, 0.75); font-size:11px; letter-spacing:0.14em; text-transform:uppercase;">Quick actions</span>
              </td>
            </tr>
          </table>
          <ul style="${EMAIL_STYLES.list.replace('padding-left: 20px;', 'padding-left: 18px; margin:14px 0 0;')}">
            ${quickStartList}
          </ul>
          <p style="${EMAIL_STYLES.small}; margin-top:14px;">
            Tip: anime imported from MAL or Anilist inherit your existing ratings automatically.
          </p>
        </td>
      </tr>
    </table>
  `

  const supportCard = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 22px; border-radius:14px; background: rgba(148, 163, 184, 0.12); border:1px solid rgba(148, 163, 184, 0.22);">
      <tr>
        <td style="padding:18px; color: rgba(203,213,225,0.9); font-size:14px;">
          Need a hand or want to share feedback? Email us at <a href="mailto:contact@animesenpai.com" style="color:#a5b4ff; text-decoration:none;">contact@animesenpai.com</a>.
        </td>
      </tr>
    </table>
  `

  const body = [
    paragraph(
      `Welcome to <strong style="color:#a5b4ff;">AnimeSenpai</strong> — your gateway to keep every watchlist tidy, surface smart recommendations, and share the hype with fans who get it.`,
    ),
    highlightsSection,
    quickStartCard,
    supportCard,
  ].join('')

  const html = renderEmailLayout({
    preheader: 'Welcome to AnimeSenpai – let\'s make your watchlist unforgettable.',
    accent: 'linear-gradient(135deg, #06b6d4 0%, #ec4899 100%)',
    accentSolid: '#06b6d4',
    eyebrow: 'Welcome aboard',
    title: 'Your anime journey starts now',
    subtitle: 'Track, discover, share in one place',
    heroEmoji: '🎉',
    greeting: params.name ? `Hi ${params.name}!` : 'Hi there!',
    body,
    button: {
      label: 'Open your dashboard',
      url: `${frontendUrl}/dashboard`,
    },
  })

  const text = `
Welcome to AnimeSenpai

Hi${params.name ? ` ${params.name}` : ''},

Your dashboard is ready: ${frontendUrl}/dashboard

Highlights:
- Stay organised across every device.
- Discover smarter recommendations.
- Share the hype with friends and live chats.

Get set in minutes:
- Personalise your profile and favourite genres.
- Import your MAL or Anilist history.
- Enable release reminders so new episodes never slip.

Need a hand or have ideas? Email contact@animesenpai.com.

Tip: anime imported from MAL or Anilist inherit your existing ratings automatically.
  `

  return {
    subject: 'Welcome to AnimeSenpai! 🎉',
    html,
    text,
  }
}

export function getSecurityAlertContent(params: { eventType: string; name?: string; frontendUrl?: string; timestamp?: Date }): EmailTemplateContent {
  const frontendUrl = getFrontendUrl(params.frontendUrl)
  const detectedAt = params.timestamp ?? new Date()
  const paragraph = (content: string) => `<p style="${EMAIL_STYLES.paragraph}">${content}</p>`
  const eventDetails = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0; border-radius:18px; background: linear-gradient(135deg, rgba(234, 179, 8, 0.22) 0%, rgba(239, 68, 68, 0.16) 100%); border:1px solid rgba(251, 191, 36, 0.35); box-shadow:0 20px 45px rgba(202, 138, 4, 0.2);">
      <tr>
        <td style="padding:20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:#fcd34d; font-size:13px; font-weight:600; letter-spacing:0.16em; text-transform:uppercase;">Unusual activity detected</td>
              <td align="right">
                <span style="display:inline-block; padding:4px 12px; border-radius:999px; background: rgba(15, 23, 42, 0.32); border:1px solid rgba(148, 163, 184, 0.24); color: rgba(248, 250, 252, 0.85); font-size:12px;">
                  ${detectedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">
            <tr>
              <td style="color: rgba(148, 163, 184, 0.9); font-size:13px;">Trigger</td>
              <td align="right" style="color: rgba(255, 247, 237, 0.95); font-size:14px; font-weight:600;">${params.eventType}</td>
            </tr>
            <tr>
              <td style="padding-top:8px; color: rgba(148, 163, 184, 0.9); font-size:13px;">Detected</td>
              <td align="right" style="padding-top:8px; color: rgba(254, 215, 170, 0.95); font-size:14px;">${detectedAt.toLocaleString()}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `

  const nextStepsData = [
    {
      icon: '🔍',
      title: 'Review recent activity',
      copy: 'Open security settings to confirm trusted browsers and devices.',
    },
    {
      icon: '🔐',
      title: 'Update your password',
      copy: 'Choose a unique password if anything looks unfamiliar.',
    },
    {
      icon: '🛡️',
      title: 'Enable two-factor auth',
      copy: 'Add an extra barrier so only you can access AnimeSenpai.',
    },
  ]

  const nextSteps = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      ${nextStepsData
        .map(
          (step) => `
            <tr>
              <td style="padding-bottom:14px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:14px; background: rgba(15, 23, 42, 0.6); border:1px solid rgba(148, 163, 184, 0.25);">
                  <tr>
                    <td width="38" valign="top" style="padding:16px 0 16px 18px; font-size:18px; color:#ffffff;">${step.icon}</td>
                    <td valign="top" style="padding:16px 18px 16px 6px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="color: rgba(248, 250, 252, 0.95); font-size:14px; font-weight:600; padding-bottom:4px;">${step.title}</td>
                        </tr>
                        <tr>
                          <td style="color: rgba(203, 213, 225, 0.88); font-size:13px; line-height:1.6;">${step.copy}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          `,
        )
        .join('')}
    </table>
  `

  const reassurance = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0; border-radius:16px; background: rgba(15, 23, 42, 0.55); border:1px solid rgba(148, 163, 184, 0.22);">
      <tr>
        <td style="padding:18px; color: rgba(203, 213, 225, 0.88); font-size:13px; line-height:1.65;">
          Everything look familiar? Awesome — no further steps needed. Keep an eye on alerts like this if you share devices or travel frequently.
        </td>
      </tr>
    </table>
  `

  const support = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0; border-radius:14px; background: rgba(15, 23, 42, 0.55); border:1px solid rgba(148, 163, 184, 0.2);">
      <tr>
        <td style="padding:18px;">
          <p style="${EMAIL_STYLES.small}">
            Need backup or see another alert soon after? Email <a href="mailto:contact@animesenpai.com" style="color:#fbbf24; text-decoration:none;">contact@animesenpai.com</a> and we'll help secure your account.
          </p>
        </td>
      </tr>
    </table>
  `

  const body = [
    paragraph(
      `We noticed a new sign-in attempt on your <strong style="color:#fcd34d;">AnimeSenpai</strong> account. Take a quick look at the details below so you can confirm everything looks right.`,
    ),
    eventDetails,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0; border-radius:16px; background: rgba(34, 197, 94, 0.12); border:1px solid rgba(74, 222, 128, 0.32);">
      <tr>
        <td style="padding:18px; color: rgba(198, 246, 213, 0.92); font-size:14px; line-height:1.6;">
          Recognise this? Great—no further action needed and your account stays just the way you left it.
        </td>
      </tr>
    </table>`,
    nextSteps,
    reassurance,
    support,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px; border-radius:16px; background: rgba(15, 23, 42, 0.6); border:1px solid rgba(148, 163, 184, 0.2);">
      <tr>
        <td style="padding:18px;">
          <p style="${EMAIL_STYLES.small}">
            Need help or see something suspicious? Email <a href="mailto:contact@animesenpai.com" style="color:#fcd34d; text-decoration:none;">contact@animesenpai.com</a>.
          </p>
        </td>
      </tr>
    </table>`,
  ].join('')

  const html = renderEmailLayout({
    preheader: 'AnimeSenpai security alert – review recent account activity.',
    accent: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
    accentSolid: '#f59e0b',
    eyebrow: 'Security alert',
    title: 'We spotted new activity',
    subtitle: 'Let\'s keep your account locked down',
    heroEmoji: '🛡️',
    greeting: params.name ? `Hi ${params.name},` : 'Hi there,',
    body,
    button: {
      label: 'Review security settings',
      url: `${frontendUrl}/user/settings?tab=security`,
    },
  })

  const text = `
AnimeSenpai security alert

Hi${params.name ? ` ${params.name}` : ''},

We spotted new activity on your account:
- Event: ${params.eventType}
- Detected at: ${detectedAt.toISOString()}

If this was you, you're all set.

If it wasn't:
- Review devices & browsers: ${frontendUrl}/user/settings?tab=security
- Update your password if anything looks unfamiliar
- Enable 2FA for extra protection

Need help? Email contact@animesenpai.com.
  `

  return {
    subject: '🚨 Security Alert - AnimeSenpai',
    html,
    text,
  }
}

export function getTwoFactorCodeContent(params: { code: string; name?: string; frontendUrl?: string }): EmailTemplateContent {
  const frontendUrl = getFrontendUrl(params.frontendUrl)
  const paragraph = (content: string) => `<p style="${EMAIL_STYLES.paragraph}">${content}</p>`
  const body = [
    paragraph(`Here's your 6-digit code for <strong style="color:#c084fc;">AnimeSenpai</strong>. Enter it within the next 10 minutes to complete your sign-in.`),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0; border-radius:20px; background: linear-gradient(135deg, rgba(168, 85, 247, 0.32) 0%, rgba(99, 102, 241, 0.18) 100%); border:1px solid rgba(129, 140, 248, 0.35); box-shadow:0 20px 45px rgba(99, 102, 241, 0.26);">
      <tr>
        <td style="padding:26px 24px; text-align:center;">
          <p style="${EMAIL_STYLES.small}; text-transform:uppercase; letter-spacing:0.22em; color: rgba(220, 215, 255, 0.85); margin-bottom:14px;">Your one-time code</p>
          <span style="display:inline-block; font-size:38px; letter-spacing:14px; color: rgba(247, 244, 255, 0.98); font-weight:700; font-family:'Courier New', monospace;">${params.code}</span>
          <p style="color: rgba(214, 211, 247, 0.85); font-size:13px; margin:16px 0 0;">Expires in 10 minutes</p>
        </td>
      </tr>
    </table>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
      ${[
        {
          icon: '🛡️',
          title: 'For your security',
          copy: "Never share this code outside AnimeSenpai. We'll never ask for it in DMs or calls.",
        },
        {
          icon: '🔁',
          title: 'Need a new code?',
          copy: 'Request another from the login screen to instantly replace this one.',
        },
      ]
        .map(
          (item) => `
            <tr>
              <td style="padding-bottom:12px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:14px; background: rgba(15, 23, 42, 0.6); border:1px solid rgba(148, 163, 184, 0.25);">
                  <tr>
                    <td width="38" valign="top" style="padding:16px 0 16px 18px; font-size:18px; color:#ffffff;">${item.icon}</td>
                    <td valign="top" style="padding:16px 18px 16px 6px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="color: rgba(248, 250, 252, 0.95); font-size:14px; font-weight:600; padding-bottom:4px;">${item.title}</td>
                        </tr>
                        <tr>
                          <td style="color: rgba(203, 213, 225, 0.9); font-size:13px; line-height:1.6;">${item.copy}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          `,
        )
        .join('')}
    </table>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px; border-radius:14px; background: rgba(15, 23, 42, 0.55); border:1px solid rgba(148, 163, 184, 0.2);">
      <tr>
        <td style="padding:16px;">
          <p style="${EMAIL_STYLES.small}">
            Didn't request this code? Email <a href="mailto:contact@animesenpai.com" style="color:#c4b5fd; text-decoration:none;">contact@animesenpai.com</a> so we can help secure things.
          </p>
        </td>
      </tr>
    </table>`,
  ].join('')

  const html = renderEmailLayout({
    preheader: 'Your AnimeSenpai two-factor authentication code.',
    accent: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
    accentSolid: '#a855f7',
    eyebrow: 'Two-factor authentication',
    title: 'Here\'s your 6-digit code',
    subtitle: 'Keep this between us — it protects your account',
    heroEmoji: '🔐',
    greeting: params.name ? `Hi ${params.name},` : 'Hi there,',
    body,
    secondaryNote: `Need to secure things? <a href="${frontendUrl}/user/settings?tab=security" style="color:#c4b5fd; text-decoration:none;">Change your password</a>.`,
  })

  const text = `
AnimeSenpai security code

Hi${params.name ? ` ${params.name}` : ''},

Your one-time 2FA code is: ${params.code}
It expires in 10 minutes, so enter it soon to finish signing in.

Didn't request this code? Reset your password and review active sessions.

Thanks for keeping your account secure!

Need help? Email contact@animesenpai.com.
  `

  return {
    subject: 'Your AnimeSenpai verification code',
    html,
    text,
  }
}

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
      await resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: template.to,
        subject: template.subject,
        html: template.html,
        ...(template.text !== undefined && { text: template.text }),
      });

      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  async sendEmailVerification(email: string, token: string, name?: string): Promise<boolean> {
    const template = getEmailVerificationContent({
      token,
      ...(name ? { name } : {}),
      frontendUrl: this.frontendUrl,
    })

    return this.sendEmail({
      to: email,
      ...template,
    });
  }

  // Password Reset
  async sendPasswordReset(email: string, token: string, name?: string): Promise<boolean> {
    const template = getPasswordResetContent({
      token,
      ...(name ? { name } : {}),
      frontendUrl: this.frontendUrl,
    })

    return this.sendEmail({
      to: email,
      ...template,
    });
  }

  // Welcome Email
  async sendWelcomeEmail(email: string, name?: string): Promise<boolean> {
    const template = getWelcomeEmailContent({
      ...(name ? { name } : {}),
      frontendUrl: this.frontendUrl,
    })

    return this.sendEmail({
      to: email,
      ...template,
    });
  }

  // Security Alert
  async sendSecurityAlert(email: string, eventType: string, name?: string): Promise<boolean> {
    const template = getSecurityAlertContent({
      eventType,
      ...(name ? { name } : {}),
      frontendUrl: this.frontendUrl,
    })

    return this.sendEmail({
      to: email,
      ...template,
    });
  }

  async sendTwoFactorCode(email: string, code: string, name?: string): Promise<boolean> {
    const template = getTwoFactorCodeContent({
      code,
      ...(name ? { name } : {}),
      frontendUrl: this.frontendUrl,
    })

    return this.sendEmail({
      to: email,
      ...template,
    });
  }

  // Send custom email (for admin use)
  async sendCustomAdminEmail(template: EmailTemplate): Promise<boolean> {
    return this.sendEmail(template);
  }
}

export const emailService = EmailService.getInstance();

/**
 * Send email using the email service
 * Convenience function for direct email sending
 */
export async function sendEmail(template: EmailTemplate): Promise<boolean> {
  return emailService.sendCustomAdminEmail(template);
}
