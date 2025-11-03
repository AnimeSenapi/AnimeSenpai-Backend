import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Query logging threshold (ms) - log queries slower than this
const SLOW_QUERY_THRESHOLD = 100

// Prisma Client with optimized configuration
export const db = globalForPrisma.prisma ?? new PrismaClient({
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
  // Bun handles connections differently than Node.js
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./dev.db',
    },
  },
})

// Query performance monitoring
if (process.env.NODE_ENV === 'development') {
  // @ts-ignore - Prisma event emitter
  db.$on('query', (e: any) => {
    if (e.duration > SLOW_QUERY_THRESHOLD) {
      console.warn(`🐌 Slow Query (${e.duration}ms):`, e.query.substring(0, 100))
    }
  })

  // @ts-ignore
  db.$on('error', (e: any) => {
    console.error('❌ Prisma Error:', e)
  })

  // @ts-ignore
  db.$on('warn', (e: any) => {
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
// @ts-ignore
db.$on('query', (e: any) => {
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
