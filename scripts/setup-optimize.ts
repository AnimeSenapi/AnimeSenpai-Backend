#!/usr/bin/env bun
/**
 * Setup Prisma Optimize
 * 
 * This script helps configure Optimize by checking environment variables
 * and providing instructions
 */

import { config } from 'dotenv'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// Load environment variables
config()

const envPath = join(process.cwd(), '.env')

console.log('\n🔧 Prisma Optimize Setup\n')

// Check current configuration
const hasApiKey = !!process.env.OPTIMIZE_API_KEY
const isEnabled = process.env.ENABLE_PRISMA_OPTIMIZE === 'true'

console.log('📋 Current Configuration:')
console.log(`   OPTIMIZE_API_KEY: ${hasApiKey ? '✅ Set' : '❌ Not set'}`)
console.log(`   ENABLE_PRISMA_OPTIMIZE: ${isEnabled ? '✅ Enabled' : '❌ Disabled'}`)
console.log('')

if (!hasApiKey) {
  console.log('❌ OPTIMIZE_API_KEY is not set')
  console.log('')
  console.log('📝 To enable Optimize:')
  console.log('   1. Go to https://console.prisma.io/optimize')
  console.log('   2. Sign up / Sign in')
  console.log('   3. Create a new project or select existing')
  console.log('   4. Get your API key')
  console.log('   5. Add to .env: OPTIMIZE_API_KEY="your-key-here"')
  console.log('   6. Add to .env: ENABLE_PRISMA_OPTIMIZE="true"')
  console.log('   7. Restart your dev server')
  process.exit(1)
}

if (!isEnabled) {
  console.log('⚠️  Optimize is disabled - Optimize extension will not load')
  console.log('')
  
  if (existsSync(envPath)) {
    try {
      const envContent = readFileSync(envPath, 'utf-8')
      
      if (!envContent.includes('ENABLE_PRISMA_OPTIMIZE')) {
        console.log('📝 Adding ENABLE_PRISMA_OPTIMIZE to .env...')
        const newLine = '\n# Enable Prisma Optimize\nENABLE_PRISMA_OPTIMIZE="true"\n'
        writeFileSync(envPath, envContent + newLine, 'utf-8')
        console.log('   ✅ Added ENABLE_PRISMA_OPTIMIZE="true" to .env')
        console.log('')
        console.log('🔄 Please restart your dev server for changes to take effect')
      } else {
        console.log('📝 ENABLE_PRISMA_OPTIMIZE found in .env but not set to "true"')
        console.log('   Please update it to: ENABLE_PRISMA_OPTIMIZE="true"')
      }
    } catch (error) {
      console.error('❌ Error updating .env file:', error)
      console.log('')
      console.log('📝 Please manually add to .env:')
      console.log('   ENABLE_PRISMA_OPTIMIZE="true"')
    }
  } else {
    console.log('📝 Please add to .env:')
    console.log('   ENABLE_PRISMA_OPTIMIZE="true"')
  }
} else {
  console.log('✅ Optimize is properly configured!')
  console.log('')
  console.log('📊 Next Steps:')
  console.log('   1. Make sure tracing is initialized (should be in src/index.ts)')
  console.log('   2. Start your dev server: bun dev')
  console.log('   3. Look for: "✅ Optimize extension loaded successfully"')
  console.log('   4. Go to https://optimize.prisma.io')
  console.log('   5. Click "Start Recording"')
  console.log('   6. Execute queries (use your app or run: bun run test:optimize)')
  console.log('   7. Click "Stop Recording"')
  console.log('   8. View results in the dashboard')
  console.log('')
}

