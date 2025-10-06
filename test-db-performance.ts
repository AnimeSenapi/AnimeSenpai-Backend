#!/usr/bin/env bun

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  log: ['query'],
})

interface BenchmarkResult {
  name: string
  duration: number
  queriesPerSecond: number
  success: boolean
  error?: string
}

const results: BenchmarkResult[] = []

async function benchmark(name: string, fn: () => Promise<void>, iterations: number = 10) {
  console.log(`\n🔍 Running: ${name}`)
  const start = performance.now()
  
  try {
    for (let i = 0; i < iterations; i++) {
      await fn()
    }
    
    const end = performance.now()
    const duration = end - start
    const avgDuration = duration / iterations
    const qps = 1000 / avgDuration
    
    results.push({
      name,
      duration: avgDuration,
      queriesPerSecond: qps,
      success: true
    })
    
    console.log(`✅ Average: ${avgDuration.toFixed(2)}ms | ${qps.toFixed(2)} queries/sec`)
  } catch (error: any) {
    results.push({
      name,
      duration: 0,
      queriesPerSecond: 0,
      success: false,
      error: error.message
    })
    console.log(`❌ Error: ${error.message}`)
  }
}

async function runBenchmarks() {
  console.log('🚀 AnimeSenpai Database Performance Benchmarks\n')
  console.log('=' .repeat(60))
  
  // Test 1: User lookup by email (most common auth query)
  await benchmark('User lookup by email', async () => {
    await db.user.findUnique({
      where: { email: 'test@example.com' },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
      }
    })
  })
  
  // Test 2: User lookup with session validation
  await benchmark('User with active sessions', async () => {
    await db.user.findFirst({
      where: { email: 'test@example.com' },
      select: {
        id: true,
        email: true,
        name: true,
        sessions: {
          where: {
            isActive: true,
            expiresAt: {
              gt: new Date()
            }
          },
          select: {
            id: true,
            expiresAt: true,
          },
          take: 1
        }
      }
    })
  })
  
  // Test 3: Anime list query (common operation)
  await benchmark('Get all anime (paginated)', async () => {
    await db.anime.findMany({
      take: 20,
      select: {
        id: true,
        slug: true,
        title: true,
        coverImage: true,
        averageRating: true,
        viewCount: true,
        episodes: true,
        genres: {
          select: {
            genre: {
              select: {
                name: true,
                slug: true,
              }
            }
          }
        }
      },
      orderBy: {
        averageRating: 'desc'
      }
    })
  })
  
  // Test 4: Anime by slug (page load)
  await benchmark('Get anime by slug', async () => {
    await db.anime.findUnique({
      where: { slug: 'attack-on-titan' },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        coverImage: true,
        bannerImage: true,
        averageRating: true,
        viewCount: true,
        ratingCount: true,
        genres: {
          select: {
            genre: {
              select: {
                name: true,
                slug: true,
                color: true,
              }
            }
          }
        }
      }
    })
  })
  
  // Test 5: User anime list (my list page)
  await benchmark('Get user anime list', async () => {
    await db.userAnimeList.findMany({
      where: {
        userId: 'test-user-id'
      },
      select: {
        id: true,
        animeId: true,
        status: true,
        progress: true,
        score: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 20
    })
  })
  
  // Test 6: Trending anime (complex query)
  await benchmark('Get trending anime', async () => {
    await db.anime.findMany({
      take: 10,
      select: {
        id: true,
        slug: true,
        title: true,
        coverImage: true,
        averageRating: true,
        viewCount: true,
        genres: {
          select: {
            genre: {
              select: {
                name: true,
              }
            }
          },
          take: 3
        }
      },
      orderBy: [
        { viewCount: 'desc' },
        { averageRating: 'desc' }
      ]
    })
  })
  
  // Test 7: Genre list
  await benchmark('Get all genres', async () => {
    await db.genre.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
      },
      orderBy: {
        name: 'asc'
      }
    })
  })
  
  // Test 8: Anime count
  await benchmark('Count all anime', async () => {
    await db.anime.count()
  })
  
  // Test 9: Session lookup by refresh token
  await benchmark('Session lookup by refreshToken', async () => {
    await db.userSession.findUnique({
      where: { refreshToken: 'fake-refresh-token' },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        isActive: true,
      }
    })
  })
  
  // Test 10: Complex user stats query
  await benchmark('Get user stats', async () => {
    await Promise.all([
      db.userAnimeList.count({
        where: { userId: 'test-user-id' }
      }),
      db.userAnimeList.count({
        where: { userId: 'test-user-id', status: 'completed' }
      }),
      db.userAnimeList.count({
        where: { userId: 'test-user-id', status: 'watching' }
      }),
      db.userAnimeRating.count({
        where: { userId: 'test-user-id' }
      })
    ])
  })
  
  console.log('\n' + '='.repeat(60))
  console.log('\n📊 Performance Summary:\n')
  
  const successful = results.filter(r => r.success)
  const failed = results.filter(r => !r.success)
  
  console.log(`✅ Successful tests: ${successful.length}/${results.length}`)
  console.log(`❌ Failed tests: ${failed.length}/${results.length}\n`)
  
  if (successful.length > 0) {
    const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length
    const avgQps = successful.reduce((sum, r) => sum + r.queriesPerSecond, 0) / successful.length
    
    console.log(`📈 Average query time: ${avgDuration.toFixed(2)}ms`)
    console.log(`📈 Average queries/sec: ${avgQps.toFixed(2)}`)
    
    const fastest = successful.reduce((min, r) => r.duration < min.duration ? r : min)
    const slowest = successful.reduce((max, r) => r.duration > max.duration ? r : max)
    
    console.log(`\n⚡ Fastest: ${fastest.name} (${fastest.duration.toFixed(2)}ms)`)
    console.log(`🐌 Slowest: ${slowest.name} (${slowest.duration.toFixed(2)}ms)`)
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed Tests:')
    failed.forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`)
    })
  }
  
  console.log('\n' + '='.repeat(60))
  
  // Performance targets
  console.log('\n🎯 Performance Targets:')
  const targets = {
    'Excellent': 50,
    'Good': 100,
    'Acceptable': 200,
    'Needs Optimization': 500
  }
  
  const avgTime = successful.length > 0 
    ? successful.reduce((sum, r) => sum + r.duration, 0) / successful.length 
    : 0
  
  const rating = avgTime < 50 ? 'Excellent ⭐⭐⭐⭐⭐' :
                 avgTime < 100 ? 'Good ⭐⭐⭐⭐' :
                 avgTime < 200 ? 'Acceptable ⭐⭐⭐' :
                 avgTime < 500 ? 'Needs Optimization ⭐⭐' :
                 'Poor ⭐'
  
  console.log(`Current rating: ${rating}`)
  console.log(`\nTarget breakdown:`)
  Object.entries(targets).forEach(([label, ms]) => {
    const status = avgTime < ms ? '✅' : '❌'
    console.log(`  ${status} ${label}: < ${ms}ms`)
  })
  
  await db.$disconnect()
}

runBenchmarks().catch(console.error)

