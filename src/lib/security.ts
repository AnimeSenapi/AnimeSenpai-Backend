/**
 * Advanced Security Features
 * 
 * Comprehensive security implementation including OWASP protection,
 * threat detection, and security monitoring for the AnimeSenpai backend.
 */

import { logger } from './logger'
import { db } from './db'
import { AppError, ErrorCode } from './errors'
import { rateLimiter } from './rate-limiter'

// Security threat types
enum ThreatType {
  SQL_INJECTION = 'sql_injection',
  XSS = 'xss',
  CSRF = 'csrf',
  BRUTE_FORCE = 'brute_force',
  DDoS = 'ddos',
  DATA_EXFILTRATION = 'data_exfiltration',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity'
}

// Security event interface
interface SecurityEvent {
  id: string
  type: ThreatType
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: number
  source: {
    ip: string
    userAgent: string
    userId?: string
    sessionId?: string
  }
  details: {
    description: string
    payload?: any
    endpoint?: string
    method?: string
    headers?: Record<string, string>
  }
  action: 'blocked' | 'flagged' | 'monitored'
  resolved: boolean
}

// Security configuration
interface SecurityConfig {
  maxLoginAttempts: number
  lockoutDuration: number
  suspiciousActivityThreshold: number
  ipWhitelist: string[]
  ipBlacklist: string[]
  allowedOrigins: string[]
  maxRequestSize: number
  enableCSP: boolean
  enableHSTS: boolean
  enableXSSProtection: boolean
}

// IP reputation data
interface IPReputation {
  ip: string
  reputation: 'good' | 'neutral' | 'bad' | 'unknown'
  riskScore: number
  lastSeen: number
  violations: number
  country?: string
  isp?: string
}

class SecurityManager {
  private config: SecurityConfig
  private securityEvents: SecurityEvent[] = []
  private ipReputation = new Map<string, IPReputation>()
  private blockedIPs = new Set<string>()
  private suspiciousUsers = new Set<string>()
  private securityRules: Map<string, (data: any) => boolean> = new Map()

  constructor() {
    this.config = {
      maxLoginAttempts: parseInt(process.env.SECURITY_MAX_LOGIN_ATTEMPTS || '5'),
      lockoutDuration: parseInt(process.env.SECURITY_LOCKOUT_DURATION || '900000'), // 15 minutes
      suspiciousActivityThreshold: parseInt(process.env.SECURITY_SUSPICIOUS_THRESHOLD || '10'),
      ipWhitelist: (process.env.SECURITY_IP_WHITELIST || '').split(',').filter(Boolean),
      ipBlacklist: (process.env.SECURITY_IP_BLACKLIST || '').split(',').filter(Boolean),
      allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
      maxRequestSize: parseInt(process.env.SECURITY_MAX_REQUEST_SIZE || '10485760'), // 10MB
      enableCSP: process.env.SECURITY_ENABLE_CSP === 'true',
      enableHSTS: process.env.SECURITY_ENABLE_HSTS === 'true',
      enableXSSProtection: process.env.SECURITY_ENABLE_XSS_PROTECTION === 'true'
    }

    this.initializeSecurityRules()
    this.startSecurityMonitoring()
  }

  /**
   * Initialize security rules and patterns
   */
  private initializeSecurityRules(): void {
    // SQL Injection patterns
    this.securityRules.set('sql_injection', (data: string) => {
      const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
        /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
        /(\b(OR|AND)\s+'.*'\s*=\s*'.*')/i,
        /(\b(OR|AND)\s+".*"\s*=\s*".*")/i,
        /(UNION\s+SELECT)/i,
        /(DROP\s+TABLE)/i,
        /(INSERT\s+INTO)/i,
        /(UPDATE\s+SET)/i,
        /(DELETE\s+FROM)/i,
        /(EXEC\s*\()/i,
        /(SCRIPT\s*\()/i,
        /(WAITFOR\s+DELAY)/i,
        /(BENCHMARK\s*\()/i,
        /(SLEEP\s*\()/i
      ]
      return sqlPatterns.some(pattern => pattern.test(data))
    })

    // XSS patterns
    this.securityRules.set('xss', (data: string) => {
      const xssPatterns = [
        /<script[^>]*>.*?<\/script>/gi,
        /<script[^>]*>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<iframe[^>]*>.*?<\/iframe>/gi,
        /<object[^>]*>.*?<\/object>/gi,
        /<embed[^>]*>.*?<\/embed>/gi,
        /<link[^>]*>.*?<\/link>/gi,
        /<meta[^>]*>.*?<\/meta>/gi,
        /<style[^>]*>.*?<\/style>/gi,
        /<img[^>]*onerror[^>]*>/gi,
        /<svg[^>]*>.*?<\/svg>/gi,
        /<math[^>]*>.*?<\/math>/gi,
        /<form[^>]*>.*?<\/form>/gi,
        /<input[^>]*>.*?<\/input>/gi,
        /<textarea[^>]*>.*?<\/textarea>/gi,
        /<select[^>]*>.*?<\/select>/gi,
        /<option[^>]*>.*?<\/option>/gi,
        /<button[^>]*>.*?<\/button>/gi,
        /<a[^>]*href[^>]*>.*?<\/a>/gi
      ]
      return xssPatterns.some(pattern => pattern.test(data))
    })

    // CSRF patterns
    this.securityRules.set('csrf', (data: any) => {
      // Check for missing or invalid CSRF tokens
      return !data.csrfToken || !this.validateCSRFToken(data.csrfToken)
    })

    // Brute force patterns
    this.securityRules.set('brute_force', (data: any) => {
      const { ip, userId, endpoint } = data
      const key = `brute_force:${ip}:${userId || 'anonymous'}:${endpoint}`
      const attempts = this.getSecurityEventCount(key, 300000) // 5 minutes
      return attempts >= this.config.maxLoginAttempts
    })

    // DDoS patterns
    this.securityRules.set('ddos', (data: any) => {
      const { ip } = data
      const requests = this.getSecurityEventCount(`ddos:${ip}`, 60000) // 1 minute
      return requests > 100 // More than 100 requests per minute
    })

    // Data exfiltration patterns
    this.securityRules.set('data_exfiltration', (data: any) => {
      const { endpoint, responseSize } = data
      // Check for suspicious data access patterns
      return endpoint.includes('export') || endpoint.includes('download') || 
             (responseSize && responseSize > 1000000) // 1MB response
    })
  }

  /**
   * Start security monitoring
   */
  private startSecurityMonitoring(): void {
    // Monitor for suspicious activity every minute
    setInterval(() => {
      this.analyzeSecurityEvents()
    }, 60000)

    // Clean up old security events every hour
    setInterval(() => {
      this.cleanupOldEvents()
    }, 3600000)
  }

  /**
   * Analyze incoming request for security threats
   */
  async analyzeRequest(request: Request, userId?: string): Promise<{
    allowed: boolean
    reason?: string
    securityEvent?: SecurityEvent
  }> {
    const ip = this.getClientIP(request)
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const endpoint = new URL(request.url).pathname
    const method = request.method

    // Check IP blacklist
    if (this.blockedIPs.has(ip)) {
      return {
        allowed: false,
        reason: 'IP address is blocked'
      }
    }

    // Check IP reputation
    const reputation = await this.getIPReputation(ip)
    if (reputation.reputation === 'bad' || reputation.riskScore > 80) {
      await this.recordSecurityEvent({
        type: ThreatType.UNAUTHORIZED_ACCESS,
        severity: 'high',
        source: { ip, userAgent, userId },
        details: {
          description: 'Request from high-risk IP address',
          endpoint,
          method
        },
        action: 'blocked'
      })
      return {
        allowed: false,
        reason: 'High-risk IP address'
      }
    }

    // Check for suspicious activity patterns
    const suspiciousActivity = await this.detectSuspiciousActivity(ip, userId, endpoint)
    if (suspiciousActivity) {
      return {
        allowed: false,
        reason: 'Suspicious activity detected'
      }
    }

    // Check request size
    const contentLength = parseInt(request.headers.get('content-length') || '0')
    if (contentLength > this.config.maxRequestSize) {
      await this.recordSecurityEvent({
        type: ThreatType.DATA_EXFILTRATION,
        severity: 'medium',
        source: { ip, userAgent, userId },
        details: {
          description: 'Request size exceeds limit',
          endpoint,
          method,
          payload: { contentLength, maxSize: this.config.maxRequestSize }
        },
        action: 'blocked'
      })
      return {
        allowed: false,
        reason: 'Request size exceeds limit'
      }
    }

    return { allowed: true }
  }

  /**
   * Analyze request body for security threats
   */
  async analyzeRequestBody(body: any, request: Request): Promise<{
    safe: boolean
    threats: ThreatType[]
    sanitized?: any
  }> {
    const threats: ThreatType[] = []
    let sanitized = body

    if (typeof body === 'string') {
      // Check for SQL injection
      if (this.securityRules.get('sql_injection')?.(body)) {
        threats.push(ThreatType.SQL_INJECTION)
      }

      // Check for XSS
      if (this.securityRules.get('xss')?.(body)) {
        threats.push(ThreatType.XSS)
        sanitized = this.sanitizeInput(body)
      }
    }

    if (typeof body === 'object' && body !== null) {
      // Recursively check object properties
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === 'string') {
          if (this.securityRules.get('sql_injection')?.(value)) {
            threats.push(ThreatType.SQL_INJECTION)
          }
          if (this.securityRules.get('xss')?.(value)) {
            threats.push(ThreatType.XSS)
            sanitized = { ...sanitized, [key]: this.sanitizeInput(value) }
          }
        }
      }
    }

    // Check for CSRF
    if (this.securityRules.get('csrf')?.(body)) {
      threats.push(ThreatType.CSRF)
    }

    return {
      safe: threats.length === 0,
      threats,
      sanitized: threats.length > 0 ? sanitized : undefined
    }
  }

  /**
   * Detect suspicious activity patterns
   */
  private async detectSuspiciousActivity(ip: string, userId?: string, endpoint?: string): Promise<boolean> {
    // Check for rapid successive requests
    const recentRequests = this.getSecurityEventCount(`request:${ip}`, 60000) // 1 minute
    if (recentRequests > 50) {
      await this.recordSecurityEvent({
        type: ThreatType.DDoS,
        severity: 'high',
        source: { ip, userAgent: 'unknown' },
        details: {
          description: 'High request frequency detected',
          endpoint: endpoint || 'unknown'
        },
        action: 'blocked'
      })
      return true
    }

    // Check for multiple failed login attempts
    if (endpoint?.includes('login')) {
      const failedLogins = this.getSecurityEventCount(`failed_login:${ip}`, 300000) // 5 minutes
      if (failedLogins >= this.config.maxLoginAttempts) {
        await this.recordSecurityEvent({
          type: ThreatType.BRUTE_FORCE,
          severity: 'high',
          source: { ip, userAgent: 'unknown' },
          details: {
            description: 'Multiple failed login attempts',
            endpoint
          },
          action: 'blocked'
        })
        this.blockedIPs.add(ip)
        return true
      }
    }

    // Check for unusual access patterns
    if (userId) {
      const userActivity = this.getSecurityEventCount(`user_activity:${userId}`, 3600000) // 1 hour
      if (userActivity > this.config.suspiciousActivityThreshold) {
        await this.recordSecurityEvent({
          type: ThreatType.SUSPICIOUS_ACTIVITY,
          severity: 'medium',
          source: { ip, userAgent: 'unknown', userId },
          details: {
            description: 'Unusual user activity pattern detected',
            endpoint: endpoint || 'unknown'
          },
          action: 'flagged'
        })
        this.suspiciousUsers.add(userId)
        return true
      }
    }

    return false
  }

  /**
   * Record a security event
   */
  async recordSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<void> {
    const securityEvent: SecurityEvent = {
      ...event,
      id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      resolved: false
    }

    this.securityEvents.push(securityEvent)

    // Log security event
    const logLevel = event.severity === 'critical' || event.severity === 'high' ? 'error' : 'warn'
    logger[logLevel](`Security event: ${event.type}`, undefined, {
      ip: event.source.ip,
      userId: event.source.userId,
      endpoint: event.details.endpoint
    }, {
      eventId: securityEvent.id,
      severity: event.severity,
      action: event.action,
      details: event.details
    })

    // Update IP reputation
    await this.updateIPReputation(event.source.ip, event.type, event.severity)

    // Take immediate action if critical
    if (event.severity === 'critical') {
      await this.handleCriticalSecurityEvent(securityEvent)
    }
  }

  /**
   * Handle critical security events
   */
  private async handleCriticalSecurityEvent(event: SecurityEvent): Promise<void> {
    // Block IP immediately
    this.blockedIPs.add(event.source.ip)

    // If user is involved, suspend account
    if (event.source.userId) {
      await this.suspendUser(event.source.userId, 'Security violation')
    }

    // Send alert to administrators
    await this.sendSecurityAlert(event)

    logger.error('Critical security event handled', undefined, undefined, {
      eventId: event.id,
      type: event.type,
      ip: event.source.ip,
      userId: event.source.userId
    })
  }

  /**
   * Sanitize user input
   */
  private sanitizeInput(input: string): string {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim()
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const remoteAddr = request.headers.get('x-remote-addr')
    
    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }
    if (realIP) {
      return realIP
    }
    if (remoteAddr) {
      return remoteAddr
    }
    
    return 'unknown'
  }

  /**
   * Get IP reputation
   */
  private async getIPReputation(ip: string): Promise<IPReputation> {
    if (this.ipReputation.has(ip)) {
      return this.ipReputation.get(ip)!
    }

    // Initialize reputation
    const reputation: IPReputation = {
      ip,
      reputation: 'unknown',
      riskScore: 0,
      lastSeen: Date.now(),
      violations: 0
    }

    this.ipReputation.set(ip, reputation)
    return reputation
  }

  /**
   * Update IP reputation
   */
  private async updateIPReputation(ip: string, threatType: ThreatType, severity: string): Promise<void> {
    const reputation = this.ipReputation.get(ip) || {
      ip,
      reputation: 'unknown' as const,
      riskScore: 0,
      lastSeen: Date.now(),
      violations: 0
    }

    reputation.violations++
    reputation.lastSeen = Date.now()

    // Update risk score based on threat type and severity
    const severityMultiplier = { low: 1, medium: 2, high: 3, critical: 5 }[severity as keyof typeof severityMultiplier]
    const threatScore = { sql_injection: 10, xss: 8, csrf: 6, brute_force: 7, ddos: 9, data_exfiltration: 8, unauthorized_access: 5, suspicious_activity: 3 }[threatType]
    
    reputation.riskScore = Math.min(100, reputation.riskScore + (threatScore * severityMultiplier))

    // Update reputation based on risk score
    if (reputation.riskScore > 80) {
      reputation.reputation = 'bad'
    } else if (reputation.riskScore > 50) {
      reputation.reputation = 'neutral'
    } else if (reputation.riskScore < 20) {
      reputation.reputation = 'good'
    }

    this.ipReputation.set(ip, reputation)
  }

  /**
   * Get security event count for a key within time window
   */
  private getSecurityEventCount(key: string, timeWindow: number): number {
    const cutoff = Date.now() - timeWindow
    return this.securityEvents.filter(event => 
      event.details.description.includes(key) && event.timestamp > cutoff
    ).length
  }

  /**
   * Validate CSRF token
   */
  private validateCSRFToken(token: string): boolean {
    // In a real implementation, you'd validate against stored tokens
    return token && token.length > 10
  }

  /**
   * Suspend user account
   */
  private async suspendUser(userId: string, reason: string): Promise<void> {
    try {
      await db.user.update({
        where: { id: userId },
        data: { 
          isActive: false,
          suspendedAt: new Date(),
          suspensionReason: reason
        }
      })
    } catch (error) {
      logger.error('Failed to suspend user', error as Error, undefined, { userId, reason })
    }
  }

  /**
   * Send security alert
   */
  private async sendSecurityAlert(event: SecurityEvent): Promise<void> {
    // In a real implementation, you'd send alerts via email, Slack, etc.
    logger.error('SECURITY ALERT', undefined, undefined, {
      eventId: event.id,
      type: event.type,
      severity: event.severity,
      ip: event.source.ip,
      userId: event.source.userId,
      description: event.details.description
    })
  }

  /**
   * Analyze security events for patterns
   */
  private analyzeSecurityEvents(): void {
    const recentEvents = this.securityEvents.filter(
      event => event.timestamp > Date.now() - 3600000 // Last hour
    )

    // Check for coordinated attacks
    const ipGroups = new Map<string, SecurityEvent[]>()
    recentEvents.forEach(event => {
      const ip = event.source.ip
      if (!ipGroups.has(ip)) {
        ipGroups.set(ip, [])
      }
      ipGroups.get(ip)!.push(event)
    })

    // Flag IPs with multiple security events
    for (const [ip, events] of ipGroups.entries()) {
      if (events.length > 5) {
        this.blockedIPs.add(ip)
        logger.warn('IP blocked due to multiple security events', undefined, undefined, {
          ip,
          eventCount: events.length
        })
      }
    }
  }

  /**
   * Clean up old security events
   */
  private cleanupOldEvents(): void {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 days
    this.securityEvents = this.securityEvents.filter(event => event.timestamp > cutoff)
    
    logger.debug('Security events cleanup completed', {
      remainingEvents: this.securityEvents.length
    })
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    totalEvents: number
    eventsByType: Record<string, number>
    eventsBySeverity: Record<string, number>
    blockedIPs: number
    suspiciousUsers: number
    topThreats: Array<{ type: string; count: number }>
    recentEvents: SecurityEvent[]
  } {
    const eventsByType: Record<string, number> = {}
    const eventsBySeverity: Record<string, number> = {}

    this.securityEvents.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1
    })

    const topThreats = Object.entries(eventsByType)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const recentEvents = this.securityEvents
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10)

    return {
      totalEvents: this.securityEvents.length,
      eventsByType,
      eventsBySeverity,
      blockedIPs: this.blockedIPs.size,
      suspiciousUsers: this.suspiciousUsers.size,
      topThreats,
      recentEvents
    }
  }

  /**
   * Generate security headers
   */
  generateSecurityHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    }

    if (this.config.enableCSP) {
      headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'"
    }

    if (this.config.enableHSTS) {
      headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
    }

    if (this.config.enableXSSProtection) {
      headers['X-XSS-Protection'] = '1; mode=block'
    }

    return headers
  }
}

// Singleton instance
export const securityManager = new SecurityManager()

export default securityManager
