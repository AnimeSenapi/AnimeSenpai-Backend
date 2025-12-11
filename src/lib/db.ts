import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { withAccelerate } from '@prisma/extension-accelerate'
import pg from 'pg'

// Note: @prisma/extension-optimize@2.0.0 is not compatible with Prisma v7
// It only supports Prisma Client v5.x and v6.x
// Optimize functionality is disabled until a v7-compatible version is released

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
  const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db'
  const isAccelerateProxyUrl = databaseUrl.startsWith('prisma://') || databaseUrl.startsWith('prisma+postgres://')
  
  // For Prisma v7, use adapter for direct connections
  // If using Accelerate proxy URL, provide accelerateUrl instead
  // Build options object conditionally to satisfy TypeScript strict optional properties
  const logConfig = [
    {
      emit: 'event' as const,
      level: 'query' as const,
    },
    {
      emit: 'event' as const,
      level: 'error' as const,
    },
    {
      emit: 'event' as const,
      level: 'warn' as const,
    },
  ]
  
  let baseClient: PrismaClient
  
  if (isAccelerateProxyUrl) {
    // When using Accelerate proxy URL, provide accelerateUrl to PrismaClient
    baseClient = new PrismaClient({
      accelerateUrl: databaseUrl,
      log: logConfig,
    })
  } else if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
    // For direct PostgreSQL connections, use adapter
    const pool = new pg.Pool({ connectionString: databaseUrl })
    const adapter = new PrismaPg(pool)
    baseClient = new PrismaClient({
      adapter,
      log: logConfig,
    })
  } else {
    // Fallback for other database types (e.g., SQLite)
    // Note: For Prisma v7, adapter or accelerateUrl is typically required
    // SQLite and other file-based databases may work without, but this is not recommended
    baseClient = new PrismaClient({
      log: logConfig,
    } as any) // Type assertion needed for fallback case
  }

  // Store base client reference for event listeners
  baseClientForEvents = baseClient

  let client: any = baseClient

  // Note: Prisma Optimize extension is temporarily disabled
  // @prisma/extension-optimize@2.0.0 only supports Prisma Client v5.x and v6.x
  // It is not compatible with Prisma v7. Optimize will be re-enabled when a v7-compatible version is released
  const optimizeApiKey = process.env.OPTIMIZE_API_KEY?.trim()
  const enableOptimize = process.env.ENABLE_PRISMA_OPTIMIZE === 'true'
  
  if (optimizeApiKey && enableOptimize) {
    console.log('⚠️  Prisma Optimize: DISABLED - Not compatible with Prisma v7')
    console.log('   @prisma/extension-optimize@2.0.0 only supports Prisma Client v5.x and v6.x')
    console.log('   Optimize will be re-enabled when a Prisma v7-compatible version is released')
    console.log('   For now, only Accelerate caching is available')
  }

  // Apply Accelerate extension
  // When using accelerateUrl in constructor, Accelerate is already enabled - don't apply extension again
  // Only apply withAccelerate() extension if using direct connection with ENABLE_ACCELERATE=true
  const shouldUseAccelerateExtension = 
    !isAccelerateProxyUrl && 
    process.env.ENABLE_ACCELERATE === 'true'
  
  if (isAccelerateProxyUrl) {
    console.log('✅ Prisma Accelerate: ENABLED - Connection pooling & caching active')
    console.log('   Using Accelerate proxy (detected prisma:// or prisma+postgres:// in DATABASE_URL)')
    console.log('   💡 This is the recommended setup - set DATABASE_URL="prisma://..." or "prisma+postgres://..."')
    console.log('   ✨ Benefits: Global caching, connection pooling, edge locations')
    // accelerateUrl in constructor already enables Accelerate - no need for extension
  } else if (shouldUseAccelerateExtension) {
    console.log('✅ Prisma Accelerate: ENABLED - Connection pooling & caching active')
    console.log('   Using Accelerate extension with direct connection (ENABLE_ACCELERATE=true)')
    console.log('   ✨ Benefits: Connection pooling, local caching')
    console.log('   💡 For global caching, use DATABASE_URL="prisma://..." instead')
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
  const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db'
  const isAccelerateProxyUrl = databaseUrl.startsWith('prisma://') || databaseUrl.startsWith('prisma+postgres://')
  
  // For Prisma v7, use adapter for direct connections
  // If using Accelerate proxy URL, provide accelerateUrl instead
  const logConfig = [
    {
      emit: 'event' as const,
      level: 'query' as const,
    },
    {
      emit: 'event' as const,
      level: 'error' as const,
    },
    {
      emit: 'event' as const,
      level: 'warn' as const,
    },
  ]
  
  let baseClient: PrismaClient
  
  if (isAccelerateProxyUrl) {
    // When using Accelerate proxy URL, provide accelerateUrl to PrismaClient
    baseClient = new PrismaClient({
      accelerateUrl: databaseUrl,
      log: logConfig,
    })
  } else if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
    // For direct PostgreSQL connections, use adapter
    const pool = new pg.Pool({ connectionString: databaseUrl })
    const adapter = new PrismaPg(pool)
    baseClient = new PrismaClient({
      adapter,
      log: logConfig,
    })
  } else {
    // Fallback for other database types
    // Note: For Prisma v7, adapter or accelerateUrl is typically required
    baseClient = new PrismaClient({
      log: logConfig,
    } as any) // Type assertion needed for fallback case
  }

  let client: any = baseClient

  // Apply Accelerate extension (but not Optimize, to avoid tracing issues in background jobs)
  // Accelerate is automatically enabled if URL starts with 'prisma://' or 'prisma+postgres://'
  const shouldUseAccelerate = 
    isAccelerateProxyUrl || 
    process.env.ENABLE_ACCELERATE === 'true'
  
  if (shouldUseAccelerate) {
    client = client.$extends(withAccelerate())
  }

  return client
}

// Prisma Client with Accelerate and Optimize extensions (for API requests)
// Initialize immediately but handle connection errors gracefully
let _db: any = null
try {
  _db = globalForPrisma.prisma ?? createPrismaClient()
} catch (error: any) {
  console.error('⚠️  Prisma Client initialization error (will retry on first query):', error?.message || error)
  // Create client anyway - connection will be established on first query
  // In serverless, Prisma Client doesn't connect until first query
  _db = globalForPrisma.prisma ?? createPrismaClient()
}
export const db = _db

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

  const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db'
  const isAccelerateProxyUrl = databaseUrl.startsWith('prisma://') || databaseUrl.startsWith('prisma+postgres://')
  
  // For Prisma v7, use adapter for direct connections
  // If using Accelerate proxy URL, provide accelerateUrl instead
  const logConfig = [
    {
      emit: 'event' as const,
      level: 'query' as const,
    },
    {
      emit: 'event' as const,
      level: 'error' as const,
    },
    {
      emit: 'event' as const,
      level: 'warn' as const,
    },
  ]
  
  if (isAccelerateProxyUrl) {
    // When using Accelerate proxy URL, provide accelerateUrl to PrismaClient
    return new PrismaClient({
      accelerateUrl: databaseUrl,
      log: logConfig,
    })
  } else if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
    // For direct PostgreSQL connections, use adapter
    const pool = new pg.Pool({ connectionString: databaseUrl })
    const adapter = new PrismaPg(pool)
    return new PrismaClient({
      adapter,
      log: logConfig,
    })
  }

  // Fallback for other database types
  // Note: For Prisma v7, adapter or accelerateUrl is typically required
  return new PrismaClient({
    log: logConfig,
  } as any) // Type assertion needed for fallback case
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
// Returns empty object when Accelerate is disabled, so it can be safely spread
export function getCacheStrategy(ttl: number): { cacheStrategy?: { ttl: number } } {
  // Only use cacheStrategy if Accelerate is confirmed enabled
  // When using accelerateUrl, Accelerate is enabled but cacheStrategy might not work if connection failed
  // Return empty object to be safe - queries will still work without caching
  if (checkAccelerateEnabled()) {
    // Only return cacheStrategy if we're confident Accelerate is working
    // If connection failed, don't use cacheStrategy to avoid query errors
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

// Handle Prisma connection errors gracefully in serverless environments
// Only catch Accelerate connection errors during initialization, not query errors
let unhandledRejectionHandlerAdded = false
if (!unhandledRejectionHandlerAdded) {
  unhandledRejectionHandlerAdded = true
  const originalUnhandledRejection = process.listeners('unhandledRejection').filter(
    (handler: any) => handler.name !== 'prismaErrorHandler'
  )
  
  const prismaErrorHandler = (reason: any, promise: Promise<any>) => {
    const errorMessage = reason?.message || String(reason || '')
    const errorStack = reason?.stack || ''
    
    // Only catch Accelerate connection errors during initialization, not actual query failures
    if (errorMessage.includes('fetch failed') && 
        (errorStack.includes('getConnectionInfo') || errorStack.includes('Dt.start'))) {
      console.warn('⚠️  Prisma Accelerate connection error during initialization (will retry on first query):', errorMessage.substring(0, 200))
      // Don't crash - Prisma will retry on actual query
      return
    }
    
    // Call original handlers for other errors
    originalUnhandledRejection.forEach((handler: any) => {
      try {
        handler(reason, promise)
      } catch (e) {
        // Ignore handler errors
      }
    })
  }
  
  prismaErrorHandler.name = 'prismaErrorHandler'
  process.on('unhandledRejection', prismaErrorHandler)
}

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
