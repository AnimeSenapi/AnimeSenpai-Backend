# ⚠️ Database Migrations Disabled

**IMPORTANT: Database migrations are disabled in this project.**

## Why?

Database schema is managed externally. **Never run migrations** on this database.

## What's Disabled?

The following commands have been disabled:
- `bun run db:migrate` - Returns error
- `bun run db:push` - Returns error

## What Still Works?

- `bun run db:generate` - Generates Prisma Client (safe, read-only)
- `bun run db:studio` - Opens Prisma Studio (safe, read-only)
- `bun run db:seed:*` - Seed scripts (if needed)

## Database Setup

Use `DATABASE_URL="prisma://..."` with Prisma Accelerate:
- Get your Accelerate URL from: https://console.prisma.io/
- Set `DATABASE_URL="prisma://..."` in your `.env`
- The code automatically detects and enables Accelerate

## Schema Changes

If you need to make schema changes:
1. Update `prisma/schema.prisma` locally
2. Generate Prisma Client: `bun run db:generate`
3. **DO NOT** run migrations
4. Schema changes must be managed externally (e.g., through your database admin or deployment process)

