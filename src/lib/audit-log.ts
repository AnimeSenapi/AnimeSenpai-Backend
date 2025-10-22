/**
 * Audit Logging System
 * Logs all security-sensitive actions for compliance and forensics
 */

import { db } from './db'
import { logger } from './logger'

/**
 * Audit event types
 */
export enum AuditEventType {
  // Authentication events
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_LOGIN_FAILED = 'USER_LOGIN_FAILED',
  USER_SIGNUP = 'USER_SIGNUP',
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_COMPLETE = 'PASSWORD_RESET_COMPLETE',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  
  // Account management
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  ACCOUNT_REACTIVATED = 'ACCOUNT_REACTIVATED',
  
  // Permission changes
  ROLE_CHANGED = 'ROLE_CHANGED',
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_REVOKED = 'PERMISSION_REVOKED',
  
  // Data access
  DATA_EXPORTED = 'DATA_EXPORTED',
  DATA_DELETED = 'DATA_DELETED',
  BULK_UPDATE = 'BULK_UPDATE',
  
  // Admin actions
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  ADMIN_ACTION = 'ADMIN_ACTION',
  SETTINGS_CHANGED = 'SETTINGS_CHANGED',
  USER_IMPERSONATION = 'USER_IMPERSONATION',
  
  // Security events
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  CSRF_VIOLATION = 'CSRF_VIOLATION',
  XSS_ATTEMPT = 'XSS_ATTEMPT',
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
}

/**
 * Audit log severity levels
 */
export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

interface AuditLogEntry {
  event: AuditEventType
  userId?: string
  username?: string
  ipAddress?: string
  userAgent?: string
  severity?: AuditSeverity
  metadata?: Record<string, any>
  result?: 'SUCCESS' | 'FAILURE'
}

/**
 * Log an audit event
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  const {
    event,
    userId,
    username,
    ipAddress,
    userAgent,
    severity = AuditSeverity.INFO,
    metadata = {},
    result = 'SUCCESS',
  } = entry
  
  const timestamp = new Date()
  
  try {
    // Try to save to database
    await db.securityLog.create({
      data: {
        event,
        userId,
        username,
        ipAddress,
        userAgent,
        severity,
        result,
        metadata,
        timestamp,
      },
    }).catch(async (error) => {
      // If SecurityLog table doesn't exist, create it
      if (error.code === 'P2021') {
        console.warn('[Audit] SecurityLog table not found. Please run migrations.')
      }
    })
  } catch (error) {
    // Fallback to file logging if database fails
    logger.security('Audit event', { userId, username }, {
      event,
      severity,
      result,
      ipAddress,
      userAgent,
      metadata,
    })
  }
  
  // Also log critical events to console
  if (severity === AuditSeverity.CRITICAL || severity === AuditSeverity.ERROR) {
    console.error(`[AUDIT ${severity}] ${event}:`, {
      userId,
      username,
      ipAddress,
      result,
      metadata,
    })
  }
}

/**
 * Helper functions for common audit events
 */

export async function logLogin(userId: string, username: string, ipAddress: string, userAgent: string, success: boolean) {
  await logAuditEvent({
    event: success ? AuditEventType.USER_LOGIN : AuditEventType.USER_LOGIN_FAILED,
    userId,
    username,
    ipAddress,
    userAgent,
    severity: success ? AuditSeverity.INFO : AuditSeverity.WARNING,
    result: success ? 'SUCCESS' : 'FAILURE',
  })
}

export async function logLogout(userId: string, username: string, ipAddress: string) {
  await logAuditEvent({
    event: AuditEventType.USER_LOGOUT,
    userId,
    username,
    ipAddress,
    severity: AuditSeverity.INFO,
  })
}

export async function logSignup(userId: string, username: string, email: string, ipAddress: string) {
  await logAuditEvent({
    event: AuditEventType.USER_SIGNUP,
    userId,
    username,
    ipAddress,
    metadata: { email },
    severity: AuditSeverity.INFO,
  })
}

export async function logPasswordChange(userId: string, username: string, ipAddress: string, method: 'reset' | 'change') {
  await logAuditEvent({
    event: method === 'reset' ? AuditEventType.PASSWORD_RESET_COMPLETE : AuditEventType.PASSWORD_CHANGED,
    userId,
    username,
    ipAddress,
    severity: AuditSeverity.INFO,
    metadata: { method },
  })
}

export async function logRoleChange(adminUserId: string, targetUserId: string, oldRole: string, newRole: string, ipAddress: string) {
  await logAuditEvent({
    event: AuditEventType.ROLE_CHANGED,
    userId: adminUserId,
    ipAddress,
    severity: AuditSeverity.WARNING,
    metadata: {
      targetUserId,
      oldRole,
      newRole,
    },
  })
}

export async function logAdminAction(userId: string, username: string, action: string, ipAddress: string, metadata?: Record<string, any>) {
  await logAuditEvent({
    event: AuditEventType.ADMIN_ACTION,
    userId,
    username,
    ipAddress,
    severity: AuditSeverity.WARNING,
    metadata: {
      action,
      ...metadata,
    },
  })
}

export async function logDataExport(userId: string, username: string, dataType: string, ipAddress: string) {
  await logAuditEvent({
    event: AuditEventType.DATA_EXPORTED,
    userId,
    username,
    ipAddress,
    severity: AuditSeverity.INFO,
    metadata: { dataType },
  })
}

export async function logSuspiciousActivity(userId: string | undefined, activity: string, ipAddress: string, metadata?: Record<string, any>) {
  await logAuditEvent({
    event: AuditEventType.SUSPICIOUS_ACTIVITY,
    userId,
    ipAddress,
    severity: AuditSeverity.ERROR,
    metadata: {
      activity,
      ...metadata,
    },
  })
}

export async function logSecurityViolation(
  type: 'CSRF' | 'XSS' | 'SQL_INJECTION' | 'UNAUTHORIZED',
  ipAddress: string,
  metadata?: Record<string, any>
) {
  const eventMap = {
    CSRF: AuditEventType.CSRF_VIOLATION,
    XSS: AuditEventType.XSS_ATTEMPT,
    SQL_INJECTION: AuditEventType.SQL_INJECTION_ATTEMPT,
    UNAUTHORIZED: AuditEventType.UNAUTHORIZED_ACCESS,
  }
  
  await logAuditEvent({
    event: eventMap[type],
    ipAddress,
    severity: AuditSeverity.CRITICAL,
    result: 'FAILURE',
    metadata,
  })
}

/**
 * Query audit logs
 */
export async function getAuditLogs(filters: {
  userId?: string
  event?: AuditEventType
  severity?: AuditSeverity
  startDate?: Date
  endDate?: Date
  limit?: number
}) {
  const {
    userId,
    event,
    severity,
    startDate,
    endDate,
    limit = 100,
  } = filters
  
  try {
    const logs = await db.securityLog.findMany({
      where: {
        ...(userId && { userId }),
        ...(event && { event }),
        ...(severity && { severity }),
        ...(startDate || endDate ? {
          timestamp: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        } : {}),
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
    })
    
    return logs
  } catch {
    return []
  }
}

/**
 * Get audit log statistics
 */
export async function getAuditStats(days: number = 7) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  try {
    const [
      totalEvents,
      failedLogins,
      suspiciousActivity,
      criticalEvents,
    ] = await Promise.all([
      db.securityLog.count({
        where: { timestamp: { gte: startDate } },
      }),
      db.securityLog.count({
        where: {
          event: AuditEventType.USER_LOGIN_FAILED,
          timestamp: { gte: startDate },
        },
      }),
      db.securityLog.count({
        where: {
          event: AuditEventType.SUSPICIOUS_ACTIVITY,
          timestamp: { gte: startDate },
        },
      }),
      db.securityLog.count({
        where: {
          severity: AuditSeverity.CRITICAL,
          timestamp: { gte: startDate },
        },
      }),
    ])
    
    return {
      totalEvents,
      failedLogins,
      suspiciousActivity,
      criticalEvents,
      period: `${days} days`,
    }
  } catch {
    return {
      totalEvents: 0,
      failedLogins: 0,
      suspiciousActivity: 0,
      criticalEvents: 0,
      period: `${days} days`,
    }
  }
}

