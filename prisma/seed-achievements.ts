import { PrismaClient } from '../generated/prisma/client/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required')
}

const pool = new pg.Pool({ connectionString: databaseUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const achievements = [
  // Watching Achievements
  {
    key: 'first_anime',
    name: 'First Steps',
    description: 'Add your first anime to your list',
    icon: 'film',
    category: 'watching',
    tier: 'bronze',
    requirement: 1,
    points: 10
  },
  {
    key: 'anime_10',
    name: 'Getting Started',
    description: 'Add 10 anime to your list',
    icon: 'book-open',
    category: 'watching',
    tier: 'bronze',
    requirement: 10,
    points: 20
  },
  {
    key: 'anime_25',
    name: 'Casual Viewer',
    description: 'Add 25 anime to your list',
    icon: 'book-open',
    category: 'watching',
    tier: 'silver',
    requirement: 25,
    points: 30
  },
  {
    key: 'anime_50',
    name: 'Dedicated Fan',
    description: 'Add 50 anime to your list',
    icon: 'book-open',
    category: 'watching',
    tier: 'silver',
    requirement: 50,
    points: 50
  },
  {
    key: 'anime_100',
    name: 'Anime Enthusiast',
    description: 'Add 100 anime to your list',
    icon: 'book-open',
    category: 'watching',
    tier: 'gold',
    requirement: 100,
    points: 100
  },
  {
    key: 'anime_250',
    name: 'Anime Expert',
    description: 'Add 250 anime to your list',
    icon: 'book-open',
    category: 'watching',
    tier: 'gold',
    requirement: 250,
    points: 150
  },
  {
    key: 'anime_500',
    name: 'Anime Master',
    description: 'Add 500 anime to your list',
    icon: 'book-open',
    category: 'watching',
    tier: 'platinum',
    requirement: 500,
    points: 250
  },
  {
    key: 'anime_1000',
    name: 'Anime Legend',
    description: 'Add 1000 anime to your list',
    icon: 'book-open',
    category: 'watching',
    tier: 'diamond',
    requirement: 1000,
    points: 500
  },

  // Completion Achievements
  {
    key: 'completed_10',
    name: 'Completionist',
    description: 'Complete 10 anime',
    icon: 'check-circle',
    category: 'watching',
    tier: 'bronze',
    requirement: 10,
    points: 30
  },
  {
    key: 'completed_50',
    name: 'Series Finisher',
    description: 'Complete 50 anime',
    icon: 'check-circle',
    category: 'watching',
    tier: 'silver',
    requirement: 50,
    points: 70
  },
  {
    key: 'completed_100',
    name: 'Master Finisher',
    description: 'Complete 100 anime',
    icon: 'check-circle',
    category: 'watching',
    tier: 'gold',
    requirement: 100,
    points: 120
  },
  {
    key: 'completed_250',
    name: 'Ultimate Completionist',
    description: 'Complete 250 anime',
    icon: 'check-circle',
    category: 'watching',
    tier: 'platinum',
    requirement: 250,
    points: 200
  },

  // Rating Achievements
  {
    key: 'first_rating',
    name: 'First Impression',
    description: 'Rate your first anime',
    icon: 'star',
    category: 'rating',
    tier: 'bronze',
    requirement: 1,
    points: 10
  },
  {
    key: 'ratings_10',
    name: 'Opinionated',
    description: 'Rate 10 anime',
    icon: 'star',
    category: 'rating',
    tier: 'bronze',
    requirement: 10,
    points: 20
  },
  {
    key: 'ratings_50',
    name: 'Critic in Training',
    description: 'Rate 50 anime',
    icon: 'star',
    category: 'rating',
    tier: 'silver',
    requirement: 50,
    points: 50
  },
  {
    key: 'ratings_100',
    name: 'Seasoned Critic',
    description: 'Rate 100 anime',
    icon: 'star',
    category: 'rating',
    tier: 'gold',
    requirement: 100,
    points: 100
  },
  {
    key: 'ratings_250',
    name: 'Master Critic',
    description: 'Rate 250 anime',
    icon: 'star',
    category: 'rating',
    tier: 'platinum',
    requirement: 250,
    points: 180
  },

  // Social Achievements
  {
    key: 'first_follower',
    name: 'Not Alone',
    description: 'Get your first follower',
    icon: 'user-plus',
    category: 'social',
    tier: 'bronze',
    requirement: 1,
    points: 20
  },
  {
    key: 'followers_10',
    name: 'Community Member',
    description: 'Reach 10 followers',
    icon: 'users',
    category: 'social',
    tier: 'silver',
    requirement: 10,
    points: 50
  },
  {
    key: 'followers_50',
    name: 'Influencer',
    description: 'Reach 50 followers',
    icon: 'users',
    category: 'social',
    tier: 'gold',
    requirement: 50,
    points: 100
  },
  {
    key: 'followers_100',
    name: 'Anime Celebrity',
    description: 'Reach 100 followers',
    icon: 'users',
    category: 'social',
    tier: 'platinum',
    requirement: 100,
    points: 200
  },
  {
    key: 'following_10',
    name: 'Explorer',
    description: 'Follow 10 users',
    icon: 'users-2',
    category: 'social',
    tier: 'bronze',
    requirement: 10,
    points: 15
  },
  {
    key: 'friends_5',
    name: 'Social Butterfly',
    description: 'Have 5 mutual friends',
    icon: 'heart',
    category: 'social',
    tier: 'silver',
    requirement: 5,
    points: 75
  },

  // Discovery Achievements
  {
    key: 'genres_5',
    name: 'Genre Explorer',
    description: 'Watch anime from 5 different genres',
    icon: 'compass',
    category: 'discovery',
    tier: 'bronze',
    requirement: 5,
    points: 25
  },
  {
    key: 'genres_10',
    name: 'Genre Enthusiast',
    description: 'Watch anime from 10 different genres',
    icon: 'compass',
    category: 'discovery',
    tier: 'silver',
    requirement: 10,
    points: 60
  },
  {
    key: 'genres_15',
    name: 'Genre Master',
    description: 'Watch anime from 15 different genres',
    icon: 'compass',
    category: 'discovery',
    tier: 'gold',
    requirement: 15,
    points: 120
  },

  // Review Achievements
  {
    key: 'first_review',
    name: 'First Review',
    description: 'Write your first anime review',
    icon: 'pen-tool',
    category: 'review',
    tier: 'bronze',
    requirement: 1,
    points: 15
  },
  {
    key: 'reviewer_10',
    name: 'Reviewer',
    description: 'Write 10 anime reviews',
    icon: 'message-square',
    category: 'review',
    tier: 'silver',
    requirement: 10,
    points: 40
  },
  {
    key: 'reviewer_50',
    name: 'Prolific Reviewer',
    description: 'Write 50 anime reviews',
    icon: 'message-square',
    category: 'review',
    tier: 'gold',
    requirement: 50,
    points: 90
  },

  // Special Achievements
  {
    key: 'early_adopter',
    name: 'Early Adopter',
    description: 'Joined AnimeSenpai within the first month of launch',
    icon: 'rocket',
    category: 'special',
    tier: 'gold',
    requirement: 1,
    points: 100
  },
  {
    key: 'profile_complete',
    name: 'Profile Perfect',
    description: 'Complete your profile (avatar & bio)',
    icon: 'user-check',
    category: 'special',
    tier: 'silver',
    requirement: 1,
    points: 50
  },
  {
    key: 'perfectionist',
    name: 'Perfectionist',
    description: 'Give 10 anime a perfect 10/10 rating',
    icon: 'gem',
    category: 'special',
    tier: 'gold',
    requirement: 10,
    points: 150
  },
  {
    key: 'streak_7',
    name: '7-Day Streak',
    description: 'Log activity for 7 consecutive days',
    icon: 'flame',
    category: 'special',
    tier: 'silver',
    requirement: 7,
    points: 70
  },
  {
    key: 'streak_30',
    name: '30-Day Streak',
    description: 'Log activity for 30 consecutive days',
    icon: 'calendar',
    category: 'special',
    tier: 'gold',
    requirement: 30,
    points: 180
  }
]

async function main() {
  console.log('🌱 Seeding achievements...')

  for (const achievementData of achievements) {
    await prisma.achievement.upsert({
      where: { key: achievementData.key },
      update: achievementData,
      create: achievementData,
    })
  }

  console.log(`✅ Seeded ${achievements.length} achievements`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })