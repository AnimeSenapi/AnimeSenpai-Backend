import { z } from 'zod'
import { logger } from './logger'

// Comprehensive environment validation schema
const serverEnvSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.string().transform(Number).default('3005'),
  API_PORT: z.string().optional(),
  APP_VERSION: z.string().default('1.0.0'),
  
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // Authentication
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  REFRESH_TOKEN_SECRET: z.string().min(32, 'REFRESH_TOKEN_SECRET must be at least 32 characters').optional(),
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
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
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

export type ServerEnv = z.infer<typeof serverEnvSchema>

// Parse and validate environment
export const serverEnv = (() => {
  try {
    const parsed = serverEnvSchema.safeParse({
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT || process.env.API_PORT,
      API_PORT: process.env.API_PORT,
      APP_VERSION: process.env.APP_VERSION,
      DATABASE_URL: process.env.DATABASE_URL,
      JWT_SECRET: process.env.JWT_SECRET,
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
      REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
      REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN,
      EMAIL_SERVICE_URL: process.env.EMAIL_SERVICE_URL,
      EMAIL_FROM: process.env.EMAIL_FROM,
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
      ANALYTICS_SERVICE_URL: process.env.ANALYTICS_SERVICE_URL,
      SENTRY_DSN: process.env.SENTRY_DSN,
      CORS_ORIGIN: process.env.CORS_ORIGIN,
      RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
      RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX,
      BACKUP_DIR: process.env.BACKUP_DIR,
      BACKUP_RETENTION_DAYS: process.env.BACKUP_RETENTION_DAYS,
      BACKUP_COMPRESSION: process.env.BACKUP_COMPRESSION,
      BACKUP_ENCRYPTION: process.env.BACKUP_ENCRYPTION,
      BACKUP_ENCRYPTION_KEY: process.env.BACKUP_ENCRYPTION_KEY,
      HEALTH_CHECK_INTERVAL: process.env.HEALTH_CHECK_INTERVAL,
      METRICS_ENABLED: process.env.METRICS_ENABLED,
      LOG_LEVEL: process.env.LOG_LEVEL,
      LOG_FORMAT: process.env.LOG_FORMAT,
    })
    
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
      throw new Error(`Invalid server environment variables: ${issues}`)
    }
    
    logger.info('Environment configuration loaded', {
      nodeEnv: parsed.data.NODE_ENV,
      port: parsed.data.PORT,
      version: parsed.data.APP_VERSION
    })
    
    return parsed.data
  } catch (error) {
    logger.error(
      'Environment validation failed',
      error instanceof Error ? error : new Error('Unknown error')
    )
    throw error
  }
})()

// Helper functions
export const isProduction = serverEnv.NODE_ENV === 'production'
export const isDevelopment = serverEnv.NODE_ENV === 'development'
export const isStaging = serverEnv.NODE_ENV === 'staging'

// Get port (prefer API_PORT, fallback to PORT)
export const getPort = () => serverEnv.API_PORT ? parseInt(serverEnv.API_PORT) : serverEnv.PORT


