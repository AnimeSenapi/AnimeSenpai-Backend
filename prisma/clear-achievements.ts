import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🗑️ Clearing all achievements...')

  // First, delete all user achievements (foreign key constraint)
  const deletedUserAchievements = await prisma.userAchievement.deleteMany({})
  console.log(`✅ Deleted ${deletedUserAchievements.count} user achievements`)

  // Then delete all achievements
  const deletedAchievements = await prisma.achievement.deleteMany({})
  console.log(`✅ Deleted ${deletedAchievements.count} achievements`)

  console.log('🎉 All achievements cleared successfully!')
}

main()
  .catch((e) => {
    console.error('Error clearing achievements:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
