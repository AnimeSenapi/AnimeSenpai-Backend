/**
 * Logger Configuration
 * 
 * Centralized logging configuration to control debug output
 * and reduce noise in development and production.
 */

export interface LoggerConfig {
  level: 'error' | 'warn' | 'info' | 'debug'
  enableConsoleColors: boolean
  enableTimestamps: boolean
  enableRequestLogging: boolean
  enablePerformanceLogging: boolean
  enableSecurityLogging: boolean
  enableCacheLogging: boolean
  enableDatabaseLogging: boolean
  enableMonitoringLogging: boolean
  enableSystemLogging: boolean
  quietMode: boolean
}

// Default configuration based on environment
export function getLoggerConfig(): LoggerConfig {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const isProduction = process.env.NODE_ENV === 'production'
  const isTest = process.env.NODE_ENV === 'test'
  
  // Override with environment variables
  const logLevel = process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug' || 
    (isDevelopment ? 'info' : 'warn')
  
  const quietMode = process.env.QUIET_MODE === 'true' || isTest

  return {
    level: logLevel,
    enableConsoleColors: !isProduction && !quietMode,
    enableTimestamps: !quietMode,
    enableRequestLogging: !quietMode && process.env.ENABLE_REQUEST_LOGGING !== 'false',
    enablePerformanceLogging: process.env.ENABLE_PERFORMANCE_LOGGING === 'true',
    enableSecurityLogging: process.env.ENABLE_SECURITY_LOGGING !== 'false',
    enableCacheLogging: process.env.ENABLE_CACHE_LOGGING === 'true',
    enableDatabaseLogging: process.env.ENABLE_DATABASE_LOGGING === 'true',
    enableMonitoringLogging: process.env.ENABLE_MONITORING_LOGGING === 'true',
    enableSystemLogging: process.env.ENABLE_SYSTEM_LOGGING !== 'false',
    quietMode
  }
}

// Logging categories for better control
export const LOG_CATEGORIES = {
  REQUEST: 'request',
  PERFORMANCE: 'performance',
  SECURITY: 'security',
  CACHE: 'cache',
  DATABASE: 'database',
  MONITORING: 'monitoring',
  AUTH: 'auth',
  API: 'api',
  ERROR: 'error',
  SYSTEM: 'system'
} as const

export type LogCategory = typeof LOG_CATEGORIES[keyof typeof LOG_CATEGORIES]

// Check if a category should be logged
export function shouldLogCategory(category: LogCategory, config: LoggerConfig): boolean {
  switch (category) {
    case LOG_CATEGORIES.REQUEST:
      return config.enableRequestLogging
    case LOG_CATEGORIES.PERFORMANCE:
      return config.enablePerformanceLogging
    case LOG_CATEGORIES.SECURITY:
      return config.enableSecurityLogging
    case LOG_CATEGORIES.CACHE:
      return config.enableCacheLogging
    case LOG_CATEGORIES.DATABASE:
      return config.enableDatabaseLogging
    case LOG_CATEGORIES.MONITORING:
      return config.enableMonitoringLogging
    case LOG_CATEGORIES.AUTH:
    case LOG_CATEGORIES.API:
    case LOG_CATEGORIES.ERROR:
      return true // Always log these
    case LOG_CATEGORIES.SYSTEM:
      return config.enableSystemLogging
    default:
      return true
  }
}
