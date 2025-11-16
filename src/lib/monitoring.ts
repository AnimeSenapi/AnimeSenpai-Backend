import { logger } from './logger'
import { sendAlert } from './alerts'

interface ErrorMetrics {
  timestamp: number
  errorCount: number
  totalRequests: number
  errorRate: number
  endpoint?: string
  statusCode?: number
  errorType?: string
}

interface AlertThresholds {
  errorRateThreshold: number // percentage
  timeWindow: number // minutes
  minRequests: number // minimum requests to trigger alert
}

class ErrorRateMonitor {
  private errorMetrics: ErrorMetrics[] = []
  private thresholds: AlertThresholds
  private lastAlertTime: number = 0
  private alertCooldown: number = 5 * 60 * 1000 // 5 minutes

  constructor(thresholds: AlertThresholds = {
    errorRateThreshold: 5, // 5% error rate
    timeWindow: 5, // 5 minutes
    minRequests: 10 // minimum 10 requests
  }) {
    this.thresholds = thresholds
  }

  recordError(endpoint?: string, statusCode?: number, errorType?: string) {
    const now = Date.now()
    const errorMetric: ErrorMetrics = {
      timestamp: now,
      errorCount: 1,
      totalRequests: 1,
      errorRate: 100,
      ...(endpoint !== undefined && { endpoint }),
      ...(statusCode !== undefined && { statusCode }),
      ...(errorType !== undefined && { errorType })
    }

    this.errorMetrics.push(errorMetric)
    this.cleanupOldMetrics()
    this.checkErrorRate()
  }

  recordRequest(endpoint?: string, statusCode?: number) {
    const now = Date.now()
    const isError = statusCode && statusCode >= 400
    
    const metric: ErrorMetrics = {
      timestamp: now,
      errorCount: isError ? 1 : 0,
      totalRequests: 1,
      errorRate: isError ? 100 : 0,
      ...(endpoint !== undefined && { endpoint }),
      ...(statusCode !== undefined && { statusCode })
    }

    this.errorMetrics.push(metric)
    this.cleanupOldMetrics()
    this.checkErrorRate()
  }

  private cleanupOldMetrics() {
    const cutoff = Date.now() - (this.thresholds.timeWindow * 60 * 1000)
    this.errorMetrics = this.errorMetrics.filter(metric => metric.timestamp > cutoff)
  }

  private checkErrorRate() {
    const now = Date.now()
    const timeWindow = this.thresholds.timeWindow * 60 * 1000
    const windowStart = now - timeWindow

    // Get metrics within the time window
    const recentMetrics = this.errorMetrics.filter(metric => metric.timestamp >= windowStart)
    
    if (recentMetrics.length === 0) return

    // Calculate aggregated error rate
    const totalErrors = recentMetrics.reduce((sum, metric) => sum + metric.errorCount, 0)
    const totalRequests = recentMetrics.reduce((sum, metric) => sum + metric.totalRequests, 0)
    
    if (totalRequests < this.thresholds.minRequests) return

    const errorRate = (totalErrors / totalRequests) * 100

    // Check if error rate exceeds threshold
    if (errorRate > this.thresholds.errorRateThreshold) {
      // Check cooldown to avoid spam
      if (now - this.lastAlertTime > this.alertCooldown) {
        this.sendErrorRateAlert(errorRate, totalErrors, totalRequests, recentMetrics)
        this.lastAlertTime = now
      }
    }
  }

  private async sendErrorRateAlert(
    errorRate: number, 
    totalErrors: number, 
    totalRequests: number, 
    recentMetrics: ErrorMetrics[]
  ) {
    const alertMessage = {
      title: '🚨 High Error Rate Detected',
      message: `Error rate: ${errorRate.toFixed(2)}% (${totalErrors}/${totalRequests} requests)`,
      details: {
        errorRate: errorRate.toFixed(2),
        totalErrors,
        totalRequests,
        timeWindow: `${this.thresholds.timeWindow} minutes`,
        threshold: `${this.thresholds.errorRateThreshold}%`
      },
      topErrors: this.getTopErrors(recentMetrics),
      timestamp: new Date().toISOString()
    }

    logger.error('High error rate detected', undefined, undefined, alertMessage)

    try {
      // Send alerts using the new unified API
      await sendAlert(
        {
          to: process.env.ALERT_EMAIL || 'admin@animesenpai.com',
          subject: `High Error Rate Alert - ${errorRate.toFixed(2)}%`,
          html: this.formatEmailAlert(alertMessage),
          text: this.formatTextAlert(alertMessage)
        },
        {
          webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
          channel: '#alerts',
          message: `🚨 *High Error Rate Alert*\n\n` +
                  `*Error Rate:* ${errorRate.toFixed(2)}%\n` +
                  `*Errors:* ${totalErrors}/${totalRequests} requests\n` +
                  `*Time Window:* ${this.thresholds.timeWindow} minutes\n` +
                  `*Threshold:* ${this.thresholds.errorRateThreshold}%\n\n` +
                  `*Top Errors:*\n${this.formatTopErrors(recentMetrics)}`,
          color: 'danger'
        }
      )
    } catch (error) {
      logger.error('Failed to send error rate alert', error instanceof Error ? error : new Error(String(error)))
    }
  }

  private getTopErrors(metrics: ErrorMetrics[]): Record<string, number> {
    const errorCounts: Record<string, number> = {}
    
    metrics.forEach(metric => {
      if (metric.errorCount > 0) {
        const key = `${metric.endpoint || 'unknown'}:${metric.statusCode || 'unknown'}`
        errorCounts[key] = (errorCounts[key] || 0) + metric.errorCount
      }
    })

    return Object.entries(errorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .reduce((obj, [key, count]) => ({ ...obj, [key]: count }), {})
  }

  private formatTopErrors(metrics: ErrorMetrics[]): string {
    const topErrors = this.getTopErrors(metrics)
    return Object.entries(topErrors)
      .map(([key, count]) => `• ${key}: ${count} errors`)
      .join('\n')
  }

  private formatTextAlert(alert: any): string {
    return `
🚨 High Error Rate Alert

Error Rate: ${alert.details.errorRate}%
Total Errors: ${alert.details.totalErrors}
Total Requests: ${alert.details.totalRequests}
Time Window: ${alert.details.timeWindow}
Threshold: ${alert.details.threshold}

Top Errors:
${Object.entries(alert.topErrors)
  .map(([key, count]) => `• ${key}: ${count} errors`)
  .join('\n')}

Alert generated at: ${alert.timestamp}
    `.trim()
  }

  private formatEmailAlert(alert: any): string {
    return `
      <h2>🚨 High Error Rate Alert</h2>
      <p><strong>Error Rate:</strong> ${alert.details.errorRate}%</p>
      <p><strong>Total Errors:</strong> ${alert.details.totalErrors}</p>
      <p><strong>Total Requests:</strong> ${alert.details.totalRequests}</p>
      <p><strong>Time Window:</strong> ${alert.details.timeWindow}</p>
      <p><strong>Threshold:</strong> ${alert.details.threshold}</p>
      
      <h3>Top Errors:</h3>
      <ul>
        ${Object.entries(alert.topErrors)
          .map(([key, count]) => `<li>${key}: ${count} errors</li>`)
          .join('')}
      </ul>
      
      <p><em>Alert generated at: ${alert.timestamp}</em></p>
    `
  }

  getCurrentMetrics(): {
    errorRate: number
    totalErrors: number
    totalRequests: number
    timeWindow: number
  } {
    const now = Date.now()
    const timeWindow = this.thresholds.timeWindow * 60 * 1000
    const windowStart = now - timeWindow
    const recentMetrics = this.errorMetrics.filter(metric => metric.timestamp >= windowStart)
    
    const totalErrors = recentMetrics.reduce((sum, metric) => sum + metric.errorCount, 0)
    const totalRequests = recentMetrics.reduce((sum, metric) => sum + metric.totalRequests, 0)
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0

    return {
      errorRate,
      totalErrors,
      totalRequests,
      timeWindow: this.thresholds.timeWindow
    }
  }
}

// Global error rate monitor instance
export const errorRateMonitor = new ErrorRateMonitor()

// Middleware to automatically track requests and errors
export function errorRateMiddleware() {
  return (req: any, res: any, next: any) => {
    // Track the request
    res.on('finish', () => {
      const endpoint = `${req.method} ${req.path}`
      const statusCode = res.statusCode
      
      if (statusCode >= 400) {
        errorRateMonitor.recordError(endpoint, statusCode, 'HTTP_ERROR')
      } else {
        errorRateMonitor.recordRequest(endpoint, statusCode)
      }
    })
    
    next()
  }
}

// Function to manually record errors
export function recordError(endpoint?: string, statusCode?: number, errorType?: string) {
  errorRateMonitor.recordError(endpoint, statusCode, errorType)
}

// Function to get current error metrics
export function getErrorMetrics() {
  return errorRateMonitor.getCurrentMetrics()
}
