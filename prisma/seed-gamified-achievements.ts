import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding gamified achievements...')

  // Define achievement types with their tiers based on achievements.md
  const achievementTypes = [
    {
      key: 'anime_completed',
      baseName: 'Anime Collector',
      baseDescription: 'Build your ultimate anime collection and become a true otaku',
      icon: 'book',
      category: 'watching',
      maxTier: 8,
      tiers: [
        { tier: 1, requirement: 1, points: 10, name: 'First Weeb Steps', description: 'Complete your very first anime! The collection begins' },
        { tier: 2, requirement: 10, points: 25, name: 'Anime Rookie', description: 'Your collection is growing! 10 anime strong' },
        { tier: 3, requirement: 25, points: 50, name: 'Casual Otaku', description: 'You\'re getting serious about this anime thing' },
        { tier: 4, requirement: 50, points: 100, name: 'Anime Enthusiast', description: 'Half a century of anime! You\'re committed' },
        { tier: 5, requirement: 100, points: 200, name: 'Anime Connoisseur', description: '100 anime! You\'re officially an anime expert' },
        { tier: 6, requirement: 250, points: 400, name: 'Anime Sage', description: '250 anime! Your knowledge is legendary' },
        { tier: 7, requirement: 500, points: 750, name: 'Anime Grandmaster', description: '500 anime! You\'ve transcended mortal anime watching' },
        { tier: 8, requirement: 1000, points: 1500, name: 'Anime God', description: '1000 anime! You are the ultimate anime deity' },
      ]
    },
    {
      key: 'anime_rated',
      baseName: 'Rating Ruler',
      baseDescription: 'Judge anime like the supreme court of entertainment',
      icon: 'star',
      category: 'rating',
      maxTier: 6,
      tiers: [
        { tier: 1, requirement: 1, points: 10, name: 'First Judgment', description: 'You\'ve passed your first verdict on an anime' },
        { tier: 2, requirement: 10, points: 25, name: 'Opinionated Judge', description: '10 anime judged! Your opinions are getting stronger' },
        { tier: 3, requirement: 25, points: 50, name: 'Critic Apprentice', description: '25 anime rated! You\'re learning the art of criticism' },
        { tier: 4, requirement: 50, points: 100, name: 'Rating Veteran', description: '50 anime judged! You\'re a seasoned critic' },
        { tier: 5, requirement: 100, points: 200, name: 'Critic Supreme', description: '100 anime rated! Your judgment is legendary' },
        { tier: 6, requirement: 250, points: 400, name: 'Rating God', description: '250 anime! You are the ultimate anime judge' },
      ]
    },
    {
      key: 'perfect_ratings',
      baseName: 'Perfect Score Prophet',
      baseDescription: 'Bestow the sacred 10/10 rating upon anime masterpieces',
      icon: 'gem',
      category: 'rating',
      maxTier: 4,
      tiers: [
        { tier: 1, requirement: 1, points: 20, name: 'First Perfect', description: 'You\'ve found your first 10/10 masterpiece!' },
        { tier: 2, requirement: 5, points: 50, name: 'Selective Sage', description: '5 perfect scores! You have impeccable taste' },
        { tier: 3, requirement: 15, points: 100, name: 'Perfection Prophet', description: '15 perfect scores! You know true greatness' },
        { tier: 4, requirement: 35, points: 200, name: 'Perfect Score Deity', description: '35 perfect scores! You are the oracle of anime perfection' },
      ]
    },
    {
      key: 'reviews_written',
      baseName: 'Word Wizard',
      baseDescription: 'Craft epic reviews and become the Shakespeare of anime',
      icon: 'message-square',
      category: 'rating',
      maxTier: 5,
      tiers: [
        { tier: 1, requirement: 1, points: 15, name: 'First Words', description: 'You\'ve penned your first anime masterpiece!' },
        { tier: 2, requirement: 5, points: 35, name: 'Review Rookie', description: '5 reviews written! Your words are flowing' },
        { tier: 3, requirement: 15, points: 75, name: 'Prolific Poet', description: '15 reviews! You\'re a writing machine' },
        { tier: 4, requirement: 35, points: 150, name: 'Review Royalty', description: '35 reviews! You\'re the king/queen of anime words' },
        { tier: 5, requirement: 75, points: 300, name: 'Word Wizard Supreme', description: '75 reviews! You are the ultimate anime wordsmith' },
      ]
    },
    {
      key: 'followers_gained',
      baseName: 'Fan Magnet',
      baseDescription: 'Attract anime fans like a powerful magnet attracts metal',
      icon: 'users',
      category: 'social',
      maxTier: 5,
      tiers: [
        { tier: 1, requirement: 1, points: 20, name: 'First Fan', description: 'Someone actually followed you! The beginning of your empire' },
        { tier: 2, requirement: 5, points: 50, name: 'Fan Club Founder', description: '5 followers! You\'re building a small army' },
        { tier: 3, requirement: 15, points: 100, name: 'Rising Star', description: '15 followers! You\'re becoming anime famous' },
        { tier: 4, requirement: 35, points: 200, name: 'Influence Master', description: '35 followers! You\'re a social media wizard' },
        { tier: 5, requirement: 75, points: 400, name: 'Anime Celebrity', description: '75 followers! You are the ultimate anime influencer' },
      ]
    },
    {
      key: 'following_count',
      baseName: 'Social Butterfly',
      baseDescription: 'Flit from user to user like a beautiful social butterfly',
      icon: 'users-2',
      category: 'social',
      maxTier: 4,
      tiers: [
        { tier: 1, requirement: 5, points: 15, name: 'First Flutter', description: 'You\'ve started following 5 users! The social journey begins' },
        { tier: 2, requirement: 15, points: 35, name: 'Network Ninja', description: '15 users followed! You\'re building your social web' },
        { tier: 3, requirement: 35, points: 75, name: 'Connection King/Queen', description: '35 users! You\'re the ultimate social connector' },
        { tier: 4, requirement: 75, points: 150, name: 'Social Superstar', description: '75 users! You are the social butterfly supreme' },
      ]
    },
    {
      key: 'mutual_friends',
      baseName: 'Friendship Forger',
      baseDescription: 'Forge unbreakable bonds of anime friendship',
      icon: 'heart',
      category: 'social',
      maxTier: 4,
      tiers: [
        { tier: 1, requirement: 1, points: 25, name: 'First Bond', description: 'You\'ve forged your first mutual friendship!' },
        { tier: 2, requirement: 5, points: 60, name: 'Friendship Builder', description: '5 mutual friends! You\'re building your squad' },
        { tier: 3, requirement: 15, points: 120, name: 'Community Champion', description: '15 mutual friends! You\'re a friendship legend' },
        { tier: 4, requirement: 35, points: 250, name: 'Friendship God', description: '35 mutual friends! You are the ultimate friendship forger' },
      ]
    },
    {
      key: 'genres_explored',
      baseName: 'Genre Adventurer',
      baseDescription: 'Embark on epic quests across every anime genre imaginable',
      icon: 'compass',
      category: 'discovery',
      maxTier: 4,
      tiers: [
        { tier: 1, requirement: 3, points: 25, name: 'Genre Rookie', description: 'You\'ve dabbled in 3 genres! The adventure begins' },
        { tier: 2, requirement: 6, points: 60, name: 'Genre Explorer', description: '6 genres conquered! You\'re becoming a true adventurer' },
        { tier: 3, requirement: 10, points: 120, name: 'Genre Warrior', description: '10 genres! You\'re a genre-bending legend' },
        { tier: 4, requirement: 15, points: 200, name: 'Genre Master', description: '15 genres! You are the ultimate genre adventurer' },
      ]
    },
    {
      key: 'studios_explored',
      baseName: 'Studio Detective',
      baseDescription: 'Investigate and uncover anime from every studio in existence',
      icon: 'search',
      category: 'discovery',
      maxTier: 4,
      tiers: [
        { tier: 1, requirement: 3, points: 20, name: 'Studio Rookie', description: 'You\'ve investigated 3 studios! The case begins' },
        { tier: 2, requirement: 8, points: 50, name: 'Studio Sleuth', description: '8 studios uncovered! You\'re getting good at this' },
        { tier: 3, requirement: 15, points: 100, name: 'Studio Detective', description: '15 studios! You\'re a master investigator' },
        { tier: 4, requirement: 25, points: 200, name: 'Studio Sherlock', description: '25 studios! You are the ultimate studio detective' },
      ]
    },
    {
      key: 'hidden_gems_discovered',
      baseName: 'Treasure Hunter',
      baseDescription: 'Unearth hidden anime treasures that others have overlooked',
      icon: 'gem',
      category: 'discovery',
      maxTier: 3,
      tiers: [
        { tier: 1, requirement: 5, points: 30, name: 'Gem Seeker', description: 'You\'ve found 5 hidden anime treasures!' },
        { tier: 2, requirement: 15, points: 75, name: 'Treasure Hunter', description: '15 gems discovered! You have a nose for quality' },
        { tier: 3, requirement: 35, points: 150, name: 'Gem Master', description: '35 gems! You are the ultimate treasure hunter' },
      ]
    },
    {
      key: 'early_adopter',
      baseName: 'Pioneer',
      baseDescription: 'Be among the first to discover the ultimate anime platform',
      icon: 'rocket',
      category: 'special',
      maxTier: 1,
      tiers: [
        { tier: 1, requirement: 1, points: 100, name: 'Platform Pioneer', description: 'You joined AnimeSenpai in its first month! You\'re a true pioneer' },
      ]
    },
    {
      key: 'profile_complete',
      baseName: 'Profile Perfectionist',
      baseDescription: 'Craft the perfect anime profile that represents your true self',
      icon: 'user-check',
      category: 'special',
      maxTier: 1,
      tiers: [
        { tier: 1, requirement: 1, points: 50, name: 'Profile Masterpiece', description: 'Your profile is complete! You\'ve created a work of art' },
      ]
    },
    {
      key: 'daily_streak',
      baseName: 'Consistency Champion',
      baseDescription: 'Prove your dedication with unbreakable daily streaks',
      icon: 'flame',
      category: 'special',
      maxTier: 5,
      tiers: [
        { tier: 1, requirement: 3, points: 25, name: 'Streak Starter', description: '3 days in a row! You\'re building momentum' },
        { tier: 2, requirement: 7, points: 60, name: 'Week Warrior', description: '7 days strong! You\'re becoming unstoppable' },
        { tier: 3, requirement: 15, points: 120, name: 'Consistency Champion', description: '15 days! You\'re a streak machine' },
        { tier: 4, requirement: 30, points: 250, name: 'Month Master', description: '30 days! You\'ve achieved streak mastery' },
        { tier: 5, requirement: 100, points: 500, name: 'Streak God', description: '100 days! You are the ultimate consistency champion' },
      ]
    },
    {
      key: 'platform_features_used',
      baseName: 'Feature Explorer',
      baseDescription: 'Master every feature the platform has to offer',
      icon: 'settings',
      category: 'special',
      maxTier: 3,
      tiers: [
        { tier: 1, requirement: 5, points: 30, name: 'Feature Rookie', description: 'You\'ve used 5 features! The exploration begins' },
        { tier: 2, requirement: 10, points: 75, name: 'Feature Explorer', description: '10 features mastered! You\'re becoming a platform expert' },
        { tier: 3, requirement: 15, points: 150, name: 'Feature Master', description: '15 features! You are the ultimate platform explorer' },
      ]
    },
    {
      key: 'community_contributions',
      baseName: 'Community Hero',
      baseDescription: 'Rise up and become the hero the anime community needs',
      icon: 'award',
      category: 'special',
      maxTier: 3,
      tiers: [
        { tier: 1, requirement: 10, points: 40, name: 'Community Helper', description: '10 contributions! You\'re becoming a community hero' },
        { tier: 2, requirement: 25, points: 100, name: 'Community Champion', description: '25 contributions! You\'re a true community champion' },
        { tier: 3, requirement: 50, points: 200, name: 'Community Legend', description: '50 contributions! You are the ultimate community hero' },
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

  console.log(`🎉 Seeded ${achievementTypes.length} gamified achievement types with tier systems`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
