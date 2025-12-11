#!/usr/bin/env bun
/**
 * Check Prisma Extensions Status
 * 
 * Verifies if Prisma Optimize and Accelerate are properly configured
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

console.log('\n🔍 Checking Prisma Extensions Status...\n')

// Check environment variables
const hasOptimizeKey = !!process.env.OPTIMIZE_API_KEY
const hasAccelerateUrl = !!process.env.PRISMA_ACCELERATE_URL
const enableAccelerate = process.env.ENABLE_ACCELERATE === 'true'
const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db'
const hasAccelerateProxy = databaseUrl.startsWith('prisma://')

console.log('📋 Configuration Status:')
console.log(`   OPTIMIZE_API_KEY: ${hasOptimizeKey ? '✅ Set' : '❌ Not set'}`)
console.log(`   ENABLE_ACCELERATE: ${enableAccelerate ? '✅ Enabled' : '❌ Not enabled'}`)
console.log(`   PRISMA_ACCELERATE_URL: ${hasAccelerateUrl ? '✅ Set' : '❌ Not set'}`)
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Not set'}`)
console.log('')

// Determine which connection URL is being used
const actualConnectionUrl = process.env.PRISMA_ACCELERATE_URL || process.env.DATABASE_URL || 'file:./dev.db'
const isUsingAccelerateProxy = actualConnectionUrl.startsWith('prisma://')
const isAccelerateEnabled = hasAccelerateUrl || enableAccelerate || isUsingAccelerateProxy

console.log('🚀 Accelerate Configuration:')
if (isAccelerateEnabled) {
  if (hasAccelerateUrl && isUsingAccelerateProxy) {
    console.log('   ✅ ENABLED - Using Accelerate proxy connection')
    console.log('   📍 Connection: PRISMA_ACCELERATE_URL (prisma://...)')
    console.log('   ✨ Features: Global caching, connection pooling, edge locations')
    if (process.env.DATABASE_URL) {
      console.log('   ℹ️  DATABASE_URL is also set (used as fallback/backup)')
    }
  } else if (enableAccelerate && !hasAccelerateUrl) {
    console.log('   ✅ ENABLED - Using direct connection with Accelerate extension')
    console.log('   📍 Connection: DATABASE_URL (direct)')
    console.log('   ✨ Features: Connection pooling, local caching')
    console.log('   ⚠️  Note: For global caching, set PRISMA_ACCELERATE_URL')
  } else if (hasAccelerateUrl && !isUsingAccelerateProxy) {
    console.log('   ⚠️  WARNING: PRISMA_ACCELERATE_URL is set but does not start with "prisma://"')
    console.log('   This might not be a valid Accelerate proxy URL')
  }
} else {
  console.log('   ❌ DISABLED - Set ENABLE_ACCELERATE=true or PRISMA_ACCELERATE_URL to enable')
}
console.log('')

// Test connection
try {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required')
  }
  const pool = new pg.Pool({ connectionString: databaseUrl })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })
  await prisma.$connect()
  
  // Test a simple query
  const count = await prisma.user.count()
  console.log(`✅ Database connection: OK (${count} users found)`)
  
  await prisma.$disconnect()
} catch (error) {
  console.error('❌ Database connection failed:', error)
  process.exit(1)
}

console.log('\n💡 Accelerate Configuration Guide:')
console.log('')
if (isUsingAccelerateProxy) {
  if (hasAccelerateUrl) {
    console.log('   ✅ You\'re using Accelerate proxy via PRISMA_ACCELERATE_URL')
    console.log('   - PRISMA_ACCELERATE_URL is prioritized over DATABASE_URL')
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('prisma://')) {
      console.log('   - DATABASE_URL is also set (useful for troubleshooting)')
      console.log('   ⚠️  Note: Migrations are disabled - schema is managed externally')
    }
  } else {
    console.log('   ✅ You\'re using Accelerate proxy via DATABASE_URL')
    console.log('   - This is the simplest setup! Just set DATABASE_URL="prisma://..."')
  }
  console.log('   - Provides: Global caching, connection pooling, edge locations')
  console.log('   - Best for production with global deployments')
} else if (enableAccelerate && !hasAccelerateUrl) {
  console.log('   📝 You\'re using direct connection with Accelerate extension')
  console.log('   - Good for development')
  console.log('   - For production: Use DATABASE_URL="prisma://..." (simplest!)')
  console.log('   - Get Accelerate URL from: https://console.prisma.io/')
} else {
  console.log('   Option 1: Simple Accelerate Setup (Recommended)')
  console.log('   - Get Accelerate URL from: https://console.prisma.io/')
  console.log('   - Set DATABASE_URL="prisma://..." in .env')
  console.log('   - That\'s it! No need for PRISMA_ACCELERATE_URL or ENABLE_ACCELERATE')
  console.log('   - Provides: Global caching, connection pooling, edge locations')
  console.log('')
  console.log('   Option 2: Keep Direct Connection Available')
  console.log('   - Set PRISMA_ACCELERATE_URL="prisma://..." (for queries)')
  console.log('   - Set DATABASE_URL="postgresql://..." (for troubleshooting)')
  console.log('   - Useful if you need direct DB access for troubleshooting')
  console.log('   ⚠️  Note: Migrations are disabled - schema is managed externally')
  console.log('')
  console.log('   Option 3: Direct Connection Only')
  console.log('   - Set ENABLE_ACCELERATE=true in .env')
  console.log('   - Uses DATABASE_URL directly')
  console.log('   - Provides: Connection pooling, local caching (no global caching)')
}

console.log('\n')

