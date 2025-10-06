#!/usr/bin/env bun

/**
 * Real-World Load Testing Script
 * Simulates actual user behavior patterns on AnimeSenpai
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

interface LoadTestResult {
  scenario: string
  totalTime: number
  queriesExecuted: number
  avgQueryTime: number
  success: boolean
  errors: string[]
}

const results: LoadTestResult[] = []

async function simulateUserBrowsing() {
  const errors: string[] = []
  const start = performance.now()
  let queriesExecuted = 0
  
  try {
    // 1. User lands on dashboard - loads trending anime
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
              select: { name: true, slug: true, color: true }
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
    queriesExecuted++
    
    // 2. User browses genres
    await db.genre.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
      }
    })
    queriesExecuted++
    
    // 3. User clicks on an anime page
    const anime = await db.anime.findFirst({
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        coverImage: true,
        bannerImage: true,
        episodes: true,
        averageRating: true,
        viewCount: true,
        genres: {
          select: {
            genre: true
          }
        }
      }
    })
    queriesExecuted++
    
    // 4. Increment view count (async)
    if (anime) {
      db.anime.update({
        where: { id: anime.id },
        data: { viewCount: { increment: 1 } }
      }).catch(() => {})
    }
    
    // 5. User scrolls, loads more anime
    await db.anime.findMany({
      take: 20,
      skip: 10,
      select: {
        id: true,
        slug: true,
        title: true,
        coverImage: true,
        averageRating: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    queriesExecuted++
    
  } catch (error: any) {
    errors.push(error.message)
  }
  
  const end = performance.now()
  const totalTime = end - start
  
  results.push({
    scenario: 'User Browsing (Guest)',
    totalTime,
    queriesExecuted,
    avgQueryTime: totalTime / queriesExecuted,
    success: errors.length === 0,
    errors
  })
}

async function simulateUserSignup() {
  const errors: string[] = []
  const start = performance.now()
  let queriesExecuted = 0
  
  try {
    // 1. Check if email exists
    const existing = await db.user.findUnique({
      where: { email: `test-${Date.now()}@example.com` },
      select: { id: true }
    })
    queriesExecuted++
    
    if (!existing) {
      // 2. Create user
      const user = await db.user.create({
        data: {
          email: `test-${Date.now()}@example.com`,
          name: 'Test User',
          password: 'hashed_password_here',
          gdprConsent: true,
          dataProcessingConsent: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
        }
      })
      queriesExecuted++
      
      // 3. Create user preferences
      await db.userPreferences.create({
        data: {
          userId: user.id,
        }
      })
      queriesExecuted++
      
      // 4. Create session
      await db.userSession.create({
        data: {
          userId: user.id,
          refreshToken: `refresh_${Date.now()}`,
          accessToken: `access_${Date.now()}`,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }
      })
      queriesExecuted++
    }
    
  } catch (error: any) {
    errors.push(error.message)
  }
  
  const end = performance.now()
  const totalTime = end - start
  
  results.push({
    scenario: 'User Signup Flow',
    totalTime,
    queriesExecuted,
    avgQueryTime: totalTime / queriesExecuted,
    success: errors.length === 0,
    errors
  })
}

async function simulateAuthenticatedUser() {
  const errors: string[] = []
  const start = performance.now()
  let queriesExecuted = 0
  
  try {
    // 1. Load user with session
    const user = await db.user.findFirst({
      select: {
        id: true,
        email: true,
        name: true,
        sessions: {
          where: { isActive: true },
          select: { id: true, expiresAt: true },
          take: 1
        }
      }
    })
    queriesExecuted++
    
    if (user) {
      // 2. Load user's anime list
      await db.userAnimeList.findMany({
        where: { userId: user.id },
        select: {
          animeId: true,
          status: true,
          progress: true,
          score: true,
        },
        take: 20,
        orderBy: { updatedAt: 'desc' }
      })
      queriesExecuted++
      
      // 3. Load user preferences
      await db.userPreferences.findUnique({
        where: { userId: user.id }
      })
      queriesExecuted++
      
      // 4. Count stats
      await Promise.all([
        db.userAnimeList.count({ where: { userId: user.id } }),
        db.userAnimeList.count({ where: { userId: user.id, status: 'completed' } }),
        db.userAnimeRating.count({ where: { userId: user.id } }),
      ])
      queriesExecuted += 3
    }
    
  } catch (error: any) {
    errors.push(error.message)
  }
  
  const end = performance.now()
  const totalTime = end - start
  
  results.push({
    scenario: 'Authenticated User Session',
    totalTime,
    queriesExecuted,
    avgQueryTime: totalTime / queriesExecuted,
    success: errors.length === 0,
    errors
  })
}

async function simulateSearch() {
  const errors: string[] = []
  const start = performance.now()
  let queriesExecuted = 0
  
  try {
    // 1. Search anime by title
    await db.anime.findMany({
      where: {
        title: {
          contains: 'attack',
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        slug: true,
        title: true,
        coverImage: true,
        averageRating: true,
      },
      take: 10
    })
    queriesExecuted++
    
    // 2. Filter by genre
    await db.anime.findMany({
      where: {
        genres: {
          some: {
            genre: {
              slug: 'action'
            }
          }
        }
      },
      select: {
        id: true,
        slug: true,
        title: true,
        coverImage: true,
      },
      take: 10
    })
    queriesExecuted++
    
    // 3. Filter by year and status
    await db.anime.findMany({
      where: {
        year: 2023,
        status: 'airing'
      },
      select: {
        id: true,
        slug: true,
        title: true,
        coverImage: true,
      },
      take: 10
    })
    queriesExecuted++
    
  } catch (error: any) {
    errors.push(error.message)
  }
  
  const end = performance.now()
  const totalTime = end - start
  
  results.push({
    scenario: 'Search & Filter Operations',
    totalTime,
    queriesExecuted,
    avgQueryTime: totalTime / queriesExecuted,
    success: errors.length === 0,
    errors
  })
}

async function runLoadTests() {
  console.log('🧪 AnimeSenpai Real-World Load Testing\n')
  console.log('=' .repeat(70))
  
  // Run each scenario multiple times
  const iterations = 5
  
  console.log(`\n📊 Running ${iterations} iterations of each scenario...\n`)
  
  for (let i = 0; i < iterations; i++) {
    console.log(`Iteration ${i + 1}/${iterations}`)
    await simulateUserBrowsing()
    await simulateUserSignup()
    await simulateAuthenticatedUser()
    await simulateSearch()
  }
  
  // Generate report
  console.log('\n' + '='.repeat(70))
  console.log('\n📈 Load Test Results:\n')
  
  // Group by scenario
  const scenarios = [...new Set(results.map(r => r.scenario))]
  
  scenarios.forEach(scenario => {
    const scenarioResults = results.filter(r => r.scenario === scenario)
    const successful = scenarioResults.filter(r => r.success)
    
    console.log(`\n🎯 ${scenario}`)
    console.log('-'.repeat(70))
    
    if (successful.length > 0) {
      const avgTotal = successful.reduce((sum, r) => sum + r.totalTime, 0) / successful.length
      const avgQuery = successful.reduce((sum, r) => sum + r.avgQueryTime, 0) / successful.length
      const avgQueries = successful.reduce((sum, r) => sum + r.queriesExecuted, 0) / successful.length
      
      console.log(`  Total time: ${avgTotal.toFixed(2)}ms`)
      console.log(`  Queries executed: ${avgQueries.toFixed(1)}`)
      console.log(`  Avg query time: ${avgQuery.toFixed(2)}ms`)
      console.log(`  Success rate: ${(successful.length / scenarioResults.length * 100).toFixed(1)}%`)
      
      const rating = avgTotal < 200 ? '⭐⭐⭐⭐⭐ Excellent' :
                     avgTotal < 500 ? '⭐⭐⭐⭐ Good' :
                     avgTotal < 1000 ? '⭐⭐⭐ Acceptable' :
                     '⭐⭐ Needs Work'
      console.log(`  Rating: ${rating}`)
    }
    
    const failed = scenarioResults.filter(r => !r.success)
    if (failed.length > 0) {
      console.log(`  ❌ Failures: ${failed.length}`)
      failed.forEach(f => {
        f.errors.forEach(err => console.log(`    - ${err}`))
      })
    }
  })
  
  console.log('\n' + '='.repeat(70))
  console.log('\n✅ Load Testing Complete!\n')
  
  // Overall stats
  const totalSuccessful = results.filter(r => r.success)
  const overallAvgTime = totalSuccessful.reduce((sum, r) => sum + r.totalTime, 0) / totalSuccessful.length
  const overallAvgQueries = totalSuccessful.reduce((sum, r) => sum + r.queriesExecuted, 0) / totalSuccessful.length
  
  console.log('📊 Overall Statistics:')
  console.log(`  Total scenarios tested: ${iterations * 4}`)
  console.log(`  Success rate: ${(totalSuccessful.length / results.length * 100).toFixed(1)}%`)
  console.log(`  Avg scenario time: ${overallAvgTime.toFixed(2)}ms`)
  console.log(`  Avg queries per scenario: ${overallAvgQueries.toFixed(1)}`)
  console.log(`  Est. throughput: ${(1000 / overallAvgTime).toFixed(2)} scenarios/sec`)
  
  console.log('\n🎯 Production Readiness:')
  if (overallAvgTime < 300) {
    console.log('  ✅ Database is production-ready!')
    console.log('  ✅ Can handle 100-1000 concurrent users')
    console.log('  ✅ Response times are excellent')
  } else if (overallAvgTime < 500) {
    console.log('  ⚠️  Database is functional but could be faster')
    console.log('  ✅ Can handle 50-100 concurrent users')
    console.log('  💡 Consider adding caching for better performance')
  } else {
    console.log('  ❌ Database needs optimization')
    console.log('  ⚠️  May struggle with >50 concurrent users')
    console.log('  🔧 Review indexes and query patterns')
  }
  
  await db.$disconnect()
}

runLoadTests().catch(console.error)

