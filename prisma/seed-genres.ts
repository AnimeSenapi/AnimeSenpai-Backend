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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const GENRES: Array<{ name: string; description?: string; color?: string }> = [
  { name: "Action" },
  { name: "Adventure" },
  { name: "Comedy" },
  { name: "Drama" },
  { name: "Fantasy" },
  { name: "Horror" },
  { name: "Mystery" },
  { name: "Psychological" },
  { name: "Romance" },
  { name: "Sci-Fi" },
  { name: "Slice of Life" },
  { name: "Sports" },
  { name: "Supernatural" },
  { name: "Thriller" },
  { name: "Mecha" },
  { name: "Music" },
  { name: "Historical" },
  { name: "Military" },
  { name: "School" },
  { name: "Seinen" },
  { name: "Shounen" },
  { name: "Shoujo" },
  { name: "Josei" },
  { name: "Isekai" },
];

async function main() {
  console.log("Seeding genres...");

  for (const g of GENRES) {
    const slug = slugify(g.name);

    await prisma.genre.upsert({
      where: { slug },
      update: {
        name: g.name,
        description: g.description ?? undefined,
        color: g.color ?? undefined,
      },
      create: {
        name: g.name,
        slug,
        description: g.description ?? undefined,
        color: g.color ?? undefined,
      },
    });

    console.log(`Upserted genre: ${g.name} (${slug})`);
  }

  const count = await prisma.genre.count();
  console.log(`Done. Total genres in database: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


