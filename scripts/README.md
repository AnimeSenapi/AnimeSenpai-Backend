# AnimeSenpai Backend Scripts

Utility scripts for database management, data import, and testing.

## 📋 Available Scripts

### 1. **Check Database Status** 📊
Get a quick overview of your database state.

```bash
bun scripts/check-db-status.ts
```

**What it shows:**
- Total anime count
- Anime with trailers
- Currently airing anime
- Genre statistics
- User counts
- Activity metrics (list entries, ratings, reviews)
- Top 5 most viewed anime
- Production readiness check

**When to use:**
- Before importing data
- After running import script
- To verify database health
- Before deploying to production

---

### 2. **Import Anime Data** 🎌
Import anime from Jikan API (MyAnimeList) - one-time batch import.

```bash
bun scripts/import-anime.ts
```

**Features:**
- Fetches from MyAnimeList via Jikan API
- Automatic rate limiting (respects API limits)
- Progress tracking
- Error handling and retries
- Skips existing anime
- Creates genre relationships
- Maps comprehensive metadata

**What it imports:**
- Basic info (title, type, status, episodes)
- Dates (aired, season, year)
- Scores and rankings
- Synopsis and background
- Production info (studios, producers, licensors)
- Genres, themes, demographics
- Images (cover, banner)
- Trailers (YouTube URLs)
- MAL IDs for cross-referencing

**Important notes:**
- Takes 30-60 minutes to import 5,000 anime
- Respects Jikan API rate limits (2.5 req/sec)
- Can be interrupted and resumed
- Automatically skips existing records

**Monitoring progress:**
Run `check-db-status.ts` in another terminal to monitor progress.

---

### 3. **Create Test Accounts** 🧪
Generate test users with different activity levels.

```bash
bun scripts/create-test-accounts.ts
```

**Creates 5 test accounts:**

1. **newbie_tester**
   - Email: `newbie@test.animesenpai.com`
   - Password: `TestPass123!`
   - Role: User
   - Activity: 3 anime, 1 rating

2. **casual_viewer**
   - Email: `casual@test.animesenpai.com`
   - Password: `TestPass123!`
   - Role: User
   - Activity: 25 anime, 15 ratings, 3 reviews

3. **anime_enthusiast**
   - Email: `enthusiast@test.animesenpai.com`
   - Password: `TestPass123!`
   - Role: User
   - Activity: 100 anime, 80 ratings, 20 reviews

4. **unverified_user**
   - Email: `unverified@test.animesenpai.com`
   - Password: `TestPass123!`
   - Role: User
   - Activity: None (email not verified)

5. **test_admin**
   - Email: `admin@test.animesenpai.com`
   - Password: `AdminPass123!`
   - Role: Admin
   - Activity: 50 anime, 40 ratings, 10 reviews

**Use cases:**
- Testing different user states
- QA testing
- Demo accounts for presentations
- Development testing

**⚠️ Important:**
- Delete or disable these accounts in production!
- Passwords are intentionally simple for testing
- Email addresses use `.test` subdomain

---

### 4. **Generate ML Embeddings** 🧠
Generate TF-IDF embeddings for semantic similarity recommendations.

```bash
bun scripts/generate-embeddings.ts
```

**What it does:**
- Generates TF-IDF (Term Frequency-Inverse Document Frequency) vectors
- Combines description embeddings with genre embeddings
- Stores embeddings in database for fast retrieval
- Skips anime that already have embeddings
- Powers semantic similarity recommendations

**Features:**
- Processes anime descriptions and genres
- Creates vector representations for similarity matching
- Automatic caching and updates
- Batch processing with progress tracking
- No external ML APIs required

**When to run:**
- After importing anime data
- When anime descriptions are updated
- To improve recommendation quality
- Before production deployment

**Technical details:**
- Vector dimensions: ~100 (dynamic based on vocabulary)
- Algorithm: TF-IDF with cosine similarity
- Storage: JSON in database
- Performance: ~10-50 anime/sec

**Important notes:**
- Run after importing anime (needs descriptions)
- Takes 2-5 minutes for 5,000 anime
- Can be run multiple times (idempotent)
- Embeddings auto-update when anime data changes

---

## 🚀 Typical Workflow

### Initial Setup
```bash
# 1. Check current database state
bun scripts/check-db-status.ts

# 2. Import anime data (if needed)
bun scripts/import-anime.ts

# 3. Verify import completed
bun scripts/check-db-status.ts

# 4. Generate ML embeddings for recommendations
bun scripts/generate-embeddings.ts

# 5. Create test accounts
bun scripts/create-test-accounts.ts

# 6. Final check
bun scripts/check-db-status.ts
```

### Before Production Deploy
```bash
# 1. Final database check
bun scripts/check-db-status.ts

# 2. Ensure 5,000+ anime
# If not, run import script again

# 3. Verify ML embeddings coverage
bun scripts/generate-embeddings.ts
# Should show >95% coverage

# 4. Verify test accounts exist
# Sign in with each one to verify functionality
```

### Development Testing
```bash
# Create fresh test accounts
bun scripts/create-test-accounts.ts

# Check specific stats
bun scripts/check-db-status.ts
```

---

## 📊 Expected Results

### After Anime Import
```
🎌 Anime
   Total: 5,000+
   With trailers: 2,000+
   Currently airing: 200+
   Completed: 4,500+

🏷️  Genres
   Total: 40+
   Top 5: Action, Comedy, Drama, Romance, Fantasy
```

### After Test Account Creation
```
👥 Users: 5
   Verified: 4

📝 User Activity
   List entries: 178
   Ratings: 136
   Reviews: 33
```

---

## ⚙️ Configuration

### Rate Limiting (import-anime.ts)
```typescript
const RATE_LIMIT_MS = 400      // 400ms between requests
const BATCH_SIZE = 25          // Process 25 at a time
const MAX_RETRIES = 3          // Retry failed requests 3 times
```

### Test Account Data (create-test-accounts.ts)
Modify `TEST_ACCOUNTS` array to change:
- Username/email
- Passwords
- Activity levels (list/rating/review counts)

---

## 🐛 Troubleshooting

### Import Script Issues

**Problem:** "Rate limited" messages
- **Solution:** This is normal. The script will automatically retry.

**Problem:** Import seems stuck
- **Solution:** Check another terminal with `check-db-status.ts` to see progress. The script processes slowly to respect API limits.

**Problem:** Many "404" errors
- **Solution:** Normal. Not all MAL IDs have anime data. The script will continue.

**Problem:** Script crashes
- **Solution:** Run it again. It automatically skips existing anime and resumes.

### Test Account Issues

**Problem:** "User already exists"
- **Solution:** The script skips existing accounts. Drop the users table or manually delete them if you need fresh accounts.

**Problem:** No anime for test accounts
- **Solution:** Run the import script first. Test accounts need existing anime to add to lists.

### Database Connection Issues

**Problem:** "Can't connect to database"
- **Solution:** Check your `.env` file has correct `DATABASE_URL`

**Problem:** "Schema not in sync"
- **Solution:** Run `bunx prisma migrate deploy`

---

## 📝 Notes

### Anime Import
- Jikan API is free but rate-limited
- Expect ~2-3 anime per second
- 5,000 anime ≈ 30-45 minutes
- Can be run multiple times (idempotent)
- Creates both `Anime` and `AnimeGenre` records

### Test Accounts
- Passwords are for testing only
- Use strong passwords in production
- Email verification is bypassed for test accounts
- Activity data is randomized but realistic

### Database Status
- Read-only operation (safe to run anytime)
- No database modifications
- Fast execution (< 5 seconds)

---

## 🔗 Related Files

- `../prisma/schema.prisma` - Database schema
- `../prisma/seed.ts` - Initial seed data (6 anime)
- `../../PRODUCTION-CHECKLIST.md` - Pre-launch checklist

---

## 💡 Tips

1. **Before Importing:**
   - Ensure you have stable internet
   - Don't interrupt the script if possible
   - Monitor with `check-db-status.ts`

2. **Testing:**
   - Use different test accounts for different scenarios
   - Test email verification with `unverified_user`
   - Test admin features with `test_admin`

3. **Production:**
   - Import anime before creating test accounts
   - Delete test accounts before public launch
   - Verify all data with `check-db-status.ts`

---

Need help? Check the main `README.md` or open an issue!

