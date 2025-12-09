# AnimeSenpai Backend

Type-safe tRPC API powered by Bun, TypeScript, and Prisma.

## Table of Contents

- [Quick Start](#quick-start)
- [Requirements](#requirements)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Development](#development)
- [API Endpoints](#api-endpoints)
- [Scripts](#scripts)
- [Testing](#testing)
- [Deployment](#deployment)
- [Monitoring & Observability](#monitoring--observability)
- [Security](#security)
- [Project Structure](#project-structure)
- [Documentation](#documentation)

---

## Quick Start

### Clean Development Mode (Recommended)
For a cleaner terminal experience with essential logs only:

```bash
# From repo root
cd AnimeSenpai-Backend
bun install
cp env.example .env

# Start with clean logging
bun run dev:clean
# → http://localhost:3005
```

### Full Debug Mode
For comprehensive debugging with all log categories:

```bash
bun dev
# → http://localhost:3005
```

### First-Time Setup

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Configure environment:**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Set up database:**
   - See [Database Setup](#database-setup) section
   - For development, you can use SQLite or PostgreSQL with Prisma Accelerate

4. **Generate Prisma client:**
   ```bash
   bun run db:generate
   ```

5. **Start development server:**
   ```bash
   bun run dev:clean  # Clean mode
   # or
   bun dev            # Full debug mode
   ```

---

## Requirements

- **Bun 1.0+** (required - Node.js not needed)
- **PostgreSQL** (production) or **SQLite** (development)
- **Prisma Accelerate** (recommended for production)
- **Prisma Optimize** (optional, for query analysis)

---

## Environment Variables

Create `.env` from `env.example` and configure the following:

### Database Configuration

```env
# Recommended: Use Prisma Accelerate proxy URL
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=YOUR_API_KEY"

# Alternative: Direct PostgreSQL connection
# DATABASE_URL="postgresql://user:password@host:5432/database"

# Prisma Optimize (optional - for query analysis)
OPTIMIZE_API_KEY="your-optimize-api-key-here"
```

### Authentication & Security

```env
JWT_SECRET="your-super-secret-jwt-key-here-change-this-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-here-change-this-in-production"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
SESSION_SECRET="your-session-secret-here-change-this-in-production"
BCRYPT_ROUNDS=12
```

### API Configuration

```env
API_PORT=3005
NODE_ENV="development"
FRONTEND_URL="http://localhost:3000"
CORS_ORIGINS="http://localhost:3000,https://animesenpai.app"
```

### Email Configuration (Resend)

```env
RESEND_API_KEY="re_your_resend_api_key_here"
EMAIL_FROM="noreply@animesenpai.app"
EMAIL_FROM_NAME="AnimeSenpai"
```

### Rate Limiting

```env
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Logging Configuration

```env
LOG_LEVEL="info"                    # error, warn, info, debug
QUIET_MODE="false"
ENABLE_REQUEST_LOGGING="true"
ENABLE_PERFORMANCE_LOGGING="false"
ENABLE_SECURITY_LOGGING="true"
ENABLE_CACHE_LOGGING="false"
ENABLE_DATABASE_LOGGING="false"
ENABLE_MONITORING_LOGGING="false"
ENABLE_SYSTEM_LOGGING="true"
```

### Cache Configuration

```env
CACHE_MAX_SIZE="10000"
CACHE_DEFAULT_TTL="1800"
CACHE_CLEANUP_INTERVAL="300000"
CACHE_MAX_MEMORY_MB="100"
```

### GDPR & Privacy

```env
PRIVACY_POLICY_URL="https://animesenpai.app/privacy"
TERMS_OF_SERVICE_URL="https://animesenpai.app/terms"
DATA_RETENTION_DAYS=365
```

### Vercel Configuration

```env
VERCEL_URL=""  # Set automatically by Vercel
```

**Important:** Keep secrets out of git. Use your deployment's secret manager in production.

---

## Database Setup

### Prisma Accelerate (Recommended)

**Simple Setup:** Just set `DATABASE_URL` to your Accelerate proxy URL:

```env
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=YOUR_API_KEY"
```

The code automatically detects `prisma://` URLs and enables Accelerate with:
- ✨ Global caching
- ✨ Connection pooling
- ✨ Edge locations

**Getting Your Accelerate URL:**
1. Go to https://console.prisma.io/
2. Navigate to your project
3. Get your Accelerate connection string (starts with `prisma://`)
4. Set it in your `.env` file as `DATABASE_URL`

**Using Cache Strategy:**
Once Accelerate is enabled, you can use caching in queries:

```typescript
const genres = await db.genre.findMany({
  cacheStrategy: { ttl: 3600 }, // Cache for 1 hour
})
```

**Verify Setup:**
```bash
bun run check:prisma
```

See `ACCELERATE_SETUP.md` for detailed setup instructions.

### Prisma Optimize (Optional)

Prisma Optimize helps analyze and optimize your Prisma queries:

1. Go to https://console.prisma.io/optimize
2. Sign up / Sign in
3. Create a new project or select existing
4. Get your API key
5. Add to `.env`:
   ```env
   OPTIMIZE_API_KEY="your-optimize-api-key-here"
   ```

**Using Optimize:**
1. Start your dev server: `bun dev`
2. Go to https://optimize.prisma.io
3. Click **"Start Recording"** (important: do this BEFORE executing queries)
4. Execute queries (use your app or run `bun run test:optimize`)
5. Click **"Stop Recording"**
6. View results in the dashboard

See `ACCELERATE_SETUP.md` and `OPTIMIZE_TROUBLESHOOTING.md` for detailed instructions.

### Database Migrations

**⚠️ IMPORTANT: Database migrations are disabled in this project.**

- Schema is managed externally
- **DO NOT** run `prisma migrate` or `prisma db push`
- See `NO_MIGRATIONS.md` for details

**Safe Commands:**
```bash
# Generate Prisma Client (safe, read-only)
bun run db:generate

# Open Prisma Studio (safe, read-only)
bun run db:studio

# Seed database (if needed)
bun run db:seed
bun run db:seed:genres
bun run db:seed:all-achievements
```

### Database Schema

The database uses PostgreSQL with multiple schemas:
- `auth` - Authentication and authorization
- `content` - Anime, reviews, recommendations
- `user_data` - User preferences, lists, achievements

See `prisma/schema.prisma` for the complete schema definition.

---

## Development

### Development Server

```bash
# Clean mode (recommended - less verbose)
bun run dev:clean

# Full debug mode (all logs)
bun dev
```

The server automatically finds an available port starting from `API_PORT` (default: 3005):
- Tries: 3005, 3004, 3003, 3002, 3001...
- Default final port: Usually 3005

### Build & Production

```bash
# Build for production
bun run build

# Start production build
bun run start
```

### Code Quality

```bash
# Type checking
bun run type-check

# Linting
bun run lint

# Format code
bun run fmt

# Check formatting
bun run fmt:check
```

### Common Development Tasks

```bash
# Make a user an owner
bun run scripts/make-user-owner.ts <user-id>

# Generate recommendation embeddings
bun run scripts/generate-embeddings.ts

# Create test accounts (dev only)
bun run scripts/create-test-accounts.ts

# Check database status
bun run scripts/check-db-status.ts

# Validate environment variables
bun run validate:env
```

---

## API Endpoints

### tRPC Router Endpoints

The API uses tRPC for type-safe endpoints. All endpoints are prefixed with `/api/trpc/`.

**Available Routers:**
- `auth` - Authentication (signin, signup, refresh token, 2FA)
- `user` - User management and profiles
- `anime` - Anime data and search
- `recommendations` - AI-powered recommendations
- `achievements` / `achievements-v2` - Achievement system
- `leaderboards` - User rankings and leaderboards
- `activity` - User activity feed
- `social` - Social features (follows, friends)
- `messaging` - Direct messaging
- `notifications` - User notifications
- `calendar` - Anime release calendar
- `studio` - Studio information
- `review-interactions` - Review likes/comments
- `list-tools` - User list management
- `onboarding` - User onboarding flow
- `admin` - Admin operations
- `moderation` - Content moderation
- `analytics` - Analytics and metrics
- `role-management` - Role and permission management
- `system-settings` - System configuration
- `gdpr` - GDPR compliance features
- `privacy` - Privacy settings
- `safety` - Safety and security features
- `two-factor` - Two-factor authentication
- `monitoring` - System monitoring
- `app-status` - Application status
- `health` - Health checks

### REST Endpoints

- `GET /health` - Health check endpoint
- `GET /ready` - Readiness probe (Kubernetes)
- `GET /live` - Liveness probe (Kubernetes)
- `GET /metrics` - Performance metrics
- `GET /monitoring` - Monitoring dashboard data

### API Entry Points

- **Serverless handler:** `api/index.ts` (for Vercel)
- **Standalone server:** `src/index.ts` (for Docker/local)

---

## Scripts

### Database Scripts

```bash
# Generate Prisma Client
bun run db:generate

# Open Prisma Studio
bun run db:studio

# Seed database
bun run db:seed
bun run db:seed:genres
bun run db:seed:achievements
bun run db:seed:tier-achievements
bun run db:seed:gamified-achievements
bun run db:seed:all-achievements

# Clear achievements
bun run db:clear:achievements
```

### Testing Scripts

```bash
# Run all tests
bun test

# Run specific test suites
bun run test:unit
bun run test:integration
bun run test:load

# Run with coverage
bun run test:coverage

# Check coverage thresholds
bun run coverage:check
```

### Utility Scripts

```bash
# Health check
bun run health-check

# View metrics
bun run metrics

# View monitoring dashboard
bun run monitoring

# Check Prisma extensions
bun run check:prisma

# Test Optimize
bun run test:optimize
bun run verify:optimize

# Send email previews
bun run email:preview

# Validate environment
bun run validate:env
```

### Performance & Load Testing

```bash
# Performance test
bun run performance-test

# Load test (requires k6)
bun run load-test
bun run load-test:recommendations
```

**Note:** More utilities exist in `scripts/`. Avoid destructive scripts unless you know what they do.

---

## Testing

### Running Tests

```bash
# All tests
bun test

# Watch mode
bun run test:watch

# With coverage
bun run test:coverage

# Specific suites
bun run test:unit
bun run test:integration
bun run test:load
```

### Test Structure

- `src/tests/` - Unit and integration tests
- `tests/` - Additional test files
- `tests/load/` - Load testing scripts (k6)

### Coverage

Coverage thresholds are enforced. Check coverage:

```bash
bun run test:coverage
bun run coverage:check
```

---

## Deployment

### Docker

**Build:**
```bash
docker build -t animesenpai-backend .
```

**Run:**
```bash
docker run -p 3005:3005 \
  -e DATABASE_URL="..." \
  -e JWT_SECRET="..." \
  animesenpai-backend
```

**Docker Compose:**
```bash
# From repo root
docker compose up --build
```

The Dockerfile uses multi-stage builds and runs as a non-root user for security.

### Vercel

The backend is configured for Vercel serverless deployment:

- Configuration: `vercel.json`
- Handler: `api/index.ts`
- Routes: `/api/trpc/*` → `/api`

**Deploy:**
```bash
vercel --prod
```

### Kubernetes

Kubernetes manifests are available in `k8s/`:
- `deployment.yaml` - Deployment configuration
- `ingress.yaml` - Ingress configuration
- `namespace.yaml` - Namespace setup

**Health Checks:**
- Liveness: `GET /live`
- Readiness: `GET /ready`
- Health: `GET /health`

**Sync Jobs (for Cron):**
- Anime Data Sync: `POST /api/sync/anime-data` (Daily at 2:00 AM UTC)
- Calendar Sync: `POST /api/sync/calendar` (Daily at 3:00 AM UTC)

**Maintenance Jobs (for Cron):**
- Session Cleanup: `POST /api/jobs/session-cleanup` (Daily at 4:00 AM UTC)
- Token Cleanup: `POST /api/jobs/token-cleanup` (Daily at 5:00 AM UTC)
- Trending Update: `POST /api/jobs/trending-update` (Hourly)

All endpoints require authentication via:
- Vercel Cron Jobs (automatically authenticated via `x-vercel-cron` header)
- Bearer token: `Authorization: Bearer <SYNC_SECRET_TOKEN>`
- Query parameter: `?token=<SYNC_SECRET_TOKEN>`

---

## Monitoring & Observability

### Health Checks

```bash
# Health check
curl http://localhost:3005/health

# Readiness probe
curl http://localhost:3005/ready

# Liveness probe
curl http://localhost:3005/live
```

### Metrics

```bash
# View metrics
curl http://localhost:3005/metrics | jq

# Or use npm script
bun run metrics
```

Metrics include:
- Server stats (requests, errors, response times)
- Database stats (queries, slow queries)
- Cache stats (hit rate, memory usage)
- Rate limit stats
- Background job stats
- Slow requests tracking

### Monitoring Dashboard

```bash
# View monitoring data
curl http://localhost:3005/monitoring | jq

# Or use npm script
bun run monitoring
```

### Sync Jobs

The backend includes scheduled sync jobs for anime data and calendar information. On serverless platforms (like Vercel), these jobs need to be triggered via API endpoints.

**For Vercel Deployments:**

The `vercel.json` file includes cron job configuration:
- Anime Data Sync: Runs daily at 2:00 AM UTC
- Calendar Sync: Runs daily at 3:00 AM UTC
- Session Cleanup: Runs daily at 4:00 AM UTC
- Token Cleanup: Runs daily at 5:00 AM UTC
- Trending Update: Runs hourly

Vercel Cron Jobs automatically authenticate via the `x-vercel-cron` header.

**For Railway Deployments:**

Railway doesn't have built-in cron jobs, but you can use:

1. **GitHub Actions (Recommended):**
   Create `.github/workflows/sync-jobs.yml`:
   ```yaml
   name: Sync Jobs
   on:
     schedule:
       - cron: '0 2 * * *'  # Anime data sync at 2 AM UTC
       - cron: '0 3 * * *'  # Calendar sync at 3 AM UTC
   jobs:
     sync:
       runs-on: ubuntu-latest
       steps:
         - name: Trigger Anime Data Sync
           if: github.event.schedule == '0 2 * * *'
           run: |
             curl -X POST ${{ secrets.BACKEND_URL }}/api/sync/anime-data \
               -H "Authorization: Bearer ${{ secrets.SYNC_SECRET_TOKEN }}"
         - name: Trigger Calendar Sync
           if: github.event.schedule == '0 3 * * *'
           run: |
             curl -X POST ${{ secrets.BACKEND_URL }}/api/sync/calendar \
               -H "Authorization: Bearer ${{ secrets.SYNC_SECRET_TOKEN }}"
   ```

2. **External Cron Services:**
   - [cron-job.org](https://cron-job.org)
   - [EasyCron](https://www.easycron.com)
   - [Cronitor](https://cronitor.io)

   Example setup:
   ```bash
   # Anime Data Sync (daily at 2:00 AM UTC)
   curl -X POST https://your-backend-url.com/api/sync/anime-data \
     -H "Authorization: Bearer YOUR_SYNC_SECRET_TOKEN"

   # Calendar Sync (daily at 3:00 AM UTC)
   curl -X POST https://your-backend-url.com/api/sync/calendar \
     -H "Authorization: Bearer YOUR_SYNC_SECRET_TOKEN"

   # Session Cleanup (daily at 4:00 AM UTC)
   curl -X POST https://your-backend-url.com/api/jobs/session-cleanup \
     -H "Authorization: Bearer YOUR_SYNC_SECRET_TOKEN"

   # Token Cleanup (daily at 5:00 AM UTC)
   curl -X POST https://your-backend-url.com/api/jobs/token-cleanup \
     -H "Authorization: Bearer YOUR_SYNC_SECRET_TOKEN"

   # Trending Update (hourly)
   curl -X POST https://your-backend-url.com/api/jobs/trending-update \
     -H "Authorization: Bearer YOUR_SYNC_SECRET_TOKEN"
   ```

**Environment Variable:**
Set `SYNC_SECRET_TOKEN` in your environment variables (Railway, Vercel, etc.) for external cron job authentication.

**Testing Endpoints:**
```bash
# Test anime data sync
curl -X POST http://localhost:3005/api/sync/anime-data \
  -H "Authorization: Bearer your-sync-secret-token"

# Test calendar sync
curl -X POST http://localhost:3005/api/sync/calendar \
  -H "Authorization: Bearer your-sync-secret-token"

# Test session cleanup
curl -X POST http://localhost:3005/api/jobs/session-cleanup \
  -H "Authorization: Bearer your-sync-secret-token"

# Test token cleanup
curl -X POST http://localhost:3005/api/jobs/token-cleanup \
  -H "Authorization: Bearer your-sync-secret-token"

# Test trending update
curl -X POST http://localhost:3005/api/jobs/trending-update \
  -H "Authorization: Bearer your-sync-secret-token"
```

### Logging

The backend uses a comprehensive logging system with multiple categories:

- **REQUEST** - HTTP request/response logging
- **PERFORMANCE** - Performance metrics
- **SECURITY** - Security events
- **CACHE** - Cache operations
- **DATABASE** - Database queries
- **MONITORING** - System monitoring
- **AUTH** - Authentication events
- **API** - API endpoint calls
- **ERROR** - Error logging (always enabled)
- **SYSTEM** - System-level events

**Configuration:** See `docs/LOGGING.md` for detailed logging configuration.

**Usage:**
```typescript
import { logger } from './lib/logger'

logger.request('User login attempt', context, { userId: '123' })
logger.error('Database error', error, context)
logger.performance('Query completed', context, { duration: 150 })
```

### Sentry Integration

Error tracking with Sentry:

```typescript
import * as Sentry from '@sentry/node'

try {
  // code
} catch (error) {
  Sentry.captureException(error)
  throw error
}
```

---

## Security

### Security Features

- **CORS** - Strict origin allowlist
- **Rate Limiting** - IP-based rate limiting
- **CSRF Protection** - Double-submit cookie pattern
- **Security Headers** - OWASP-recommended headers
  - Content-Security-Policy
  - X-Frame-Options
  - Strict-Transport-Security
  - X-Content-Type-Options
  - And more...
- **Request Analysis** - Security manager analyzes requests
- **Authentication** - JWT-based auth with refresh tokens
- **Password Security** - bcrypt with configurable rounds
- **2FA Support** - Two-factor authentication
- **Account Lockout** - Protection against brute force

### Security Headers

All responses include comprehensive security headers:
- Content-Security-Policy
- X-Frame-Options: DENY
- Strict-Transport-Security
- X-Content-Type-Options: nosniff
- Referrer-Policy
- Permissions-Policy
- And more...

### Rate Limiting

- Window: Configurable (default: 15 minutes)
- Max requests: Configurable (default: 100)
- IP-based tracking
- Headers included in responses

---

## Project Structure

```
AnimeSenpai-Backend/
├── api/                    # Serverless handler (Vercel)
│   └── index.ts
├── src/                    # Core application code
│   ├── index.ts           # Standalone server entrypoint
│   ├── routers/           # tRPC routers
│   │   ├── auth.ts
│   │   ├── user.ts
│   │   ├── anime.ts
│   │   └── ...
│   ├── lib/               # Services, utilities, data access
│   │   ├── db.ts         # Prisma client
│   │   ├── logger.ts     # Logging system
│   │   ├── auth.ts       # Authentication
│   │   ├── cache.ts      # Caching system
│   │   └── ...
│   ├── tests/            # Test suites
│   │   ├── integration/
│   │   └── load/
│   └── types/            # TypeScript type definitions
├── prisma/               # Database schema and migrations
│   ├── schema.prisma    # Prisma schema
│   ├── dev.db          # SQLite dev database
│   └── seed.ts         # Database seeding
├── scripts/             # Operational scripts
│   ├── check-db-status.ts
│   ├── generate-embeddings.ts
│   ├── create-test-accounts.ts
│   └── ...
├── tests/               # Additional tests
│   └── load/           # Load testing (k6)
├── docs/               # Documentation
│   └── LOGGING.md
├── k8s/                # Kubernetes manifests
├── Dockerfile          # Docker configuration
├── vercel.json         # Vercel configuration
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
└── env.example         # Environment variable template
```

---

## Documentation

### Quick Reference

- **[QUICK_START.md](QUICK_START.md)** - Quick start guide with common tasks
- **[PRISMA_SETUP.md](PRISMA_SETUP.md)** - Prisma setup instructions
- **[ACCELERATE_SETUP.md](ACCELERATE_SETUP.md)** - Prisma Accelerate setup
- **[NO_MIGRATIONS.md](NO_MIGRATIONS.md)** - Why migrations are disabled
- **[OPTIMIZE_TROUBLESHOOTING.md](OPTIMIZE_TROUBLESHOOTING.md)** - Optimize troubleshooting
- **[docs/LOGGING.md](docs/LOGGING.md)** - Detailed logging configuration

### Related Projects

- **Frontend:** `../AnimeSenpai-Frontend`
- **Root README:** `../README.md`

---

## Important Notes

- ⚠️ **Use Bun for all commands** (not npm/pnpm/yarn)
- ⚠️ **Backend runs on port 3005**; frontend runs on 3000
- ⚠️ **Database migrations are disabled** - see `NO_MIGRATIONS.md`
- ⚠️ **Be careful with scripts** that mutate data - when in doubt, ask first
- ⚠️ **Never commit secrets** - use environment variables and secret managers

---

## Support

For issues or questions:

1. Check this README
2. Review the documentation files listed above
3. Check terminal logs
4. Review server health endpoint: `http://localhost:3005/health`
5. Check monitoring dashboard: `http://localhost:3005/monitoring`

---

## License

See root repository for license information.
