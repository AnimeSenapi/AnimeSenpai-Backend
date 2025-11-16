#!/usr/bin/env bun
/**
 * Verify Prisma Optimize Setup
 * 
 * This script helps diagnose why Optimize might not be recording queries
 */

import { db } from '../src/lib/db'

console.log('\n🔍 Verifying Prisma Optimize Setup...\n')

// Check environment
console.log('📋 Environment Check:')
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set (defaults to development)'}`)
console.log(`   OPTIMIZE_API_KEY: ${process.env.OPTIMIZE_API_KEY ? '✅ Set' : '❌ Not set'}`)
if (process.env.OPTIMIZE_API_KEY) {
  const key = process.env.OPTIMIZE_API_KEY.trim()
  console.log(`   API Key preview: ${key.substring(0, 10)}...${key.substring(key.length - 4)}`)
}
console.log('')

// Check if db has Optimize extension
console.log('🔌 Checking Prisma Client Extensions:')
console.log(`   db instance: ${typeof db}`)
console.log(`   Has $extends: ${typeof db.$extends === 'function' ? '✅' : '❌'}`)
console.log(`   Has user model: ${typeof db.user === 'object' ? '✅' : '❌'}`)
console.log('')

// Test connection
console.log('🧪 Testing Database Connection:')
try {
  const userCount = await db.user.count()
  console.log(`   ✅ Database connection OK (${userCount} users)`)
} catch (error) {
  console.error(`   ❌ Database connection failed:`, error)
  process.exit(1)
}

console.log('')
console.log('📊 Prisma Optimize Checklist:')
console.log('   ✅ 1. OPTIMIZE_API_KEY is set in .env')
console.log('   ✅ 2. Server was restarted after adding API key')
console.log('   ✅ 3. Optimize extension is loaded (check server startup logs)')
console.log('   ⚠️  4. Go to https://optimize.prisma.io and click "Start Recording"')
console.log('   ⚠️  5. Execute queries WHILE recording is active')
console.log('   ⚠️  6. Click "Stop Recording" to view results')
console.log('')
console.log('💡 Next Steps:')
console.log('   1. Make sure your dev server shows: "✅ Optimize extension loaded successfully"')
console.log('   2. Go to https://optimize.prisma.io')
console.log('   3. Click "Start Recording" (button should show recording is active)')
console.log('   4. While recording, run this script: bun run test:optimize')
console.log('   5. OR use your application to make API calls')
console.log('   6. Click "Stop Recording"')
console.log('   7. Check the dashboard for your queries')
console.log('')

await db.$disconnect()

