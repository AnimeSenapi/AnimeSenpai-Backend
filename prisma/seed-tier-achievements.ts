import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required')
}

const pool = new pg.Pool({ connectionString: databaseUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding tier-based achievements...')

  // Define achievement types with their tiers
  const achievementTypes = [
    {
      key: 'anime_watched',
      baseName: 'Anime Watcher',
      baseDescription: 'Watch anime and build your collection',
      icon: 'book',
      category: 'watching',
      maxTier: 8,
      tiers: [
        { tier: 1, requirement: 1, points: 10, name: 'First Steps', description: 'Add your first anime to your list' },
        { tier: 2, requirement: 10, points: 20, name: 'Getting Started', description: 'Add 10 anime to your list' },
        { tier: 3, requirement: 25, points: 30, name: 'Casual Viewer', description: 'Add 25 anime to your list' },
        { tier: 4, requirement: 50, points: 50, name: 'Dedicated Fan', description: 'Add 50 anime to your list' },
        { tier: 5, requirement: 100, points: 100, name: 'Anime Enthusiast', description: 'Add 100 anime to your list' },
        { tier: 6, requirement: 250, points: 150, name: 'Anime Expert', description: 'Add 250 anime to your list' },
        { tier: 7, requirement: 500, points: 250, name: 'Anime Master', description: 'Add 500 anime to your list' },
        { tier: 8, requirement: 1000, points: 500, name: 'Anime Legend', description: 'Add 1000 anime to your list' },
      ]
    },
    {
      key: 'anime_completed',
      baseName: 'Completionist',
      baseDescription: 'Complete anime series and finish what you start',
      icon: 'check-circle',
      category: 'watching',
      maxTier: 5,
      tiers: [
        { tier: 1, requirement: 5, points: 20, name: 'Getting Started', description: 'Complete 5 anime' },
        { tier: 2, requirement: 15, points: 40, name: 'Series Finisher', description: 'Complete 15 anime' },
        { tier: 3, requirement: 35, points: 70, name: 'Completionist', description: 'Complete 35 anime' },
        { tier: 4, requirement: 75, points: 120, name: 'Master Finisher', description: 'Complete 75 anime' },
        { tier: 5, requirement: 150, points: 200, name: 'Ultimate Completionist', description: 'Complete 150 anime' },
      ]
    },
    {
      key: 'anime_rated',
      baseName: 'Critic',
      baseDescription: 'Rate anime and share your opinions',
      icon: 'star',
      category: 'rating',
      maxTier: 6,
      tiers: [
        { tier: 1, requirement: 1, points: 10, name: 'First Impression', description: 'Rate your first anime' },
        { tier: 2, requirement: 10, points: 20, name: 'Opinionated', description: 'Rate 10 anime' },
        { tier: 3, requirement: 25, points: 40, name: 'Critic in Training', description: 'Rate 25 anime' },
        { tier: 4, requirement: 50, points: 70, name: 'Seasoned Critic', description: 'Rate 50 anime' },
        { tier: 5, requirement: 100, points: 120, name: 'Expert Critic', description: 'Rate 100 anime' },
        { tier: 6, requirement: 250, points: 200, name: 'Master Critic', description: 'Rate 250 anime' },
      ]
    },
    {
      key: 'followers_gained',
      baseName: 'Influencer',
      baseDescription: 'Build your following and connect with other anime fans',
      icon: 'users',
      category: 'social',
      maxTier: 5,
      tiers: [
        { tier: 1, requirement: 1, points: 20, name: 'Not Alone', description: 'Get your first follower' },
        { tier: 2, requirement: 5, points: 40, name: 'Community Member', description: 'Reach 5 followers' },
        { tier: 3, requirement: 15, points: 80, name: 'Rising Star', description: 'Reach 15 followers' },
        { tier: 4, requirement: 35, points: 150, name: 'Influencer', description: 'Reach 35 followers' },
        { tier: 5, requirement: 75, points: 250, name: 'Anime Celebrity', description: 'Reach 75 followers' },
      ]
    },
    {
      key: 'following_count',
      baseName: 'Explorer',
      baseDescription: 'Follow other users and discover new content',
      icon: 'users-2',
      category: 'social',
      maxTier: 4,
      tiers: [
        { tier: 1, requirement: 5, points: 15, name: 'Social Butterfly', description: 'Follow 5 users' },
        { tier: 2, requirement: 15, points: 30, name: 'Networker', description: 'Follow 15 users' },
        { tier: 3, requirement: 35, points: 60, name: 'Connector', description: 'Follow 35 users' },
        { tier: 4, requirement: 75, points: 100, name: 'Super Connector', description: 'Follow 75 users' },
      ]
    },
    {
      key: 'genres_explored',
      baseName: 'Genre Explorer',
      baseDescription: 'Discover anime across different genres',
      icon: 'compass',
      category: 'discovery',
      maxTier: 4,
      tiers: [
        { tier: 1, requirement: 3, points: 25, name: 'Genre Dabbler', description: 'Watch anime from 3 different genres' },
        { tier: 2, requirement: 6, points: 50, name: 'Genre Explorer', description: 'Watch anime from 6 different genres' },
        { tier: 3, requirement: 10, points: 100, name: 'Genre Enthusiast', description: 'Watch anime from 10 different genres' },
        { tier: 4, requirement: 15, points: 150, name: 'Genre Master', description: 'Watch anime from 15 different genres' },
      ]
    },
    {
      key: 'reviews_written',
      baseName: 'Reviewer',
      baseDescription: 'Write reviews and share your thoughts',
      icon: 'message-square',
      category: 'rating',
      maxTier: 5,
      tiers: [
        { tier: 1, requirement: 1, points: 15, name: 'First Review', description: 'Write your first anime review' },
        { tier: 2, requirement: 5, points: 30, name: 'Reviewer', description: 'Write 5 anime reviews' },
        { tier: 3, requirement: 15, points: 60, name: 'Prolific Reviewer', description: 'Write 15 anime reviews' },
        { tier: 4, requirement: 35, points: 120, name: 'Expert Reviewer', description: 'Write 35 anime reviews' },
        { tier: 5, requirement: 75, points: 200, name: 'Master Reviewer', description: 'Write 75 anime reviews' },
      ]
    },
    {
      key: 'perfect_ratings',
      baseName: 'Perfectionist',
      baseDescription: 'Give perfect ratings to your favorite anime',
      icon: 'gem',
      category: 'special',
      maxTier: 4,
      tiers: [
        { tier: 1, requirement: 1, points: 20, name: 'First Perfect', description: 'Give your first 10/10 rating' },
        { tier: 2, requirement: 5, points: 50, name: 'Selective', description: 'Give 5 anime a perfect 10/10 rating' },
        { tier: 3, requirement: 15, points: 100, name: 'Perfectionist', description: 'Give 15 anime a perfect 10/10 rating' },
        { tier: 4, requirement: 35, points: 200, name: 'Ultimate Perfectionist', description: 'Give 35 anime a perfect 10/10 rating' },
      ]
    },
    {
      key: 'profile_complete',
      baseName: 'Profile Perfect',
      baseDescription: 'Complete your profile setup',
      icon: 'user-check',
      category: 'special',
      maxTier: 1,
      tiers: [
        { tier: 1, requirement: 1, points: 50, name: 'Profile Perfect', description: 'Complete your profile (avatar & bio)' },
      ]
    },
    {
      key: 'early_adopter',
      baseName: 'Early Adopter',
      baseDescription: 'Join the community early',
      icon: 'rocket',
      category: 'special',
      maxTier: 1,
      tiers: [
        { tier: 1, requirement: 1, points: 100, name: 'Early Adopter', description: 'Joined AnimeSenpai within the first month of launch' },
      ]
    }
  ]

  for (const achievementType of achievementTypes) {
    // Create the base achievement
    const achievement = await prisma.achievement.upsert({
      where: { key: achievementType.key },
      update: {
        baseName: achievementType.baseName,
        baseDescription: achievementType.baseDescription,
        icon: achievementType.icon,
        category: achievementType.category,
        maxTier: achievementType.maxTier,
      },
      create: {
        key: achievementType.key,
        baseName: achievementType.baseName,
        baseDescription: achievementType.baseDescription,
        icon: achievementType.icon,
        category: achievementType.category,
        maxTier: achievementType.maxTier,
      },
    })

    // Create the tiers for this achievement
    for (const tierData of achievementType.tiers) {
      await prisma.achievementTier.upsert({
        where: {
          achievementId_tier: {
            achievementId: achievement.id,
            tier: tierData.tier,
          },
        },
        update: {
          requirement: tierData.requirement,
          points: tierData.points,
          name: tierData.name,
          description: tierData.description,
        },
        create: {
          achievementId: achievement.id,
          tier: tierData.tier,
          requirement: tierData.requirement,
          points: tierData.points,
          name: tierData.name,
          description: tierData.description,
        },
      })
    }

    console.log(`✅ Created achievement: ${achievementType.baseName} with ${achievementType.tiers.length} tiers`)
  }

  console.log(`🎉 Seeded ${achievementTypes.length} achievement types with tier systems`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
