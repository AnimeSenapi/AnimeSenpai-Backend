/**
 * ⚡ Performance Test Suite
 * 
 * Tests all major endpoints and features for speed and reliability
 */

import { db } from '../lib/db'

interface TestResult {
  name: string
  duration: number
  status: 'fast' | 'ok' | 'slow' | 'failed'
  details?: string
}

const results: TestResult[] = []

function getStatus(duration: number): 'fast' | 'ok' | 'slow' {
  if (duration < 100) return 'fast'
  if (duration < 500) return 'ok'
  return 'slow'
}

async function testQuery(name: string, queryFn: () => Promise<any>): Promise<void> {
  const start = Date.now()
  try {
    const result = await queryFn()
    const duration = Date.now() - start
    const count = Array.isArray(result) ? result.length : (result?.count ?? 1)
    
    results.push({
      name,
      duration,
      status: getStatus(duration),
      details: `${count} items`
    })
  } catch (error: any) {
    const duration = Date.now() - start
    results.push({
      name,
      duration,
      status: 'failed',
      details: error.message
    })
  }
}

async function runPerformanceTests() {
  console.log('⚡ AnimeSenpai Performance Test Suite\n')
  console.log('Running comprehensive performance tests...\n')
  
  // Anime Queries
  console.log('📺 Testing Anime Queries...')
  await testQuery('Get Trending Anime', async () => {
    return db.anime.findMany({
      orderBy: [
        { viewCount: 'desc' },
        { averageRating: 'desc' }
      ],
      take: 10
    })
  })
  
  await testQuery('Get All Anime (paginated)', async () => {
    return db.anime.findMany({
      take: 20,
      orderBy: { title: 'asc' }
    })
  })
  
  await testQuery('Search Anime by Title', async () => {
    return db.anime.findMany({
      where: {
        OR: [
          { title: { contains: 'Naruto', mode: 'insensitive' } },
          { titleEnglish: { contains: 'Naruto', mode: 'insensitive' } }
        ]
      },
      take: 10
    })
  })
  
  await testQuery('Get Anime by Slug', async () => {
    return db.anime.findUnique({
      where: { slug: 'cowboy-bebop' },
      include: {
        genres: {
          include: { genre: true }
        }
      }
    })
  })
  
  await testQuery('Get Anime by Genre', async () => {
    return db.anime.findMany({
      where: {
        genres: {
          some: {
            genre: {
              slug: 'action'
            }
          }
        }
      },
      take: 20
    })
  })
  
  // User Queries
  console.log('\n👤 Testing User Queries...')
  await testQuery('Get All Users', async () => {
    return db.user.findMany({
      select: { id: true, username: true },
      take: 50
    })
  })
  
  await testQuery('Get User by Username', async () => {
    return db.user.findUnique({
      where: { username: 'testuser' },
      include: { preferences: true }
    })
  })
  
  // Social Queries
  console.log('\n💬 Testing Social Features...')
  await testQuery('Count Notifications', async () => {
    const user = await db.user.findFirst()
    if (!user) return { count: 0 }
    return db.notification.count({
      where: {
        userId: user.id,
        isRead: false
      }
    })
  })
  
  await testQuery('Get Activity Feed', async () => {
    return db.activityFeed.findMany({
      where: { isPublic: true },
      include: {
        user: {
          select: { username: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
  })
  
  await testQuery('Get Friendships', async () => {
    const user = await db.user.findFirst()
    if (!user) return []
    return db.friendship.findMany({
      where: {
        OR: [
          { user1Id: user.id },
          { user2Id: user.id }
        ],
        status: 'accepted'
      },
      take: 50
    })
  })
  
  // List Queries
  console.log('\n📝 Testing User Lists...')
  await testQuery('Get User Anime List', async () => {
    const user = await db.user.findFirst()
    if (!user) return []
    return db.userAnimeList.findMany({
      where: { userId: user.id },
      take: 50
    })
  })
  
  await testQuery('Get Watching List', async () => {
    const user = await db.user.findFirst()
    if (!user) return []
    return db.userAnimeList.findMany({
      where: {
        userId: user.id,
        status: 'watching'
      }
    })
  })
  
  // Achievement Queries
  console.log('\n🏆 Testing Achievements...')
  await testQuery('Get All Achievements', async () => {
    return db.achievement.findMany({
      orderBy: { createdAt: 'asc' }
    })
  })
  
  await testQuery('Get User Achievements', async () => {
    const user = await db.user.findFirst()
    if (!user) return []
    return db.userAchievement.findMany({
      where: { userId: user.id },
      include: { achievement: true }
    })
  })
  
  // Review Queries
  console.log('\n⭐ Testing Reviews...')
  await testQuery('Get Recent Reviews', async () => {
    return db.userAnimeReview.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
  })
  
  await testQuery('Get Anime Reviews', async () => {
    const anime = await db.anime.findFirst()
    if (!anime) return []
    return db.userAnimeReview.findMany({
      where: {
        animeId: anime.id,
        isPublic: true
      },
      include: {
        user: {
          select: { username: true, name: true }
        }
      },
      take: 10
    })
  })
  
  // Aggregate Queries
  console.log('\n📊 Testing Aggregates...')
  await testQuery('Count Total Anime', async () => {
    return db.anime.count()
  })
  
  await testQuery('Count Total Users', async () => {
    return db.user.count()
  })
  
  await testQuery('Count Genres', async () => {
    return db.genre.count()
  })
  
  await testQuery('Get Genre with Anime Count', async () => {
    return db.genre.findMany({
      include: {
        _count: {
          select: { anime: true }
        }
      }
    })
  })
  
  // Complex Queries
  console.log('\n🔍 Testing Complex Queries...')
  await testQuery('Get Top Rated Anime', async () => {
    return db.anime.findMany({
      where: {
        averageRating: { gte: 8.0 }
      },
      orderBy: { averageRating: 'desc' },
      take: 20
    })
  })
  
  await testQuery('Get Anime with Multiple Filters', async () => {
    return db.anime.findMany({
      where: {
        AND: [
          { year: { gte: 2020 } },
          { type: 'TV' },
          { averageRating: { gte: 7.0 } },
          { genres: {
              some: {
                genre: { slug: 'action' }
              }
            }
          }
        ]
      },
      take: 20
    })
  })
  
  // Generate Report
  console.log('\n\n' + '='.repeat(80))
  console.log('📊 PERFORMANCE TEST RESULTS')
  console.log('='.repeat(80) + '\n')
  
  const fast = results.filter(r => r.status === 'fast')
  const ok = results.filter(r => r.status === 'ok')
  const slow = results.filter(r => r.status === 'slow')
  const failed = results.filter(r => r.status === 'failed')
  
  console.log('Summary:')
  console.log(`  🟢 Fast (<100ms): ${fast.length}`)
  console.log(`  🟡 OK (100-500ms): ${ok.length}`)
  console.log(`  🟠 Slow (>500ms): ${slow.length}`)
  console.log(`  🔴 Failed: ${failed.length}`)
  console.log()
  
  // Detailed Results
  console.log('Detailed Results:\n')
  
  const grouped = {
    'Fast Queries (<100ms)': fast,
    'OK Queries (100-500ms)': ok,
    'Slow Queries (>500ms)': slow,
    'Failed Queries': failed
  }
  
  for (const [category, tests] of Object.entries(grouped)) {
    if (tests.length === 0) continue
    
    console.log(`${category}:`)
    for (const test of tests) {
      const icon = test.status === 'fast' ? '🟢' : test.status === 'ok' ? '🟡' : test.status === 'slow' ? '🟠' : '🔴'
      console.log(`  ${icon} ${test.name.padEnd(40)} ${test.duration}ms ${test.details ? `(${test.details})` : ''}`)
    }
    console.log()
  }
  
  // Overall Stats
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length
  const maxDuration = Math.max(...results.map(r => r.duration))
  const minDuration = Math.min(...results.map(r => r.duration))
  
  console.log('Overall Statistics:')
  console.log(`  Average query time: ${avgDuration.toFixed(2)}ms`)
  console.log(`  Fastest query: ${minDuration}ms`)
  console.log(`  Slowest query: ${maxDuration}ms`)
  console.log(`  Total tests run: ${results.length}`)
  console.log(`  Success rate: ${((results.length - failed.length) / results.length * 100).toFixed(1)}%`)
  
  console.log('\n' + '='.repeat(80))
  
  if (slow.length > 0 || failed.length > 0) {
    console.log('\n⚠️  Recommendations:')
    if (slow.length > 0) {
      console.log(`  - ${slow.length} queries are slow (>500ms). Consider adding indexes or caching.`)
    }
    if (failed.length > 0) {
      console.log(`  - ${failed.length} queries failed. Check error details above.`)
    }
  } else {
    console.log('\n✅ All tests passed with good performance!')
  }
  
  await db.$disconnect()
}

runPerformanceTests()
  .then(() => {
    process.exit(0)
  })
  .catch(error => {
    console.error('Test suite failed:', error)
    process.exit(1)
  })

