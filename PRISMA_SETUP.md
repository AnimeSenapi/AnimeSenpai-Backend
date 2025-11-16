# Prisma Optimize & Accelerate Setup Guide

## Quick Setup for Development

### 1. Enable Prisma Accelerate (for caching)

Add to your `.env` file:

```env
# Option 1: Use Accelerate with direct connection (recommended for dev)
ENABLE_ACCELERATE="true"

# Option 2: Use Accelerate proxy (requires Prisma Cloud account)
# Get from: https://console.prisma.io/
# PRISMA_ACCELERATE_URL="prisma://accelerate.prisma-data.net/?api_key=YOUR_API_KEY"
```

**Note:** `cacheStrategy` in queries only works when Accelerate is enabled!

### 2. Enable Prisma Optimize (for query analysis)

1. Go to https://console.prisma.io/optimize
2. Sign up / Sign in
3. Create a new project or select existing
4. Get your API key
5. Add to your `.env` file:

```env
OPTIMIZE_API_KEY="your-optimize-api-key-here"
```

### 3. Verify Setup

Run the check script:

```bash
bun run check:prisma
```

Or restart your dev server and look for these messages:

```
✅ Prisma Optimize: ENABLED - Query analysis active
✅ Prisma Accelerate: ENABLED - Connection pooling & caching active
```

### 4. Using Prisma Optimize

**IMPORTANT: Extension Order**
- Optimize MUST be applied BEFORE Accelerate (already configured correctly)
- This is critical for proper query tracking

**Steps to Use:**

1. **Start your dev server:**
   ```bash
   bun dev
   ```
   Look for: `✅ Prisma Optimize: ENABLED - Query analysis active`

2. **Go to the Optimize Dashboard:**
   - Visit: https://optimize.prisma.io
   - Make sure you're logged in with the same account that created the API key

3. **Start Recording:**
   - Click the **"Start recording"** button in the dashboard
   - The button should change to show recording is active
   - **IMPORTANT:** Recording must be active before you make queries!

4. **Execute Queries:**
   - Use your application (make API calls, navigate pages)
   - OR run the test script: `bun run test:optimize`
   - Make sure queries are actually being executed (check server logs)

5. **Stop Recording:**
   - Click **"Stop recording"** in the dashboard

6. **View Results:**
   - Your queries should appear in the dashboard
   - Check query analysis and recommendations

### 5. Verify Caching is Working

When Accelerate is enabled, queries with `cacheStrategy` will be cached:

```typescript
// Example query with caching
const genres = await db.genre.findMany({
  select: { id: true, name: true },
  cacheStrategy: { ttl: 3600 } // 1 hour
})
```

To verify caching:
- Run the same query multiple times
- Check query times in Optimize dashboard
- Cached queries should be faster on subsequent calls

## Troubleshooting

### No data in Optimize dashboard?

1. ✅ Check `OPTIMIZE_API_KEY` is set in `.env`
2. ✅ Restart your dev server after adding the key
3. ✅ Make sure "Start recording" is clicked in Optimize dashboard
4. ✅ Execute some database queries while recording
5. ✅ Check server logs for "Prisma Optimize: ENABLED" message

### No caching happening?

1. ✅ Check `ENABLE_ACCELERATE="true"` is set in `.env` OR `PRISMA_ACCELERATE_URL` is set
2. ✅ Restart your dev server after adding the setting
3. ✅ Check server logs for "Prisma Accelerate: ENABLED" message
4. ✅ Verify queries have `cacheStrategy` option set
5. ✅ Note: Caching only works with Accelerate enabled

### Check current status

```bash
# Check configuration
bun run check:prisma

# Check environment variables
grep -E "OPTIMIZE_API_KEY|ENABLE_ACCELERATE|PRISMA_ACCELERATE_URL" .env
```

## Important Notes

- **Accelerate caching** requires Accelerate to be enabled (via `ENABLE_ACCELERATE` or `PRISMA_ACCELERATE_URL`)
- **Optimize** requires an API key from Prisma Cloud
- Both can work independently or together
- For development, you can use `ENABLE_ACCELERATE="true"` without a Prisma Cloud account
- For production, consider using `PRISMA_ACCELERATE_URL` for better performance

