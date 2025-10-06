import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create genres
  const genres = await Promise.all([
    prisma.genre.upsert({
      where: { slug: 'action' },
      update: {},
      create: {
        name: 'Action',
        slug: 'action',
        description: 'Fast-paced, exciting anime with lots of fighting and adventure',
        color: '#FF6B6B'
      }
    }),
    prisma.genre.upsert({
      where: { slug: 'adventure' },
      update: {},
      create: {
        name: 'Adventure',
        slug: 'adventure',
        description: 'Journey-based anime with exploration and discovery',
        color: '#4ECDC4'
      }
    }),
    prisma.genre.upsert({
      where: { slug: 'comedy' },
      update: {},
      create: {
        name: 'Comedy',
        slug: 'comedy',
        description: 'Light-hearted and humorous anime',
        color: '#45B7D1'
      }
    }),
    prisma.genre.upsert({
      where: { slug: 'drama' },
      update: {},
      create: {
        name: 'Drama',
        slug: 'drama',
        description: 'Serious, emotional anime with character development',
        color: '#96CEB4'
      }
    }),
    prisma.genre.upsert({
      where: { slug: 'fantasy' },
      update: {},
      create: {
        name: 'Fantasy',
        slug: 'fantasy',
        description: 'Anime with magical elements and fantasy worlds',
        color: '#FFEAA7'
      }
    }),
    prisma.genre.upsert({
      where: { slug: 'romance' },
      update: {},
      create: {
        name: 'Romance',
        slug: 'romance',
        description: 'Love stories and romantic relationships',
        color: '#DDA0DD'
      }
    }),
    prisma.genre.upsert({
      where: { slug: 'sci-fi' },
      update: {},
      create: {
        name: 'Sci-Fi',
        slug: 'sci-fi',
        description: 'Science fiction with futuristic technology',
        color: '#98D8C8'
      }
    }),
    prisma.genre.upsert({
      where: { slug: 'supernatural' },
      update: {},
      create: {
        name: 'Supernatural',
        slug: 'supernatural',
        description: 'Anime with supernatural elements and powers',
        color: '#F7DC6F'
      }
    })
  ])

  // Create anime
  const anime = await Promise.all([
    prisma.anime.upsert({
      where: { slug: 'attack-on-titan' },
      update: {},
      create: {
        slug: 'attack-on-titan',
        title: 'Attack on Titan',
        description: 'Humanity fights for survival against the Titans, giant humanoid creatures that devour humans.',
        type: 'tv',
        year: 2013,
        rating: 'R',
        status: 'completed',
        episodes: 25,
        duration: 24,
        season: 'spring',
        coverImage: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400',
        bannerImage: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1200',
        trailerUrl: 'https://www.youtube.com/watch?v=MGRm4IzK1SQ',
        malId: 16498,
        viewCount: 15000000,
        ratingCount: 2500000,
        averageRating: 9.2
      }
    }),
    prisma.anime.upsert({
      where: { slug: 'demon-slayer' },
      update: {},
      create: {
        slug: 'demon-slayer',
        title: 'Demon Slayer',
        description: 'A young boy becomes a demon slayer to save his sister and avenge his family.',
        type: 'tv',
        year: 2019,
        rating: 'R',
        status: 'completed',
        episodes: 26,
        duration: 23,
        season: 'spring',
        coverImage: 'https://images.unsplash.com/photo-1613376023733-0a73315d9b06?w=400',
        bannerImage: 'https://images.unsplash.com/photo-1613376023733-0a73315d9b06?w=1200',
        trailerUrl: 'https://www.youtube.com/watch?v=VQGCKyvzIM4',
        malId: 38000,
        viewCount: 12000000,
        ratingCount: 2000000,
        averageRating: 9.1
      }
    }),
    prisma.anime.upsert({
      where: { slug: 'one-piece' },
      update: {},
      create: {
        slug: 'one-piece',
        title: 'One Piece',
        description: 'Monkey D. Luffy and his pirate crew search for the ultimate treasure, the One Piece.',
        type: 'tv',
        year: 1999,
        rating: 'PG-13',
        status: 'airing',
        episodes: 1000,
        duration: 24,
        season: 'fall',
        coverImage: 'https://images.unsplash.com/photo-1608889476561-6242cfdbf622?w=400',
        bannerImage: 'https://images.unsplash.com/photo-1608889476561-6242cfdbf622?w=1200',
        trailerUrl: 'https://www.youtube.com/watch?v=9ojV7lqgVr0',
        malId: 21,
        viewCount: 20000000,
        ratingCount: 3000000,
        averageRating: 9.5
      }
    }),
    prisma.anime.upsert({
      where: { slug: 'fullmetal-alchemist' },
      update: {},
      create: {
        slug: 'fullmetal-alchemist',
        title: 'Fullmetal Alchemist: Brotherhood',
        description: 'Two brothers use alchemy to search for the Philosopher\'s Stone to restore their bodies.',
        type: 'tv',
        year: 2009,
        rating: 'PG-13',
        status: 'completed',
        episodes: 64,
        duration: 24,
        season: 'spring',
        coverImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400',
        bannerImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200',
        trailerUrl: 'https://www.youtube.com/watch?v=2uq34TeWEdQ',
        malId: 5114,
        viewCount: 8000000,
        ratingCount: 1500000,
        averageRating: 9.3
      }
    }),
    prisma.anime.upsert({
      where: { slug: 'jujutsu-kaisen' },
      update: {},
      create: {
        slug: 'jujutsu-kaisen',
        title: 'Jujutsu Kaisen',
        description: 'A high school student becomes a jujutsu sorcerer to fight cursed spirits.',
        type: 'tv',
        year: 2020,
        rating: 'R',
        status: 'airing',
        episodes: 24,
        duration: 24,
        season: 'fall',
        coverImage: 'https://images.unsplash.com/photo-1613376023733-0a73315d9b06?w=400',
        bannerImage: 'https://images.unsplash.com/photo-1613376023733-0a73315d9b06?w=1200',
        trailerUrl: 'https://www.youtube.com/watch?v=ynUw4V1wNU8',
        malId: 40748,
        viewCount: 10000000,
        ratingCount: 1800000,
        averageRating: 8.9
      }
    }),
    prisma.anime.upsert({
      where: { slug: 'my-hero-academia' },
      update: {},
      create: {
        slug: 'my-hero-academia',
        title: 'My Hero Academia',
        description: 'A boy without superpowers dreams of becoming a hero in a world where most people have quirks.',
        type: 'tv',
        year: 2016,
        rating: 'PG-13',
        status: 'airing',
        episodes: 25,
        duration: 24,
        season: 'spring',
        coverImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400',
        bannerImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200',
        trailerUrl: 'https://www.youtube.com/watch?v=wIb3nnOeves',
        malId: 31964,
        viewCount: 9000000,
        ratingCount: 1600000,
        averageRating: 8.7
      }
    })
  ])

  // Create anime-genre relationships
  const animeGenres = [
    { animeSlug: 'attack-on-titan', genreSlugs: ['action', 'drama', 'supernatural'] },
    { animeSlug: 'demon-slayer', genreSlugs: ['action', 'supernatural', 'drama'] },
    { animeSlug: 'one-piece', genreSlugs: ['action', 'adventure', 'comedy'] },
    { animeSlug: 'fullmetal-alchemist', genreSlugs: ['action', 'adventure', 'drama'] },
    { animeSlug: 'jujutsu-kaisen', genreSlugs: ['action', 'supernatural', 'drama'] },
    { animeSlug: 'my-hero-academia', genreSlugs: ['action', 'comedy', 'supernatural'] }
  ]

  for (const { animeSlug, genreSlugs } of animeGenres) {
    const animeRecord = anime.find(a => a.slug === animeSlug)
    if (!animeRecord) continue

    for (const genreSlug of genreSlugs) {
      const genreRecord = genres.find(g => g.slug === genreSlug)
      if (!genreRecord) continue

      await prisma.animeGenre.upsert({
        where: {
          animeId_genreId: {
            animeId: animeRecord.id,
            genreId: genreRecord.id
          }
        },
        update: {},
        create: {
          animeId: animeRecord.id,
          genreId: genreRecord.id
        }
      })
    }
  }

  console.log('✅ Database seeded successfully!')
  console.log(`📊 Created ${genres.length} genres, ${anime.length} anime`)
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })