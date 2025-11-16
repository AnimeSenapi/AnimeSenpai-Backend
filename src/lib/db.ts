import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'
import { withOptimize } from '@prisma/extension-optimize'

const globalForPrisma = globalThis as unknown as {
  prisma: any | undefined
}

// Query logging threshold (ms) - log queries slower than this
const SLOW_QUERY_THRESHOLD = 100

// Store base client for event listeners (extended clients don't expose $on)
let baseClientForEvents: PrismaClient | null = null

// Export base client for event listeners in other modules
export const getBaseClientForEvents = (): PrismaClient | null => baseClientForEvents

// Create Prisma Client with Accelerate and Optimize extensions
function createPrismaClient() {
  const baseClient = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event',
        level: 'error',
      },
      {
        emit: 'event',
        level: 'warn',
      },
    ],
    
    // Connection pooling and performance settings
    datasources: {
      db: {
        // RECOMMENDED: Use DATABASE_URL="prisma://..." (Accelerate automatically enabled)
        url: process.env.DATABASE_URL || 'file:./dev.db',
      },
    },
    // Enable tracing for Prisma Optimize (required for Prisma 6.x)
    // This is automatically enabled when using Optimize extension
  })

  // Store base client reference for event listeners
  baseClientForEvents = baseClient

  let client: any = baseClient

  // IMPORTANT: Extension order matters!
  // Apply Optimize (requires tracing instrumentation) before Accelerate
  const optimizeApiKey = process.env.OPTIMIZE_API_KEY?.trim()
  const enableOptimize = process.env.ENABLE_PRISMA_OPTIMIZE === 'true'

  if (optimizeApiKey && enableOptimize) {
    console.log('✅ Prisma Optimize: ENABLED - Query analysis active')
    console.log('   Dashboard: https://optimize.prisma.io')
    console.log(`   API Key: ${optimizeApiKey.substring(0, 10)}...${optimizeApiKey.substring(optimizeApiKey.length - 4)}`)
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log('   ⚠️  IMPORTANT: Make sure tracing instrumentation is initialized before queries (see src/lib/tracing.ts)')
    
    try {
      const optimizeConfig: any = {
        apiKey: optimizeApiKey,
        enable: true,
      }
      
      client = client.$extends(withOptimize(optimizeConfig))
      console.log('   ✅ Optimize extension loaded successfully')
    } catch (error: any) {
      console.error('   ❌ Failed to load Optimize extension:', error?.message || error)
      console.error('   Stack:', error?.stack)
    }
  } else if (optimizeApiKey && !enableOptimize) {
    console.log('⚠️  Prisma Optimize: DISABLED - Set ENABLE_PRISMA_OPTIMIZE="true" to enable Optimize extension')
  }

  // Apply Accelerate extension
  // Accelerate is automatically enabled if DATABASE_URL starts with 'prisma://' or 'prisma+postgres://'
  // No need to set ENABLE_ACCELERATE="true" if using prisma:// URL
  const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db'
  const isAccelerateProxyUrl = databaseUrl.startsWith('prisma://') || databaseUrl.startsWith('prisma+postgres://')
  const shouldUseAccelerate = 
    isAccelerateProxyUrl || 
    process.env.ENABLE_ACCELERATE === 'true'
  
  if (shouldUseAccelerate) {
    console.log('✅ Prisma Accelerate: ENABLED - Connection pooling & caching active')
    if (isAccelerateProxyUrl) {
      console.log('   Using Accelerate proxy (detected prisma:// or prisma+postgres:// in DATABASE_URL)')
      console.log('   💡 This is the recommended setup - set DATABASE_URL="prisma://..." or "prisma+postgres://..."')
      console.log('   ✨ Benefits: Global caching, connection pooling, edge locations')
    } else {
      console.log('   Using Accelerate extension with direct connection (ENABLE_ACCELERATE=true)')
      console.log('   ✨ Benefits: Connection pooling, local caching')
      console.log('   💡 For global caching, use DATABASE_URL="prisma://..." instead')
    }
    client = client.$extends(withAccelerate())
  } else {
    console.log('⚠️  Prisma Accelerate: DISABLED')
    console.log('   To enable: Set DATABASE_URL="prisma://..." (recommended) or ENABLE_ACCELERATE=true')
    console.log('   Note: cacheStrategy requires Accelerate to be enabled')
  }

  return client
}

// Create Prisma Client WITHOUT Optimize (for background jobs where tracing isn't available)
function createPrismaClientWithoutOptimize() {
  const baseClient = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event',
        level: 'error',
      },
      {
        emit: 'event',
        level: 'warn',
      },
    ],
    datasources: {
      db: {
        url: process.env.DATABASE_URL || 'file:./dev.db',
      },
    },
  })

  let client: any = baseClient

  // Apply Accelerate extension (but not Optimize, to avoid tracing issues in background jobs)
  // Accelerate is automatically enabled if URL starts with 'prisma://' or 'prisma+postgres://'
  const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db'
  const isAccelerateProxyUrl = databaseUrl.startsWith('prisma://') || databaseUrl.startsWith('prisma+postgres://')
  const shouldUseAccelerate = 
    isAccelerateProxyUrl || 
    process.env.ENABLE_ACCELERATE === 'true'
  
  if (shouldUseAccelerate) {
    client = client.$extends(withAccelerate())
  }

  return client
}

// Prisma Client with Accelerate and Optimize extensions (for API requests)
export const db = globalForPrisma.prisma ?? createPrismaClient()

// Prisma Client without Optimize (for background jobs)
// Use this in background jobs to avoid tracing issues
let dbWithoutOptimize: any = null
export function getDbWithoutOptimize() {
  if (!dbWithoutOptimize) {
    dbWithoutOptimize = createPrismaClientWithoutOptimize()
  }
  return dbWithoutOptimize
}

export function getDirectDbClient(): PrismaClient {
  if (baseClientForEvents) {
    return baseClientForEvents
  }

  return new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event',
        level: 'error',
      },
      {
        emit: 'event',
        level: 'warn',
      },
    ],
    datasources: {
      db: {
        url: process.env.DATABASE_URL || 'file:./dev.db',
      },
    },
  })
}

// Check if Accelerate is enabled (to conditionally use cacheStrategy)
let isAccelerateEnabled: boolean | null = null
function checkAccelerateEnabled(): boolean {
  if (isAccelerateEnabled === null) {
    const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db'
    const isAccelerateProxyUrl = databaseUrl.startsWith('prisma://') || databaseUrl.startsWith('prisma+postgres://')
    isAccelerateEnabled = isAccelerateProxyUrl || process.env.ENABLE_ACCELERATE === 'true'
  }
  return isAccelerateEnabled
}

// Helper function to get cacheStrategy only when Accelerate is enabled
// Returns undefined when Accelerate is disabled, so it can be conditionally spread
export function getCacheStrategy(ttl: number): { cacheStrategy: { ttl: number } } | {} {
  if (checkAccelerateEnabled()) {
    return { cacheStrategy: { ttl } }
  }
  return {} // Return empty object when Accelerate is disabled
}

// Query performance monitoring
// Use base client for event listeners since extended clients don't expose $on
if (process.env.NODE_ENV === 'development' && baseClientForEvents) {
  // @ts-ignore - Prisma event emitter
  baseClientForEvents.$on('query', (e: any) => {
    if (e.duration > SLOW_QUERY_THRESHOLD) {
      console.warn(`🐌 Slow Query (${e.duration}ms):`, e.query.substring(0, 100))
    }
  })

  // @ts-ignore
  baseClientForEvents.$on('error', (e: any) => {
    console.error('❌ Prisma Error:', e)
  })

  // @ts-ignore
  baseClientForEvents.$on('warn', (e: any) => {
    console.warn('⚠️  Prisma Warning:', e)
  })
}

// Prevent multiple instances in development
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Query statistics tracker
export const queryStats = {
  totalQueries: 0,
  slowQueries: 0,
  totalDuration: 0,
  slowestQuery: { query: '', duration: 0 },
}

// Track query statistics
// Use base client for event listeners since extended clients don't expose $on
if (baseClientForEvents) {
  // @ts-ignore
  baseClientForEvents.$on('query', (e: any) => {
    queryStats.totalQueries++
    queryStats.totalDuration += e.duration
    
    if (e.duration > SLOW_QUERY_THRESHOLD) {
      queryStats.slowQueries++
    }
    
    if (e.duration > queryStats.slowestQuery.duration) {
      queryStats.slowestQuery = {
        query: e.query,
        duration: e.duration,
      }
    }
  })
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await db.$disconnect()
})

process.on('SIGINT', async () => {
  await db.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await db.$disconnect()
  process.exit(0)
})
