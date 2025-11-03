# AnimeSenpai Backend - Quick Start

## 🚀 Running the Backend

### Clean Development Mode (Recommended)
For a clean terminal experience with essential logs only:

```bash
bun run dev:clean
```

This starts the server with:
- ✅ Essential logs (errors, warnings, security events)
- ❌ No verbose debug output
- ❌ No system/monitoring spam

### Full Debug Mode
For comprehensive debugging with all log categories:

```bash
bun run dev
```

This shows:
- ✅ All system logs
- ✅ Monitoring and health checks
- ✅ Cache operations
- ✅ Database queries
- ✅ Performance metrics

## 🎯 Common Tasks

### Make a User an Owner
```bash
bun run scripts/make-user-owner.ts <user-id>
```

### Run Tests
```bash
# All tests
bun test

# Unit tests only
bun run test:unit

# Integration tests only
bun run test:integration

# Load tests
bun run test:load

# With coverage
bun run test:coverage
```

### Database Operations
```bash
# Generate Prisma client
bun run db:generate

# Open Prisma Studio
bun run db:studio

# Run migrations
bun run db:migrate

# Seed database
bun run db:seed
bun run db:seed:genres
bun run db:seed:all-achievements
```

### Health & Monitoring
```bash
# Check server health
bun run health-check

# View metrics
bun run metrics

# View monitoring dashboard
bun run monitoring
```

## 📝 Configuration

### Environment Variables

Create a `.env` file based on `env.example`:

```bash
cp env.example .env
```

Key settings for clean logging:

```env
# Logging Configuration
LOG_LEVEL="info"                    # error, warn, info, debug
ENABLE_SYSTEM_LOGGING="false"       # Disable system startup logs
ENABLE_REQUEST_LOGGING="true"       # Show API requests
ENABLE_PERFORMANCE_LOGGING="false"  # Hide performance logs
ENABLE_SECURITY_LOGGING="true"      # Show security events
ENABLE_CACHE_LOGGING="false"        # Hide cache operations
ENABLE_DATABASE_LOGGING="false"     # Hide database queries
ENABLE_MONITORING_LOGGING="false"   # Hide monitoring logs
```

### Port Configuration

The backend automatically finds an available port starting from 3001:

- Starts at: `API_PORT` env var or 3001
- Tries: 3001, 3002, 3003, 3004, 3005...
- Default final port: Usually 3004 or 3005

## 📚 Documentation

- [Logging Configuration](docs/LOGGING.md) - Detailed logging setup
- [Database Schema](prisma/schema.prisma) - Database structure
- [API Routes](src/routers/) - tRPC endpoints

## 🛠️ Troubleshooting

### Too Much Output
Use `bun run dev:clean` instead of `bun run dev`

### Port Already in Use
The server automatically tries multiple ports. Check the startup log.

### Database Connection Issues
Make sure `.env` has correct `DATABASE_URL` set.

### Prisma Warnings
Run `bun run postinstall` to regenerate Prisma client.

## 📞 Support

For issues or questions, check:
1. This README
2. [Logging Docs](docs/LOGGING.md)
3. Terminal logs
4. Server health endpoint: `http://localhost:3004/health`
