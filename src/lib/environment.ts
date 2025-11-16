import { z } from 'zod'
import { logger } from './logger'

// Environment validation schema
const environmentSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.string().transform(Number).default('3004'),
  APP_VERSION: z.string().default('1.0.0'),
  
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // Authentication
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  REFRESH_TOKEN_SECRET: z.string().min(32, 'REFRESH_TOKEN_SECRET must be at least 32 characters'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),
  
  // Email
  EMAIL_SERVICE_URL: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  
  // External Services
  ANALYTICS_SERVICE_URL: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  
  // Security
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'), // 15 minutes
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
  
  // Backup
  BACKUP_DIR: z.string().default('./backups'),
  BACKUP_RETENTION_DAYS: z.string().transform(Number).default('30'),
  BACKUP_COMPRESSION: z.string().transform(val => val === 'true').default('true'),
  BACKUP_ENCRYPTION: z.string().transform(val => val === 'true').default('false'),
  BACKUP_ENCRYPTION_KEY: z.string().optional(),
  
  // Monitoring
  HEALTH_CHECK_INTERVAL: z.string().transform(Number).default('30000'),
  METRICS_ENABLED: z.string().transform(val => val === 'true').default('true'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
})

// Environment types
export type Environment = z.infer<typeof environmentSchema>

// Environment configuration
class EnvironmentManager {
  private config: Environment
  private isProduction: boolean
  private isDevelopment: boolean
  private isStaging: boolean

  constructor() {
    try {
      this.config = environmentSchema.parse(process.env)
      this.isProduction = this.config.NODE_ENV === 'production'
      this.isDevelopment = this.config.NODE_ENV === 'development'
      this.isStaging = this.config.NODE_ENV === 'staging'
      
      logger.info('Environment configuration loaded', {
        nodeEnv: this.config.NODE_ENV,
        port: this.config.PORT,
        version: this.config.APP_VERSION
      })
    } catch (error) {
      logger.error(
        'Environment validation failed',
        error instanceof Error ? error : new Error('Unknown error')
      )
      throw new Error('Invalid environment configuration')
    }
  }

  // Get environment configuration
  getConfig(): Environment {
    return this.config
  }

  // Environment checks
  isProd(): boolean {
    return this.isProduction
  }

  isDev(): boolean {
    return this.isDevelopment
  }

  isStage(): boolean {
    return this.isStaging
  }

  // Get environment-specific configuration
  getDatabaseConfig() {
    return {
      url: this.config.DATABASE_URL,
      ssl: this.isProduction ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: this.isProduction ? 10000 : 5000,
      idleTimeoutMillis: this.isProduction ? 30000 : 10000,
      max: this.isProduction ? 20 : 5
    }
  }

  getJWTConfig() {
    return {
      secret: this.config.JWT_SECRET,
      expiresIn: this.config.JWT_EXPIRES_IN,
      refreshSecret: this.config.REFRESH_TOKEN_SECRET,
      refreshExpiresIn: this.config.REFRESH_TOKEN_EXPIRES_IN
    }
  }

  getCORSConfig() {
    const origins = this.config.CORS_ORIGIN.split(',').map(origin => origin.trim())
    
    return {
      origin: this.isProduction ? origins : true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }
  }

  getRateLimitConfig() {
    return {
      windowMs: this.config.RATE_LIMIT_WINDOW_MS,
      max: this.config.RATE_LIMIT_MAX,
      skipSuccessfulRequests: this.isDevelopment,
      skipFailedRequests: false
    }
  }

  getLoggingConfig() {
    return {
      level: this.config.LOG_LEVEL,
      format: this.config.LOG_FORMAT,
      enableConsole: this.isDevelopment,
      enableFile: this.isProduction
    }
  }

  getMonitoringConfig() {
    return {
      enabled: this.config.METRICS_ENABLED,
      healthCheckInterval: this.config.HEALTH_CHECK_INTERVAL,
      sentryDsn: this.config.SENTRY_DSN
    }
  }

  getBackupConfig() {
    return {
      directory: this.config.BACKUP_DIR,
      retentionDays: this.config.BACKUP_RETENTION_DAYS,
      compression: this.config.BACKUP_COMPRESSION,
      encryption: this.config.BACKUP_ENCRYPTION,
      encryptionKey: this.config.BACKUP_ENCRYPTION_KEY
    }
  }

  // Security configuration
  getSecurityConfig() {
    return {
      jwtSecret: this.config.JWT_SECRET,
      refreshSecret: this.config.REFRESH_TOKEN_SECRET,
      corsOrigin: this.config.CORS_ORIGIN,
      rateLimit: this.getRateLimitConfig(),
      // Add more security settings as needed
      helmet: {
        contentSecurityPolicy: this.isProduction ? {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
          }
        } : false
      }
    }
  }

  // Feature flags based on environment
  getFeatureFlags() {
    return {
      enableSwagger: this.isDevelopment || this.isStaging,
      enableMetrics: this.config.METRICS_ENABLED,
      enableCaching: this.isProduction || this.isStaging,
      enableRateLimiting: this.isProduction || this.isStaging,
      enableCompression: this.isProduction,
      enableSecurityHeaders: this.isProduction,
      enableLogging: true,
      enableHealthChecks: true
    }
  }

  // Validate environment for production
  validateProduction(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (this.isProduction) {
      // Check required production environment variables
      const requiredVars = [
        'DATABASE_URL',
        'JWT_SECRET',
        'REFRESH_TOKEN_SECRET'
      ]

      for (const varName of requiredVars) {
        if (!process.env[varName]) {
          errors.push(`${varName} is required in production`)
        }
      }

      // Check JWT secret strength
      if (this.config.JWT_SECRET.length < 32) {
        errors.push('JWT_SECRET must be at least 32 characters in production')
      }

      // Check refresh token secret strength
      if (this.config.REFRESH_TOKEN_SECRET.length < 32) {
        errors.push('REFRESH_TOKEN_SECRET must be at least 32 characters in production')
      }

      // Check CORS configuration
      if (this.config.CORS_ORIGIN === 'http://localhost:3000') {
        errors.push('CORS_ORIGIN must be configured for production domain')
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  // Get environment summary
  getSummary() {
    return {
      environment: this.config.NODE_ENV,
      port: this.config.PORT,
      version: this.config.APP_VERSION,
      database: {
        connected: !!this.config.DATABASE_URL,
        ssl: this.isProduction
      },
      features: this.getFeatureFlags(),
      security: {
        jwtConfigured: !!this.config.JWT_SECRET,
        corsConfigured: this.config.CORS_ORIGIN !== 'http://localhost:3000',
        rateLimitEnabled: this.isProduction || this.isStaging
      }
    }
  }
}

// Global environment manager instance
export const env = new EnvironmentManager()

// Export environment configuration
export const config = env.getConfig()
export const isProduction = env.isProd()
export const isDevelopment = env.isDev()
export const isStaging = env.isStage()

export default env
