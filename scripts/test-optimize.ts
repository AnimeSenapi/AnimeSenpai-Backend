#!/usr/bin/env bun
/**
 * Test Prisma Optimize Connection
 * 
 * This script makes a few test queries to verify Optimize is working
 */

import { db } from '../src/lib/db'

console.log('\n🧪 Testing Prisma Optimize Connection...\n')

async function testOptimize() {
  try {
    console.log('1. Testing simple query (user count)...')
    const userCount = await db.user.count()
    console.log(`   ✅ Found ${userCount} users`)

    console.log('\n2. Testing genre query (with cacheStrategy)...')
    const genres = await db.genre.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
      },
      take: 5,
      cacheStrategy: { ttl: 60 }, // 1 minute cache
    })
    console.log(`   ✅ Found ${genres.length} genres`)

    console.log('\n3. Testing anime query...')
    const anime = await db.anime.findMany({
      select: {
        id: true,
        title: true,
      },
      take: 3,
      cacheStrategy: { ttl: 60 },
    })
    console.log(`   ✅ Found ${anime.length} anime`)

    console.log('\n✅ All queries executed successfully!')
    console.log('\n📊 Next steps:')
    console.log('   1. Go to https://optimize.prisma.io')
    console.log('   2. Click "Start Recording"')
    console.log('   3. Run this script again: bun run scripts/test-optimize.ts')
    console.log('   4. Click "Stop Recording"')
    console.log('   5. View your queries in the dashboard\n')

    await db.$disconnect()
  } catch (error) {
    console.error('❌ Error:', error)
    await db.$disconnect()
    process.exit(1)
  }
}

testOptimize()

