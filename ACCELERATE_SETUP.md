# Prisma Accelerate Setup Guide

## Simple Setup (Recommended)

**Just set `DATABASE_URL` to your Accelerate proxy URL:**

```bash
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=YOUR_API_KEY"
```

That's it! The code automatically:
- ✅ Detects `prisma://` URLs
- ✅ Enables Prisma Accelerate
- ✅ Provides global caching, connection pooling, and edge locations

## Getting Your Accelerate URL

1. Go to https://console.prisma.io/
2. Navigate to your project
3. Get your Accelerate connection string (starts with `prisma://`)
4. Set it in your `.env` file as `DATABASE_URL`

## What You Get

With `DATABASE_URL="prisma://..."`:
- ✨ **Global caching** - Cache queries at edge locations worldwide
- ✨ **Connection pooling** - Efficient database connection management
- ✨ **Edge locations** - Faster queries from anywhere in the world
- ✨ **Automatic detection** - No need for `ENABLE_ACCELERATE` or `PRISMA_ACCELERATE_URL`

## Using cacheStrategy in Queries

Once Accelerate is enabled (via `prisma://` URL), you can use caching in your queries:

```typescript
const genres = await db.genre.findMany({
  cacheStrategy: { ttl: 3600 }, // Cache for 1 hour
})
```

## Verifying Setup

Run the check script to verify your setup:

```bash
bun run check:prisma
```

You should see:
```
✅ ENABLED - Using Accelerate proxy connection (DATABASE_URL contains prisma:// URL)
✨ Benefits: Global caching, connection pooling, edge locations
```

## Alternative Setups

### Option 1: Separate Proxy URL (Advanced)
If you want to keep direct database access available:

```bash
PRISMA_ACCELERATE_URL="prisma://..."  # For queries (via Accelerate)
DATABASE_URL="postgresql://..."       # For migrations/troubleshooting (direct)
```

**Note:** Migrations are disabled in this project. See `NO_MIGRATIONS.md`.

### Option 2: Direct Connection Only (Development)
For local development without Accelerate:

```bash
DATABASE_URL="postgresql://localhost:5432/mydb"
ENABLE_ACCELERATE="true"
```

This provides connection pooling but **no global caching**.

## Troubleshooting

**Q: Accelerate not working?**
- Check that `DATABASE_URL` starts with `prisma://`
- Verify the URL is correct from Prisma Console
- Run `bun run check:prisma` to verify setup

**Q: Can I use both DATABASE_URL and PRISMA_ACCELERATE_URL?**
- Yes, but not necessary. Just use `DATABASE_URL="prisma://..."` for simplicity.

**Q: What about migrations?**
- Migrations are disabled. See `NO_MIGRATIONS.md` for details.
- Schema changes must be managed externally.

