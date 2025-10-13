# 🎌 AnimeSenpai Backend

> **Powerful tRPC API with ML recommendations** — Type-safe backend for AnimeSenpai

[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![tRPC](https://img.shields.io/badge/tRPC-10-2596be)](https://trpc.io/)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748)](https://www.prisma.io/)
[![Bun](https://img.shields.io/badge/Bun-1.2-orange)](https://bun.sh)

**Status:** ✅ Production Ready | **Version:** 1.0.0 | **Database:** 27,745+ anime

---

## 📑 Table of Contents

- [Quick Start](#-quick-start)
- [Features](#-features)
- [Tech Stack](#️-tech-stack)
- [API Documentation](#-api-documentation)
- [Security](#-security)
- [Database](#-database)
- [ML Recommendations](#-ml-recommendations)
- [Deployment](#-deployment)

---

## 🚀 Quick Start

### Prerequisites
- **Bun** 1.2+ — [Install here](https://bun.sh/)
- **PostgreSQL** or **SQLite** for database

### Installation

```bash
# Navigate to backend
cd AnimeSenpai-Backend

# Install dependencies
bun install

# Set up environment
cp env.example .env

# Edit .env with your configuration:
# DATABASE_URL="file:./prisma/dev.db"
# JWT_SECRET=your-secret-key
# JWT_REFRESH_SECRET=your-refresh-secret
# EMAIL_FROM=noreply@animesenpai.app

# Initialize database
bunx prisma migrate dev
bunx prisma db seed

# Start development server
bun dev

# Server running at http://localhost:3003
```

### Initial Setup

```bash
# 1. Check database status
bun scripts/check-db-status.ts

# 2. Import anime data (if needed)
bun scripts/import-anime.ts

# 3. Generate ML embeddings for recommendations
bun scripts/generate-embeddings.ts

# 4. Create test accounts (optional)
bun scripts/create-test-accounts.ts

# 5. Final verification
bun scripts/check-db-status.ts
```

---

## ✨ Features

### 🔐 Authentication & Authorization
- ✅ **Email/Password Auth** - Secure bcrypt hashing (12 rounds)
- ✅ **JWT Tokens** - Access (1h) + Refresh (30d)
- ✅ **Email Verification** - Required for write operations
- ✅ **Password Reset** - Token-based reset flow
- ✅ **Session Management** - Device/IP tracking
- ✅ **Role-Based Access** - User, Tester, Admin roles
- ✅ **Account Lockout** - After failed login attempts
- ✅ **Security Events** - Full audit logging

### 🎬 Anime Features
- ✅ **27,745+ Anime** - Full database from MyAnimeList
- ✅ **Advanced Search** - Filter by genre, year, status, type
- ✅ **Series Grouping** - Automatically groups anime seasons
- ✅ **User Lists** - Track across multiple categories
- ✅ **Ratings** - User ratings with averages
- ✅ **Reviews** - User-generated reviews
- ✅ **Progress Tracking** - Episode count tracking

### 🤖 ML Recommendations
- ✅ **TF-IDF Embeddings** - Semantic similarity from descriptions
- ✅ **Collaborative Filtering** - User similarity matching
- ✅ **Content-Based** - Genre and tag matching
- ✅ **Hybrid System** - Combines all signals
- ✅ **Confidence Scores** - Quality indicators
- ✅ **Diversity Control** - Focused/balanced/exploratory modes

### 👥 Social Features
- ✅ **Follow System** - Follow users, mutual friends
- ✅ **Activity Feed** - See friend ratings and completions
- ✅ **Social Recommendations** - Based on friend activity
- ✅ **User Profiles** - Public profiles with stats

### 🛡️ Admin Panel
- ✅ **User Management** - Role changes, deletions
- ✅ **Anime Management** - Edit anime data
- ✅ **Content Moderation** - Review moderation
- ✅ **Statistics Dashboard** - System stats
- ✅ **Settings** - System configuration
- ✅ **Audit Logging** - All admin actions logged

---

## 🛠️ Tech Stack

### Core
- **[Bun](https://bun.sh)** - Fast JavaScript runtime
- **[TypeScript 5](https://www.typescriptlang.org/)** - Type safety
- **[tRPC](https://trpc.io/)** - Type-safe API framework
- **[Prisma 5](https://www.prisma.io/)** - Database ORM

### Database
- **[PostgreSQL](https://www.postgresql.org/)** (Production) or **SQLite** (Development)
- **Prisma Migrations** - Version-controlled schema changes

### Authentication
- **[jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken)** - JWT tokens
- **[bcryptjs](https://www.npmjs.com/package/bcryptjs)** - Password hashing
- **Email Verification** - Token-based

### External APIs
- **MyAnimeList** - Anime data import
- **Email Service** - Password reset, verification emails

---

## 📡 API Documentation

### Authentication Endpoints

#### `auth.signup`
```typescript
input: {
  email: string
  username: string
  password: string
  gdprConsent: boolean
  dataProcessingConsent: boolean
  marketingConsent?: boolean
}

output: {
  user: User
  accessToken: string
  refreshToken: string
  expiresAt: string
}

rate_limit: 5 attempts per 15 minutes (per IP)
```

#### `auth.signin`
```typescript
input: {
  email: string
  password: string
}

output: {
  user: User
  accessToken: string
  refreshToken: string
  expiresAt: string
}

rate_limit: 5 attempts per 15 minutes (per IP)
```

#### `auth.forgotPassword`
```typescript
input: {
  email: string
}

output: {
  success: boolean
}

rate_limit: 3 attempts per hour (per IP)
```

### Anime Endpoints

#### `anime.getAll`
```typescript
input: {
  page?: number            // Default: 1
  limit?: number          // Default: 20, Max: 100
  search?: string
  genre?: string
  status?: string
  year?: number
  type?: string
  sortBy?: 'title' | 'year' | 'averageRating' | 'viewCount'
  sortOrder?: 'asc' | 'desc'
}

output: {
  anime: Anime[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

cache: 5 minutes
rate_limit: 60 requests/minute (public)
```

#### `anime.getBySlug`
```typescript
input: {
  slug: string
}

output: Anime

cache: 30 minutes
```

#### `anime.getAllSeries`
```typescript
// Returns anime grouped by series
output: {
  series: GroupedSeries[]
}

cache: 5 minutes
```

### User Endpoints

#### `user.addToList`
```typescript
input: {
  animeId: string
  status: 'watching' | 'completed' | 'plan-to-watch' | 'on-hold' | 'dropped'
  isFavorite?: boolean
  progress?: number
  score?: number (1-10)
  notes?: string
}

output: {
  success: boolean
  listItem: UserAnimeList
}

requires: Email verification
rate_limit: 120 requests/minute (authenticated)
```

#### `user.getAnimeList`
```typescript
output: {
  items: AnimeListItem[]
  pagination: Pagination
}

cache: None (user-specific)
```

### Recommendation Endpoints

#### `recommendations.getForYou`
```typescript
input: {
  limit?: number           // Default: 20
  diversityMode?: 'focused' | 'balanced' | 'exploratory'
}

output: {
  recommendations: RecommendedAnime[]
  confidence: number
  reason: string
}

requires: Authentication
cache: 5 minutes per user
```

### Admin Endpoints

#### `admin.getAllUsers`
```typescript
input: {
  page?: number
  limit?: number
  role?: 'user' | 'tester' | 'admin'
}

output: {
  users: User[]
  pagination: Pagination
}

requires: Admin role
rate_limit: 100 requests/minute
audit: All actions logged
```

#### `moderation.getReviews`
```typescript
input: {
  page?: number
  limit?: number
  filter?: 'all' | 'public' | 'hidden' | 'recent'
  search?: string
}

output: {
  reviews: Review[]
  pagination: Pagination
}

requires: Admin role
audit: All moderation actions logged
```

---

## 🛡️ Security

### Rate Limiting

**Configuration (lib/rate-limiter.ts):**

| Endpoint Type | Window | Max Requests | Message |
|---------------|--------|--------------|---------|
| **Auth** | 15 min | 5 | "Too many auth attempts" |
| **Public** | 1 min | 60 | "Too many requests" |
| **Authenticated** | 1 min | 120 | "Too many requests" |
| **Admin** | 1 min | 100 | "Too many admin actions" |
| **Email** | 1 hour | 5 | "Too many email requests" |
| **Password Reset** | 1 hour | 3 | "Too many reset attempts" |

**Usage:**
```typescript
import { checkRateLimit } from './lib/rate-limiter'

// Check rate limit
checkRateLimit(
  identifier,     // User ID or IP
  'auth',         // Rate limit type
  'signin'        // Custom key
)
```

### Authentication Security

**Password Hashing:**
```typescript
// bcrypt with 12 rounds (~250ms to hash)
const hashedPassword = await hashPassword(password)
```

**JWT Tokens:**
```typescript
// Access token (1 hour)
const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' })

// Refresh token (30 days)
const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '30d' })
```

**Session Tracking:**
```typescript
// Track device, IP, user-agent
const sessionInfo = {
  userAgent: req.headers.get('user-agent'),
  ipAddress: req.headers.get('x-forwarded-for'),
  deviceInfo: req.headers.get('user-agent')
}
```

### CSRF Protection

- **JWT in headers** (not cookies) = inherent CSRF protection
- **Custom Authorization header** required
- **Origin validation** via CORS
- **No automatic credentials** sending

### Admin Security

**Audit Logging:**
```typescript
// All admin actions automatically logged
await secureAdminOperation(
  adminId,
  'delete_user',
  async () => {
    // Action code
    // Logs: admin ID, action, target, IP, timestamp
  }
)
```

**Rate Limiting:**
- 100 admin actions per minute
- Prevents compromised admin account damage
- All actions logged for audit trail

---

## 🗄️ Database

### Schema Overview

**User System:**
- `User` - User accounts with auth data
- `UserPreferences` - User settings
- `UserSession` - Active sessions
- `SecurityEvent` - Security audit log
- `Follow` - User follow relationships

**Anime System:**
- `Anime` - Anime metadata (27,745+ entries)
- `Genre` - Anime genres
- `AnimeGenre` - Anime-Genre relationships
- `StreamingPlatform` - Streaming services
- `AnimeStreamingPlatform` - Anime availability

**User Data:**
- `UserAnimeList` - User's anime lists
- `UserAnimeRating` - User ratings
- `UserAnimeReview` - User reviews
- `AnimeEmbedding` - ML embeddings for recommendations

**Social:**
- `ActivityFeed` - User activity stream
- `Notification` - User notifications
- `RecommendationFeedback` - Recommendation dismissals

**System:**
- `FeatureFlag` - Feature flags
- `SystemSettings` - System configuration

### Database Migrations

```bash
# Create migration
bunx prisma migrate dev --name add_new_feature

# Apply migrations
bunx prisma migrate deploy

# Reset database (DEV ONLY)
bunx prisma migrate reset

# Generate Prisma Client
bunx prisma generate
```

### Indexes for Performance

**Optimized queries on:**
- `Anime`: slug, status+averageRating, type+averageRating
- `User`: email, username, role
- `UserAnimeList`: userId+status, animeId+userId
- `UserAnimeRating`: animeId+score

---

## 🤖 ML Recommendations

### TF-IDF Embeddings

**How It Works:**

1. **Text Tokenization** - Anime descriptions → tokens
2. **TF-IDF Calculation** - Term frequency × inverse document frequency
3. **Vector Creation** - 100-dimensional vectors
4. **Similarity** - Cosine similarity between vectors

**Generate Embeddings:**
```bash
# Generate for all 27,745 anime
bun scripts/generate-embeddings.ts

# Takes 5-10 minutes
# Processes in batches of 50
# Safe for large datasets (no memory issues)
```

**Usage:**
```typescript
import { findSimilarAnimeByEmbedding } from './lib/ml-embeddings'

// Find similar anime
const similar = await findSimilarAnimeByEmbedding(
  animeId,
  20 // limit
)
// Returns: [{ animeId, similarity: 0.85 }, ...]
```

### Collaborative Filtering

**User Similarity:**
```typescript
import { findSimilarUsers } from './lib/collaborative-filtering'

// Find users with similar taste
const similarUsers = await findSimilarUsers(userId, 10)

// Get recommendations from similar users
const recommendations = await getCollaborativeRecommendations(userId, 20)
```

### Hybrid Recommendation System

**Combines 3 signals:**
1. **Content-Based** (35%) - Genre, tags, rating
2. **Collaborative** (35%) - Similar user preferences
3. **ML Embeddings** (30%) - Semantic similarity

**Diversity Modes:**
- **Focused** - 90% main genres, 10% discovery
- **Balanced** - 70% main genres, 30% discovery
- **Exploratory** - 50% main genres, 50% discovery

---

## 🛡️ Security Features

### Rate Limiting

**Implementation (lib/rate-limiter.ts):**

```typescript
// Check rate limit
checkRateLimit(identifier, 'auth', 'signin')

// Get status
const status = getRateLimitStatus(identifier, 'auth')
console.log(`${status.remaining}/${status.limit} remaining`)
```

**Auto Cleanup:**
- Expired entries removed every 5 minutes
- In-memory storage (Redis-ready for multi-instance)

### Admin Audit Logging

**All admin actions logged:**
```typescript
// Automatic via secureAdminOperation
await secureAdminOperation(
  adminId,
  'update_role',
  async () => {
    // Your admin logic
    // Automatically logs:
    // - Admin ID
    // - Action type
    // - Target details
    // - IP address
    // - Timestamp
  }
)
```

**Logged Actions:**
- User role changes
- User deletions
- Anime updates/deletions
- Settings changes
- Review moderation

### CORS Configuration

```typescript
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:3006',
  'https://animesenpai.app',
  'https://www.animesenpai.app'
]

// Strict origin validation
const corsOrigin = allowedOrigins.includes(origin) 
  ? origin 
  : allowedOrigins[0]
```

---

## 🗄️ Database Schema

### User Authentication

```prisma
model User {
  id                       String    @id @default(cuid())
  email                    String    @unique
  username                 String    @unique
  password                 String    // bcrypt hashed
  role                     String    @default("user")
  emailVerified            Boolean   @default(false)
  emailVerificationToken   String?
  passwordResetToken       String?
  lastLoginAt              DateTime?
  loginAttempts            Int       @default(0)
  lockedUntil              DateTime?
  
  // Relations
  preferences              UserPreferences?
  sessions                 UserSession[]
  securityEvents           SecurityEvent[]
  reviews                  UserAnimeReview[]
}
```

### Anime Data

```prisma
model Anime {
  id            String    @id @default(cuid())
  title         String
  titleEnglish  String?
  titleJapanese String?
  slug          String    @unique
  type          String    // TV, Movie, OVA, etc.
  status        String    // Airing, Finished, etc.
  episodes      Int?
  year          Int?
  rating        String?   // PG-13, R, etc.
  averageRating Float?    @default(0)
  synopsis      String?
  coverImage    String?
  malId         Int?      @unique
  
  // Relations
  genres        AnimeGenre[]
  reviews       UserAnimeReview[]
}
```

### User Lists

```prisma
model UserAnimeList {
  id          String    @id @default(cuid())
  userId      String
  animeId     String
  status      String    // watching, completed, plan-to-watch
  isFavorite  Boolean   @default(false)
  progress    Int       @default(0)  // Episodes watched
  score       Int?      // 1-10 rating
  notes       String?
  
  @@unique([userId, animeId])
}
```

### ML Embeddings

```prisma
model AnimeEmbedding {
  id               String   @id @default(cuid())
  animeId          String   @unique
  descriptionVector String  // JSON array
  genreVector      String   // JSON array
  combinedVector   String   // JSON array (weighted)
  
  // Regenerated when anime data changes
}
```

---

## 🤖 ML Recommendations

### Generate Embeddings

**Script: scripts/generate-embeddings.ts**

```bash
# Generate for all anime (27,745)
bun scripts/generate-embeddings.ts

# Progress output:
# 📦 Batch 1/555 (50 anime)
# Progress: 50/27745 (0.2%)
# ✅ 50 successful | ⏭️ 0 skipped | ❌ 0 failed
# ⏱️ Rate: 3.2 anime/sec | ETA: 8500s
```

**Features:**
- Processes in batches of 50
- Shows progress with ETA
- Skips existing embeddings
- Handles errors gracefully
- Auto-cleanup of expired entries

### Recommendation Algorithm

**Hybrid Scoring:**

```typescript
// 1. Content-based similarity (35%)
const contentScore = calculateAnimeSimilarity(anime1, anime2)

// 2. Collaborative filtering (35%)
const collaborativeScore = await getCollaborativeRecommendations(userId)

// 3. ML embeddings (30%)
const embeddingScore = await findSimilarAnimeByEmbedding(animeId)

// Combine with confidence
const finalScore = (
  contentScore * 0.35 +
  collaborativeScore * 0.35 +
  embeddingScore * 0.30
)
```

**Confidence Calculation:**
```typescript
// Based on:
// - User rating count (more ratings = higher confidence)
// - Similar user count (more users = better collaborative)
// - Embedding coverage (description quality)

confidence = min(
  (userRatings / 50) * 0.4 +
  (similarUsers / 10) * 0.3 +
  embeddingQuality * 0.3,
  1.0
)
```

---

## 🔧 Development Scripts

### Database Scripts

```bash
# Check database status
bun scripts/check-db-status.ts
# Shows: total anime, embeddings coverage, users, etc.

# Import anime from MyAnimeList
bun scripts/import-anime.ts
# Imports 27,745+ anime with metadata

# Generate ML embeddings
bun scripts/generate-embeddings.ts
# Creates TF-IDF vectors for recommendations

# Create test accounts
bun scripts/create-test-accounts.ts
# Creates: user@test.com, tester@test.com, admin@test.com
```

### Development Commands

```bash
# Start dev server
bun dev                          # Port 3003

# Production build
bun run build                    # Compile TypeScript
bun run start                    # Start production server

# Database
bunx prisma studio              # Database GUI
bunx prisma migrate dev         # Create migration
bunx prisma generate            # Generate Prisma Client

# Code quality
bunx tsc --noEmit              # Type checking
bun run lint                    # Lint code
```

---

## 📊 API Performance

### Caching Strategy

**In-Memory Cache (lib/cache.ts):**

```typescript
import { cache, cacheKeys, cacheTTL } from './lib/cache'

// Cache API responses
const trending = await cache.getOrSet(
  cacheKeys.trending(),
  () => db.anime.findMany({ /* query */ }),
  cacheTTL.medium // 5 minutes
)
```

**Cache TTLs:**
- `short`: 1 minute (real-time data)
- `medium`: 5 minutes (anime lists)
- `long`: 15 minutes (genres, tags)
- `veryLong`: 1 hour (static content)

**Cache Stats:**
```typescript
const stats = cache.stats()
// { size: 150, keys: [...] }
```

### Database Optimization

**Indexes:**
- All foreign keys indexed
- Common queries indexed (slug, email, etc.)
- Composite indexes for multi-column queries
- Sort indexes (averageRating DESC, viewCount DESC)

**Query Optimization:**
- Limit relations (take: 5 for genres)
- Select only needed fields
- Use pagination (max 100 per page)
- Cache results (5-30 minutes)

---

## 🚢 Deployment

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:pass@host:5432/animesenpai"

# JWT Authentication
JWT_SECRET=your-256-bit-secret-key
JWT_REFRESH_SECRET=your-256-bit-refresh-secret
JWT_ACCESS_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=30d

# Email
EMAIL_FROM=noreply@animesenpai.app
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key

# Frontend URL (for CORS)
FRONTEND_URL=https://animesenpai.app

# Security
BCRYPT_ROUNDS=12

# Optional
NODE_ENV=production
```

### Vercel Deployment

**1. Import Project**
- Framework: Other
- Root Directory: `AnimeSenpai-Backend`
- Build Command: `bun run build`
- Output Directory: `dist`
- Install Command: `bun install`

**2. Configure**
```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/trpc/(.*)",
      "dest": "/api/index.ts"
    },
    {
      "src": "/health",
      "dest": "/api/index.ts"
    }
  ]
}
```

**3. Set Environment Variables**
- Add all variables from `.env.example`
- Use production database URL
- Use production email credentials

**4. Deploy**
```bash
vercel --prod
```

### Pre-Deployment Checklist

- [ ] Database migrations applied
- [ ] Anime data imported (27,745+)
- [ ] ML embeddings generated
- [ ] Test accounts deleted
- [ ] Environment variables set
- [ ] CORS origins configured
- [ ] Email service configured
- [ ] Sentry DSN set

---

## 🔍 Monitoring

### Health Check

```bash
# Check API status
curl https://api.animesenpai.app/health

# Response:
{
  "status": "ok",
  "message": "AnimeSenpai API Server is running",
  "timestamp": "2025-10-13T...",
  "version": "1.0.0",
  "environment": "production"
}
```

### Sentry Integration

**Configuration:**
```typescript
// sentry.server.config.ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1, // 10% of transactions
  environment: process.env.NODE_ENV,
})
```

**Error Tracking:**
```typescript
import * as Sentry from '@sentry/node'

try {
  // Your code
} catch (error) {
  Sentry.captureException(error, {
    tags: { feature: 'anime-import' },
    contexts: { anime: { malId } }
  })
  throw error
}
```

### Logging

**Custom Logger (lib/logger.ts):**

```typescript
import { logger } from './lib/logger'

// Different log levels
logger.info('User signed in', { userId })
logger.warn('Slow query detected', { duration: 500 })
logger.error('Failed to import anime', error, { malId })
logger.security('Admin action', { action: 'delete_user' })
```

**Log Context:**
- Request ID
- User ID
- IP address
- User agent
- Timestamp

---

## 📦 Scripts Reference

### Database Management

```bash
# Check status
bun scripts/check-db-status.ts
# Output: Total anime, embeddings, users, reviews

# Import anime
bun scripts/import-anime.ts
# Imports 27,745+ anime from MyAnimeList API
# Takes 1-2 hours

# Generate embeddings
bun scripts/generate-embeddings.ts
# Creates ML vectors for all anime
# Takes 5-10 minutes

# Create test accounts
bun scripts/create-test-accounts.ts
# Creates user/tester/admin accounts
# Password: test123
```

### Utilities

```bash
# Check import status
bun scripts/check-import-status.js
# Shows progress of anime import

# Clear anime data (DANGER)
bun scripts/clear-anime-data.js
# Removes all anime (use before re-import)

# Cleanup adult content
bun scripts/cleanup-adult-content.js
# Filters out hentai/explicit content
```

---

## 🎯 Routers Overview

### Available Routers

```typescript
// src/routers/index.ts
export const appRouter = router({
  auth: authRouter,              // Authentication
  anime: animeRouter,            // Anime data
  user: userRouter,              // User operations
  admin: adminRouter,            // Admin operations
  recommendations: recommendationsRouter, // ML recommendations
  onboarding: onboardingRouter,  // User onboarding
  social: socialRouter,          // Social features
  moderation: moderationRouter,  // Content moderation
})
```

### Router Breakdown

**Auth Router (routers/auth.ts):**
- signup, signin, signout
- forgotPassword, resetPassword
- verifyEmail, resendVerification
- refreshToken, signoutAll

**Anime Router (routers/anime.ts):**
- getAll, getBySlug, getAllSeries
- getTrending, getGenres
- updateViewCount

**User Router (routers/user.ts):**
- getAnimeList, addToList, removeFromList
- rateAnime, getProfile, updateProfile
- getPreferences, updatePreferences
- getStats, getActivity

**Admin Router (routers/admin.ts):**
- getAllUsers, updateUserRole, deleteUser
- getAllAnime, updateAnime, deleteAnime
- getStats, getSettings, saveSettings

**Moderation Router (routers/moderation.ts):**
- getReviews, getStats
- toggleReviewVisibility, deleteReview
- getFlaggedUsers

**Recommendations Router (routers/recommendations.ts):**
- getForYou, dismissRecommendation
- getSimilar, getStats

**Social Router (routers/social.ts):**
- followUser, unfollowUser
- getFollowers, getFollowing
- getSocialCounts, getFriendsWatching

---

## 🧪 Testing

### Manual API Testing

```bash
# Health check
curl http://localhost:3003/health

# Sign up
curl -X POST http://localhost:3003/api/trpc/auth.signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "Test123!",
    "gdprConsent": true,
    "dataProcessingConsent": true
  }'

# Sign in
curl -X POST http://localhost:3003/api/trpc/auth.signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'

# Get anime (authenticated)
curl http://localhost:3003/api/trpc/anime.getAll \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Test Accounts

```bash
# Create test accounts
bun scripts/create-test-accounts.ts

# Accounts created:
# user@test.com (User role)
# tester@test.com (Tester role)
# admin@test.com (Admin role)
# Password: test123
```

**⚠️ DELETE before production deployment!**

---

## 🔧 Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check DATABASE_URL in .env
cat .env | grep DATABASE_URL

# Test connection
bunx prisma db pull
```

**Migration Failed**
```bash
# Reset migrations (DEV ONLY)
bunx prisma migrate reset

# Create fresh migration
bunx prisma migrate dev --name init
```

**Port Already in Use**
```bash
# Kill process on port 3003
lsof -ti:3003 | xargs kill -9

# Or use different port
PORT=3004 bun dev
```

**Embeddings Generation Error**
```bash
# If "response size exceeded 5MB":
# Script already fixed to use pagination
# Just run: bun scripts/generate-embeddings.ts
```

---

## 📚 Useful Commands

```bash
# Development
bun dev                          # Start dev server (port 3003)
PORT=3004 bun dev                # Custom port
bun dev --watch                  # Auto-restart on changes

# Database
bunx prisma studio              # Database GUI (http://localhost:5555)
bunx prisma migrate dev         # Create & apply migration
bunx prisma migrate deploy      # Apply migrations (production)
bunx prisma db seed             # Run seed script
bunx prisma generate            # Regenerate Prisma Client

# Scripts
bun scripts/check-db-status.ts   # Database status
bun scripts/import-anime.ts      # Import anime data
bun scripts/generate-embeddings.ts # Generate ML vectors

# Code Quality
bunx tsc --noEmit               # Type checking
bun run lint                     # Lint code

# Production
bun run build                    # Compile TypeScript
bun run start                    # Start production server
```

---

## 🤝 Contributing

### Code Standards

✅ **TypeScript** - Proper types (no `as any`)  
✅ **tRPC** - Type-safe procedures  
✅ **Prisma** - Use QueryMode.insensitive (not `as any`)  
✅ **Security** - Rate limiting, audit logging  
✅ **Error Handling** - User-friendly messages  
✅ **Logging** - Use logger for all events  
✅ **Comments** - Document complex logic

### Adding New Endpoints

```typescript
// 1. Create in appropriate router
export const myRouter = router({
  myEndpoint: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      // Add rate limiting if needed
      checkRateLimit(ctx.user?.id || ipAddress, 'public')
      
      // Your logic
      const result = await db.myTable.findUnique({ where: { id: input.id } })
      
      // Cache if appropriate
      cache.set(cacheKey, result, cacheTTL.medium)
      
      return result
    })
})

// 2. Add to appRouter (routers/index.ts)
export const appRouter = router({
  // ... existing
  myRouter: myRouter,
})

// 3. Types auto-sync to frontend!
```

### Pull Request Process

1. Fork repository
2. Create feature branch
3. Make changes with proper types
4. Add rate limiting & logging
5. Test thoroughly
6. Run type checking
7. Submit PR

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

---

## 🔗 Related

- **Frontend:** [AnimeSenpai-Frontend](../AnimeSenpai-Frontend)
- **Main README:** [AnimeSenpai](../README.md)

---

<div align="center">

**Built with ❤️ for anime fans worldwide**

*Powerful • Type-Safe • Scalable*

**Status:** ✅ Production Ready | **Updated:** October 13, 2025

**27,745+ anime** • **ML-powered recommendations** • **Full-stack TypeScript**

</div>
