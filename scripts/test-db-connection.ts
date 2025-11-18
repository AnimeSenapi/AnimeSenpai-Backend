#!/usr/bin/env bun
/**
 * Test database connection
 * 
 * Usage: bun run scripts/test-db-connection.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['error', 'warn', 'info'],
})

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...')
    console.log('📋 DATABASE_URL:', process.env.DATABASE_URL ? 'SET (hidden)' : '❌ NOT SET')
    
    const dbUrl = process.env.DATABASE_URL || ''
    if (dbUrl.startsWith('prisma://') || dbUrl.startsWith('prisma+postgres://')) {
      console.log('⚠️  Using Prisma Accelerate proxy')
      console.log('   If you see connection errors, Accelerate may be experiencing issues.')
      console.log('   Check status: https://www.prisma-status.com')
      console.log('   Consider switching to direct PostgreSQL connection temporarily.')
    } else if (dbUrl.startsWith('postgresql://')) {
      console.log('✅ Using direct PostgreSQL connection')
    } else {
      console.log('⚠️  Unknown connection string format')
    }
    
    console.log('\n🔌 Attempting to connect...')
    
    // Try a simple query
    const result = await prisma.$queryRaw`SELECT 1 as test`
    console.log('✅ Connection successful!', result)
    
    // Try to query a table
    console.log('\n📊 Testing table access...')
    const userCount = await prisma.user.count()
    console.log(`✅ User count: ${userCount}`)
    
    console.log('\n🎉 Database connection is working correctly!')
    
  } catch (error: any) {
    console.error('\n❌ Connection failed!')
    console.error('Error message:', error.message)
    console.error('Error code:', error.code)
    
    if (error.message?.includes('Accelerate')) {
      console.error('\n💡 Solution:')
      console.error('   Prisma Accelerate is experiencing issues.')
      console.error('   Switch to direct PostgreSQL connection temporarily.')
      console.error('   See: scripts/fix-accelerate-outage.md')
    }
    
    if (error.code === 'P1001') {
      console.error('\n💡 Solution:')
      console.error('   Cannot reach database server.')
      console.error('   Check your DATABASE_URL and network connectivity.')
    }
    
    if (error.code === 'P1000') {
      console.error('\n💡 Solution:')
      console.error('   Authentication failed.')
      console.error('   Check your database credentials in DATABASE_URL.')
    }
    
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()

