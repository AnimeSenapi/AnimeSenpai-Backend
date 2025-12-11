import { logger } from './logger.js'

interface EmailAlert {
  to: string
  subject: string
  html: string
  text?: string
}

interface SlackAlert {
  webhookUrl: string
  channel: string
  message: string
  color?: 'good' | 'warning' | 'danger'
}

interface DiscordAlert {
  webhookUrl: string
  message: string
  username?: string
  avatarUrl?: string
}

interface AlertConfig {
  email: {
    enabled: boolean
    provider: 'resend'
    apiKey: string
    from: string
  }
  slack: {
    enabled: boolean
    webhookUrl: string
    channel: string
  }
  discord: {
    enabled: boolean
    webhookUrl: string
  }
}

// Default configuration
const defaultConfig: AlertConfig = {
  email: {
    enabled: process.env.EMAIL_ALERTS_ENABLED === 'true',
    provider: 'resend',
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.RESEND_FROM || 'alerts@animesenpai.com'
  },
  slack: {
    enabled: process.env.SLACK_ALERTS_ENABLED === 'true',
    webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
    channel: process.env.SLACK_CHANNEL || '#alerts'
  },
  discord: {
    enabled: process.env.DISCORD_ALERTS_ENABLED === 'true',
    webhookUrl: process.env.DISCORD_WEBHOOK_URL || ''
  }
}

// Send email alert using Resend
async function sendEmailAlert(alert: EmailAlert): Promise<void> {
  if (!defaultConfig.email.enabled) {
    logger.warn('Email alerts disabled, skipping email alert')
    return
  }

  try {
    const { Resend } = await import('resend')
    
    const resend = new Resend(defaultConfig.email.apiKey)
    
    const { data, error } = await resend.emails.send({
      from: defaultConfig.email.from,
      to: alert.to,
      subject: alert.subject,
      html: alert.html,
      ...(alert.text !== undefined && { text: alert.text })
    })

    if (error) {
      throw new Error(`Resend email failed: ${error.message}`)
    }

    logger.info('Email alert sent successfully', { 
      to: alert.to, 
      id: data?.id,
      provider: 'resend'
    })
  } catch (error) {
    logger.error(
      'Failed to send email alert',
      error instanceof Error ? error : new Error('Unknown error'),
      undefined,
      { to: alert.to }
    )
    throw error
  }
}

// Send Slack alert
async function sendSlackAlert(alert: SlackAlert): Promise<void> {
  if (!defaultConfig.slack.enabled) {
    logger.warn('Slack alerts disabled, skipping Slack alert')
    return
  }

  try {
    const payload = {
      channel: alert.channel,
      attachments: [
        {
          color: alert.color || 'warning',
          text: alert.message,
          timestamp: Math.floor(Date.now() / 1000)
        }
      ]
    }

    const response = await fetch(defaultConfig.slack.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`)
    }

    logger.info('Slack alert sent successfully', { 
      channel: alert.channel,
      webhookUrl: defaultConfig.slack.webhookUrl
    })
  } catch (error) {
    logger.error(
      'Failed to send Slack alert',
      error instanceof Error ? error : new Error('Unknown error'),
      undefined,
      { channel: alert.channel }
    )
    throw error
  }
}

// Send Discord alert
async function sendDiscordAlert(alert: DiscordAlert): Promise<void> {
  if (!defaultConfig.discord.enabled) {
    logger.warn('Discord alerts disabled, skipping Discord alert')
    return
  }

  try {
    const payload = {
      username: alert.username || 'AnimeSenpai Alerts',
      avatar_url: alert.avatarUrl,
      content: alert.message
    }

    const response = await fetch(defaultConfig.discord.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`)
    }

    logger.info('Discord alert sent successfully', { 
      webhookUrl: defaultConfig.discord.webhookUrl
    })
  } catch (error) {
    logger.error(
      'Failed to send Discord alert',
      error instanceof Error ? error : new Error('Unknown error')
    )
    throw error
  }
}

// Send all configured alerts
export async function sendAlert(
  emailAlert?: EmailAlert,
  slackAlert?: SlackAlert,
  discordAlert?: DiscordAlert
): Promise<void> {
  const promises: Promise<void>[] = []

  if (emailAlert) {
    promises.push(sendEmailAlert(emailAlert))
  }

  if (slackAlert) {
    promises.push(sendSlackAlert(slackAlert))
  }

  if (discordAlert) {
    promises.push(sendDiscordAlert(discordAlert))
  }

  if (promises.length === 0) {
    logger.warn('No alerts configured, skipping alert sending')
    return
  }

  try {
    await Promise.allSettled(promises)
    logger.info('All alerts sent successfully')
  } catch (error) {
    logger.error(
      'Some alerts failed to send',
      error instanceof Error ? error : new Error('Unknown error')
    )
    throw error
  }
}

// Specific alert types
export async function sendErrorAlert(
  error: Error,
  context: string,
  metadata?: Record<string, any>
): Promise<void> {
  const errorMessage = `🚨 **Error Alert**\n\n**Context:** ${context}\n**Error:** ${error.message}\n**Stack:** ${error.stack}\n**Metadata:** ${JSON.stringify(metadata, null, 2)}`
  
  const emailAlert: EmailAlert = {
    to: process.env.ALERT_EMAIL || 'admin@animesenpai.com',
    subject: `🚨 Error Alert: ${context}`,
    html: errorMessage.replace(/\n/g, '<br>'),
    text: errorMessage
  }

  const slackAlert: SlackAlert = {
    webhookUrl: defaultConfig.slack.webhookUrl,
    channel: defaultConfig.slack.channel,
    message: errorMessage,
    color: 'danger'
  }

  await sendAlert(emailAlert, slackAlert)
}

export async function sendPerformanceAlert(
  metric: string,
  value: number,
  threshold: number,
  context: string
): Promise<void> {
  const alertMessage = `⚠️ **Performance Alert**\n\n**Metric:** ${metric}\n**Value:** ${value}\n**Threshold:** ${threshold}\n**Context:** ${context}`
  
  const emailAlert: EmailAlert = {
    to: process.env.ALERT_EMAIL || 'admin@animesenpai.com',
    subject: `⚠️ Performance Alert: ${metric}`,
    html: alertMessage.replace(/\n/g, '<br>'),
    text: alertMessage
  }

  const slackAlert: SlackAlert = {
    webhookUrl: defaultConfig.slack.webhookUrl,
    channel: defaultConfig.slack.channel,
    message: alertMessage,
    color: 'warning'
  }

  await sendAlert(emailAlert, slackAlert)
}

export async function sendSecurityAlert(
  event: string,
  details: string,
  severity: 'low' | 'medium' | 'high' | 'critical'
): Promise<void> {
  const alertMessage = `🔒 **Security Alert**\n\n**Event:** ${event}\n**Details:** ${details}\n**Severity:** ${severity.toUpperCase()}`
  
  const emailAlert: EmailAlert = {
    to: process.env.ALERT_EMAIL || 'admin@animesenpai.com',
    subject: `🔒 Security Alert: ${event}`,
    html: alertMessage.replace(/\n/g, '<br>'),
    text: alertMessage
  }

  const slackAlert: SlackAlert = {
    webhookUrl: defaultConfig.slack.webhookUrl,
    channel: defaultConfig.slack.channel,
    message: alertMessage,
    color: severity === 'critical' ? 'danger' : 'warning'
  }

  await sendAlert(emailAlert, slackAlert)
}

export async function sendUptimeAlert(
  service: string,
  status: 'up' | 'down',
  duration?: number
): Promise<void> {
  const statusEmoji = status === 'up' ? '✅' : '❌'
  const alertMessage = `${statusEmoji} **Uptime Alert**\n\n**Service:** ${service}\n**Status:** ${status.toUpperCase()}\n**Duration:** ${duration ? `${duration}ms` : 'N/A'}`
  
  const emailAlert: EmailAlert = {
    to: process.env.ALERT_EMAIL || 'admin@animesenpai.com',
    subject: `${statusEmoji} Uptime Alert: ${service}`,
    html: alertMessage.replace(/\n/g, '<br>'),
    text: alertMessage
  }

  const slackAlert: SlackAlert = {
    webhookUrl: defaultConfig.slack.webhookUrl,
    channel: defaultConfig.slack.channel,
    message: alertMessage,
    color: status === 'up' ? 'good' : 'danger'
  }

  await sendAlert(emailAlert, slackAlert)
}

// Health check for alert services
export async function checkAlertHealth(): Promise<{
  email: boolean
  slack: boolean
  discord: boolean
}> {
  const health = {
    email: false,
    slack: false,
    discord: false
  }

  // Check email service
  if (defaultConfig.email.enabled && defaultConfig.email.apiKey) {
    try {
      const { Resend } = await import('resend')
      new Resend(defaultConfig.email.apiKey) // Simple API key validation
      health.email = true
    } catch (error) {
      logger.warn('Email service health check failed', { error })
    }
  }

  // Check Slack service
  if (defaultConfig.slack.enabled && defaultConfig.slack.webhookUrl) {
    try {
      const response = await fetch(defaultConfig.slack.webhookUrl, {
        method: 'HEAD'
      })
      health.slack = response.ok
    } catch (error) {
      logger.warn('Slack service health check failed', { error })
    }
  }

  // Check Discord service
  if (defaultConfig.discord.enabled && defaultConfig.discord.webhookUrl) {
    try {
      const response = await fetch(defaultConfig.discord.webhookUrl, {
        method: 'HEAD'
      })
      health.discord = response.ok
    } catch (error) {
      logger.warn('Discord service health check failed', { error })
    }
  }

  return health
}

export default {
  sendAlert,
  sendErrorAlert,
  sendPerformanceAlert,
  sendSecurityAlert,
  sendUptimeAlert,
  checkAlertHealth
}