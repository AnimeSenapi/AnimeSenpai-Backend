#!/usr/bin/env bun

/**
 * Environment Variable Validation Script
 * 
 * Validates that all required environment variables are set correctly
 * for the current environment (development, staging, production).
 */

interface EnvVar {
  name: string
  required: boolean
  description: string
  validator?: (value: string) => boolean | string
  defaultValue?: string
}

const REQUIRED_ENV_VARS: EnvVar[] = [
  {
    name: 'DATABASE_URL',
    required: true,
    description: 'Database connection string (Prisma Accelerate URL recommended)',
    validator: (value) => {
      if (!value) return 'DATABASE_URL is required'
      if (value.startsWith('prisma://')) return true
      if (value.startsWith('postgresql://') || value.startsWith('postgres://')) return true
      return 'DATABASE_URL must be a valid Prisma Accelerate URL or PostgreSQL connection string'
    }
  },
  {
    name: 'JWT_SECRET',
    required: true,
    description: 'Secret key for JWT access tokens',
    validator: (value) => {
      if (!value) return 'JWT_SECRET is required'
      if (value.length < 32) return 'JWT_SECRET must be at least 32 characters long'
      if (value === 'fallback-secret-key' || value.includes('change-this')) {
        return 'JWT_SECRET must be changed from default value'
      }
      return true
    }
  },
  {
    name: 'JWT_REFRESH_SECRET',
    required: true,
    description: 'Secret key for JWT refresh tokens',
    validator: (value) => {
      if (!value) return 'JWT_REFRESH_SECRET is required'
      if (value.length < 32) return 'JWT_REFRESH_SECRET must be at least 32 characters long'
      if (value === 'fallback-refresh-secret-key' || value.includes('change-this')) {
        return 'JWT_REFRESH_SECRET must be changed from default value'
      }
      return true
    }
  },
  {
    name: 'FRONTEND_URL',
    required: true,
    description: 'Frontend application URL for CORS',
    validator: (value) => {
      if (!value) return 'FRONTEND_URL is required'
      if (!value.startsWith('http://') && !value.startsWith('https://')) {
        return 'FRONTEND_URL must be a valid URL'
      }
      return true
    }
  },
  {
    name: 'NODE_ENV',
    required: true,
    description: 'Environment mode (development, staging, production)',
    validator: (value) => {
      const validEnvs = ['development', 'staging', 'production', 'test']
      if (!validEnvs.includes(value)) {
        return `NODE_ENV must be one of: ${validEnvs.join(', ')}`
      }
      return true
    }
  }
]

const OPTIONAL_ENV_VARS: EnvVar[] = [
  {
    name: 'RESEND_API_KEY',
    required: false,
    description: 'Resend API key for email sending',
    validator: (value) => {
      if (!value) return true // Optional
      if (!value.startsWith('re_')) return 'RESEND_API_KEY should start with "re_"'
      return true
    }
  },
  {
    name: 'EMAIL_FROM',
    required: false,
    description: 'Default sender email address',
    validator: (value) => {
      if (!value) return true // Optional
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(value)) return 'EMAIL_FROM must be a valid email address'
      return true
    }
  },
  {
    name: 'REDIS_URL',
    required: false,
    description: 'Redis connection URL for caching',
    validator: (value) => {
      if (!value) return true // Optional
      if (!value.startsWith('redis://') && !value.startsWith('rediss://')) {
        return 'REDIS_URL must be a valid Redis connection string'
      }
      return true
    }
  },
  {
    name: 'SENTRY_DSN',
    required: false,
    description: 'Sentry DSN for error tracking',
    validator: (value) => {
      if (!value) return true // Optional
      if (!value.startsWith('https://')) return 'SENTRY_DSN must be a valid HTTPS URL'
      return true
    }
  },
  {
    name: 'CORS_ORIGINS',
    required: false,
    description: 'Comma-separated list of allowed CORS origins',
  },
  {
    name: 'BCRYPT_ROUNDS',
    required: false,
    description: 'Number of bcrypt rounds for password hashing',
    defaultValue: '12',
    validator: (value) => {
      if (!value) return true // Optional, uses default
      const rounds = parseInt(value, 10)
      if (isNaN(rounds) || rounds < 10 || rounds > 15) {
        return 'BCRYPT_ROUNDS must be a number between 10 and 15'
      }
      return true
    }
  },
  {
    name: 'RATE_LIMIT_WINDOW_MS',
    required: false,
    description: 'Rate limit window in milliseconds',
    defaultValue: '900000',
  },
  {
    name: 'RATE_LIMIT_MAX_REQUESTS',
    required: false,
    description: 'Maximum requests per rate limit window',
    defaultValue: '100',
  }
]

function validateEnvVar(envVar: EnvVar): { valid: boolean; error?: string; value?: string } {
  const value = process.env[envVar.name] || envVar.defaultValue

  if (envVar.required && !value) {
    return {
      valid: false,
      error: `${envVar.name} is required but not set`
    }
  }

  if (!value) {
    return { valid: true } // Optional and not set
  }

  if (envVar.validator) {
    const validationResult = envVar.validator(value)
    if (validationResult !== true) {
      return {
        valid: false,
        error: typeof validationResult === 'string' ? validationResult : `${envVar.name} validation failed`,
        value: value.substring(0, 20) + '...' // Show partial value for debugging
      }
    }
  }

  return {
    valid: true,
    value: envVar.name.includes('SECRET') || envVar.name.includes('PASSWORD') || envVar.name.includes('KEY')
      ? '***hidden***'
      : value
  }
}

function main() {
  const nodeEnv = process.env.NODE_ENV || 'development'
  console.log(`\n🔍 Validating environment variables for: ${nodeEnv}\n`)

  let hasErrors = false
  const errors: string[] = []
  const warnings: string[] = []

  // Validate required variables
  console.log('📋 Required Environment Variables:')
  console.log('─'.repeat(60))
  
  for (const envVar of REQUIRED_ENV_VARS) {
    const result = validateEnvVar(envVar)
    if (result.valid) {
      console.log(`✅ ${envVar.name.padEnd(30)} ${result.value || '(not set)'}`)
    } else {
      console.log(`❌ ${envVar.name.padEnd(30)} ${result.error}`)
      errors.push(`${envVar.name}: ${result.error}`)
      hasErrors = true
    }
  }

  // Validate optional variables
  console.log('\n📋 Optional Environment Variables:')
  console.log('─'.repeat(60))
  
  for (const envVar of OPTIONAL_ENV_VARS) {
    const result = validateEnvVar(envVar)
    if (result.valid) {
      if (result.value) {
        console.log(`✅ ${envVar.name.padEnd(30)} ${result.value}`)
      } else {
        console.log(`⚪ ${envVar.name.padEnd(30)} (not set, using default)`)
      }
    } else {
      console.log(`⚠️  ${envVar.name.padEnd(30)} ${result.error}`)
      warnings.push(`${envVar.name}: ${result.error}`)
    }
  }

  // Production-specific checks
  if (nodeEnv === 'production') {
    console.log('\n🔒 Production-Specific Checks:')
    console.log('─'.repeat(60))
    
    if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
      console.log('⚠️  JWT_SECRET and JWT_REFRESH_SECRET should be different')
      warnings.push('JWT_SECRET and JWT_REFRESH_SECRET are the same')
    } else {
      console.log('✅ JWT secrets are different')
    }

    if (!process.env.SENTRY_DSN) {
      console.log('⚠️  SENTRY_DSN is not set - error tracking will be limited')
      warnings.push('SENTRY_DSN not set in production')
    }

    if (process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1')) {
      console.log('⚠️  DATABASE_URL appears to point to localhost - ensure this is correct for production')
      warnings.push('DATABASE_URL may be pointing to localhost')
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  if (hasErrors) {
    console.log('❌ Validation FAILED')
    console.log('\nErrors:')
    errors.forEach(error => console.log(`  - ${error}`))
    process.exit(1)
  } else {
    console.log('✅ Validation PASSED')
    if (warnings.length > 0) {
      console.log('\nWarnings:')
      warnings.forEach(warning => console.log(`  ⚠️  ${warning}`))
    }
    process.exit(0)
  }
}

if (import.meta.main) {
  main()
}

export { validateEnvVar, REQUIRED_ENV_VARS, OPTIONAL_ENV_VARS }

