#!/usr/bin/env bun

/**
 * Database Backup Script
 * 
 * Creates a backup of the database and optionally verifies it.
 * 
 * Usage:
 *   bun run scripts/backup-db.ts [--verify] [--output-dir=./backups]
 */

import { $ } from 'bun'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const DATABASE_URL = process.env.DATABASE_URL
const OUTPUT_DIR = process.argv.find(arg => arg.startsWith('--output-dir='))?.split('=')[1] || './backups'
const VERIFY = process.argv.includes('--verify')

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set')
  process.exit(1)
}

// Check if using Prisma Accelerate
const isAccelerate = DATABASE_URL.startsWith('prisma://')

if (isAccelerate) {
  console.log('⚠️  Prisma Accelerate detected')
  console.log('📝 Backups are handled by Prisma Accelerate')
  console.log('🔗 Check backup status at: https://console.prisma.io/')
  console.log('\nTo create a manual backup, use direct PostgreSQL connection.')
  process.exit(0)
}

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true })
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
  new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, '-')
const backupFile = join(OUTPUT_DIR, `backup-${timestamp}.sql`)
const compressedFile = `${backupFile}.gz`

console.log(`\n📦 Creating database backup...`)
console.log(`📁 Output directory: ${OUTPUT_DIR}`)
console.log(`📄 Backup file: ${backupFile}`)

try {
  // Create backup using pg_dump
  const dumpProcess = Bun.spawn(['pg_dump', DATABASE_URL], {
    stdout: Bun.file(backupFile).writer(),
    stderr: 'inherit'
  })

  await dumpProcess.exited

  if (dumpProcess.exitCode !== 0) {
    console.error('❌ Backup failed')
    process.exit(1)
  }

  // Compress backup
  console.log('🗜️  Compressing backup...')
  await $`gzip ${backupFile}`.quiet()

  const stats = Bun.stat(compressedFile)
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2)

  console.log(`✅ Backup created successfully`)
  console.log(`📊 Size: ${sizeMB} MB`)
  console.log(`📁 Location: ${compressedFile}`)

  // Verify backup if requested
  if (VERIFY) {
    console.log('\n🔍 Verifying backup...')
    
    // Extract backup
    const tempFile = join(OUTPUT_DIR, `verify-${timestamp}.sql`)
    await $`gunzip -c ${compressedFile} > ${tempFile}`.quiet()

    // Check backup contains data
    const backupContent = await Bun.file(tempFile).text()
    
    if (backupContent.includes('CREATE TABLE') && backupContent.includes('INSERT INTO')) {
      console.log('✅ Backup verification passed')
      console.log('   - Contains CREATE TABLE statements')
      console.log('   - Contains INSERT statements')
    } else {
      console.warn('⚠️  Backup verification warning')
      console.warn('   - Backup may be incomplete')
    }

    // Cleanup temp file
    await Bun.write(tempFile, '')
    await $`rm ${tempFile}`.quiet()
  }

  // Cleanup old backups (keep last 30 days)
  console.log('\n🧹 Cleaning up old backups...')
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
  
  // Note: This is a simple implementation
  // For production, use a more robust cleanup strategy
  console.log('💡 Old backups cleanup should be handled by your backup system')

  console.log('\n✅ Backup process completed successfully')
  console.log(`📁 Backup saved to: ${compressedFile}`)

} catch (error) {
  console.error('❌ Backup failed:', error)
  process.exit(1)
}

