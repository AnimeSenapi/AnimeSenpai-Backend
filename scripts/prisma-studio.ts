import { config } from 'dotenv'
import { $ } from 'bun'

// Load environment variables
config()

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('❌ Error: DATABASE_URL not found in .env file')
  console.error('   Please ensure DATABASE_URL is set in your .env file')
  process.exit(1)
}

console.log('🚀 Starting Prisma Studio...')
console.log(`   Database URL: ${databaseUrl.substring(0, 50)}...`)

// Run prisma studio with the database URL
await $`bunx prisma studio --url ${databaseUrl}`

