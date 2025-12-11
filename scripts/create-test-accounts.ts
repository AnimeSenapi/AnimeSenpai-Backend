/**
 * AnimeSenpai - Test Account Generator
 * 
 * Creates test accounts with different data states for testing
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required')
}

const pool = new pg.Pool({ connectionString: databaseUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Test account configurations
const TEST_ACCOUNTS = [
  {
    username: 'newbie_tester',
    email: 'newbie@test.animesenpai.com',
    password: 'TestPass123!',
    role: 'user',
    emailVerified: true,
    description: 'New user with minimal data',
    listCount: 3,
    ratingCount: 1,
    reviewCount: 0
  },
  {
    username: 'casual_viewer',
    email: 'casual@test.animesenpai.com',
    password: 'TestPass123!',
    role: 'user',
    emailVerified: true,
    description: 'Casual viewer with moderate activity',
    listCount: 25,
    ratingCount: 15,
    reviewCount: 3
  },
  {
    username: 'anime_enthusiast',
    email: 'enthusiast@test.animesenpai.com',
    password: 'TestPass123!',
    role: 'user',
    emailVerified: true,
    description: 'Active user with lots of data',
    listCount: 100,
    ratingCount: 80,
    reviewCount: 20
  },
  {
    username: 'unverified_user',
    email: 'unverified@test.animesenpai.com',
    password: 'TestPass123!',
    role: 'user',
    emailVerified: false,
    description: 'User who hasn\'t verified email yet',
    listCount: 0,
    ratingCount: 0,
    reviewCount: 0
  },
  {
    username: 'test_admin',
    email: 'admin@test.animesenpai.com',
    password: 'AdminPass123!',
    role: 'admin',
    emailVerified: true,
    description: 'Admin user for testing admin features',
    listCount: 50,
    ratingCount: 40,
    reviewCount: 10
  }
]

/**
 * Create a test user with specified data
 */
async function createTestUser(config: typeof TEST_ACCOUNTS[0]) {
  try {
    console.log(`\n👤 Creating user: ${config.username}`)
    console.log(`   Email: ${config.email}`)
    console.log(`   Role: ${config.role}`)
    console.log(`   Description: ${config.description}`)
    
    // Check if user already exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: config.email },
          { username: config.username }
        ]
      }
    })
    
    if (existing) {
      console.log(`   ⏭️  Already exists, skipping...`)
      return existing
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(config.password, 10)
    
    // Create user
    const user = await prisma.user.create({
      data: {
        username: config.username,
        email: config.email,
        password: hashedPassword,
        role: config.role as 'user' | 'admin' | 'moderator',
        emailVerified: config.emailVerified,
        name: config.username.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        bio: `Test account: ${config.description}`
      }
    })
    
    console.log(`   ✅ User created (ID: ${user.id})`)
    
    // Add anime to their list
    if (config.listCount > 0) {
      console.log(`   📝 Adding ${config.listCount} anime to list...`)
      
      const anime = await prisma.anime.findMany({
        take: config.listCount,
        orderBy: { averageRating: 'desc' }
      })
      
      const statuses = ['watching', 'completed', 'plan_to_watch', 'favorite']
      
      for (let i = 0; i < anime.length; i++) {
        const status = statuses[i % statuses.length]
        const score = i < config.ratingCount ? Math.floor(Math.random() * 5) + 6 : null // 6-10 rating
        
        await prisma.userAnimeList.create({
          data: {
            userId: user.id,
            animeId: anime[i].id,
            status,
            score,
            progress: status === 'completed' ? (anime[i].episodes || 12) : Math.floor(Math.random() * (anime[i].episodes || 12))
          }
        })
      }
      
      console.log(`   ✅ Added ${anime.length} anime to list`)
    }
    
    // Add ratings
    if (config.ratingCount > 0) {
      console.log(`   ⭐ Adding ${config.ratingCount} ratings...`)
      
      const listEntries = await prisma.userAnimeList.findMany({
        where: { userId: user.id },
        take: config.ratingCount
      })
      
      for (const entry of listEntries) {
        const score = Math.floor(Math.random() * 5) + 6 // 6-10 rating
        
        await prisma.userAnimeRating.upsert({
          where: {
            userId_animeId: {
              userId: user.id,
              animeId: entry.animeId
            }
          },
          update: {},
          create: {
            userId: user.id,
            animeId: entry.animeId,
            score
          }
        })
      }
      
      console.log(`   ✅ Added ${listEntries.length} ratings`)
    }
    
    // Add reviews
    if (config.reviewCount > 0) {
      console.log(`   📄 Adding ${config.reviewCount} reviews...`)
      
      const listEntries = await prisma.userAnimeList.findMany({
        where: { userId: user.id },
        take: config.reviewCount,
        include: { anime: true }
      })
      
      const reviewTemplates = [
        { title: 'Amazing!', content: 'This anime exceeded all my expectations. The story, characters, and animation are all top-notch.' },
        { title: 'Pretty good', content: 'I enjoyed this anime overall. Had some great moments and memorable characters.' },
        { title: 'Masterpiece', content: 'One of the best anime I\'ve ever watched. Can\'t recommend it enough!' },
        { title: 'Worth watching', content: 'Solid anime with good pacing and character development. Definitely worth your time.' },
        { title: 'Incredible journey', content: 'This anime took me on an emotional rollercoaster. The ending was perfect!' }
      ]
      
      for (let i = 0; i < listEntries.length; i++) {
        const template = reviewTemplates[i % reviewTemplates.length]
        const score = Math.floor(Math.random() * 3) + 8 // 8-10 rating for reviews
        
        await prisma.userAnimeReview.create({
          data: {
            userId: user.id,
            animeId: listEntries[i].animeId,
            title: template.title,
            content: template.content,
            score,
            isSpoiler: false,
            isPublic: true,
            likes: Math.floor(Math.random() * 20)
          }
        })
      }
      
      console.log(`   ✅ Added ${listEntries.length} reviews`)
    }
    
    console.log(`   🎉 ${config.username} complete!`)
    return user
    
  } catch (error) {
    console.error(`   ❌ Error creating user ${config.username}:`, error)
    throw error
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🧪 AnimeSenpai Test Account Generator')
  console.log('=======================================\n')
  
  console.log(`📋 Creating ${TEST_ACCOUNTS.length} test accounts...\n`)
  console.log('⚠️  Default password for all test accounts: TestPass123!\n')
  
  // Check if we have anime in the database
  const animeCount = await prisma.anime.count()
  
  if (animeCount < 10) {
    console.log('⚠️  Warning: Less than 10 anime in database.')
    console.log('   Run the anime import script first for better test data.\n')
  }
  
  // Create test accounts
  for (const config of TEST_ACCOUNTS) {
    await createTestUser(config)
  }
  
  console.log('\n\n🎉 Test Account Creation Complete!')
  console.log('====================================\n')
  
  console.log('📝 Test Account Credentials:\n')
  TEST_ACCOUNTS.forEach((account, i) => {
    console.log(`${i + 1}. ${account.username}`)
    console.log(`   Email: ${account.email}`)
    console.log(`   Password: ${account.password}`)
    console.log(`   Role: ${account.role}`)
    console.log(`   Verified: ${account.emailVerified ? 'Yes' : 'No'}`)
    console.log()
  })
  
  console.log('💡 Use these accounts to test different user states and flows!')
  console.log('💡 Remember to delete or disable these accounts in production!')
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

