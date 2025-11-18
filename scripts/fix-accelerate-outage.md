# Fix Prisma Accelerate Outage

## Problem
Prisma Accelerate is currently experiencing degraded operation. See: https://www.prisma-status.com

The error you're seeing:
```
Accelerate was not able to connect to your database. The underlying error is: 
failed to download after 5 attempts: bad status downloading 
https://binaries.prisma.sh/.../query-engine.gz: 500 Internal Server Error
```

## Solution: Temporarily Use Direct PostgreSQL Connection

According to Prisma's status page, **direct PostgreSQL TCP connections are unaffected**. 

### Step 1: Get Your Direct Connection String

1. Go to https://console.prisma.io/
2. Navigate to your project
3. Look for one of these sections:
   - **"Connection String"** or **"Direct Connection"**
   - **"Database"** → **"Connection Info"**
   - **"Settings"** → **"Database"**
4. Copy the PostgreSQL connection string (starts with `postgresql://`)

### Step 2: Update Your .env File

Temporarily comment out the Accelerate URL and add your direct connection:

```bash
# TEMPORARY: Prisma Accelerate outage - using direct connection
# See: https://www.prisma-status.com
# ACCELERATE URL (commented out temporarily):
# DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=..."

# DIRECT POSTGRESQL CONNECTION (temporary workaround):
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
```

### Step 3: Test the Connection

Run the test script:
```bash
bun run test-db-connection.ts
```

### Step 4: Switch Back When Accelerate is Fixed

Once Prisma Accelerate is back online (check https://www.prisma-status.com), switch back to the Accelerate URL for better performance and caching.

## Alternative: Use Local Development Database

If you're developing locally, you can also use a local PostgreSQL instance:

```bash
# Using Docker Compose (if available)
docker-compose up -d postgres

# Then use:
DATABASE_URL="postgresql://animesenpai:animesenpai_password@localhost:5432/animesenpai"
```

