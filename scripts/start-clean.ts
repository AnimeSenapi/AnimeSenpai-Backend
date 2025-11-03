#!/usr/bin/env bun
/**
 * Start Backend with Clean Logging
 * 
 * Starts the backend server with reduced debug output for cleaner terminal experience
 */

import { spawn } from 'child_process'
import { join } from 'path'

// Set environment variables for cleaner logging
const env = {
  ...process.env,
  NODE_ENV: 'development',
  LOG_LEVEL: 'info', // Reduce from debug to info
  QUIET_MODE: 'false',
  ENABLE_REQUEST_LOGGING: 'true',
  ENABLE_PERFORMANCE_LOGGING: 'false', // Disable performance logging
  ENABLE_SECURITY_LOGGING: 'true',
  ENABLE_CACHE_LOGGING: 'false', // Disable cache logging
  ENABLE_DATABASE_LOGGING: 'false', // Disable database logging
  ENABLE_MONITORING_LOGGING: 'false', // Disable monitoring logging
  ENABLE_SYSTEM_LOGGING: 'false', // Disable system logging
}

console.log('🚀 Starting AnimeSenpai Backend with Clean Logging')
console.log('================================================')
console.log('📋 Logging Configuration:')
console.log(`   Level: ${env.LOG_LEVEL}`)
console.log(`   Request Logging: ${env.ENABLE_REQUEST_LOGGING}`)
console.log(`   Performance Logging: ${env.ENABLE_PERFORMANCE_LOGGING}`)
console.log(`   Security Logging: ${env.ENABLE_SECURITY_LOGGING}`)
console.log(`   Cache Logging: ${env.ENABLE_CACHE_LOGGING}`)
console.log(`   Database Logging: ${env.ENABLE_DATABASE_LOGGING}`)
console.log(`   Monitoring Logging: ${env.ENABLE_MONITORING_LOGGING}`)
console.log(`   System Logging: ${env.ENABLE_SYSTEM_LOGGING}`)
console.log('')

// Start the server
const serverPath = join(__dirname, '..', 'src', 'index.ts')
const child = spawn('bun', ['run', '--hot', serverPath], {
  env,
  stdio: 'inherit',
  cwd: join(__dirname, '..')
})

child.on('error', (error) => {
  console.error('❌ Failed to start server:', error)
  process.exit(1)
})

child.on('exit', (code) => {
  console.log(`\n🛑 Server exited with code ${code}`)
  process.exit(code || 0)
})

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...')
  child.kill('SIGINT')
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...')
  child.kill('SIGTERM')
})
