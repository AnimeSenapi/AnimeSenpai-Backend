# 🚀 Standalone Import Script - Deployment Guide

## 📋 Overview

This guide will help you deploy and run the `standalone-import.js` script on your server to populate your anime database.

## ⚠️ Important Notes

- **DO NOT run on Vercel/Netlify** - Serverless functions have time limits (10 seconds - 15 minutes)
- **Run on a VPS or local machine** - This script needs to run for hours/days
- **One-time setup** - Once your database is populated, you don't need to run it continuously

---

## 🖥️ Deployment Options

### Option 1: Run on Local Machine (Recommended for Initial Import)

**Best for:** Initial database population, testing

1. **Make sure you have Bun installed:**
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Navigate to backend directory:**
   ```bash
   cd AnimeSenpai-Backend
   ```

3. **Create .env file with production DATABASE_URL:**
   ```bash
   # Copy your production database URL from Vercel
   echo "DATABASE_URL=your_production_database_url_here" > .env
   ```

4. **Install dependencies:**
   ```bash
   bun install
   ```

5. **Generate Prisma client:**
   ```bash
   bunx prisma generate
   ```

6. **Run the import script:**
   ```bash
   bun scripts/standalone-import.js
   ```

7. **Monitor progress:**
   - Stats are saved to `import-state.json` every 5 minutes
   - Health check updates in `import-health.json`
   - Press `Ctrl+C` to stop gracefully

---

### Option 2: Run on VPS (DigitalOcean, AWS EC2, etc.)

**Best for:** Long-running imports, continuous operation

#### Step 1: Connect to Your Server

```bash
ssh root@your-server-ip
```

#### Step 2: Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc  # or ~/.zshrc
```

#### Step 3: Clone/Upload Your Code

**Option A - Clone from GitHub:**
```bash
git clone https://github.com/YourUsername/AnimeSenpai-Backend.git
cd AnimeSenpai-Backend
```

**Option B - Upload via SCP:**
```bash
# On your local machine:
scp -r AnimeSenpai-Backend root@your-server-ip:/root/
```

#### Step 4: Setup Environment

```bash
cd AnimeSenpai-Backend

# Create .env file
nano .env

# Add this line (paste your production DATABASE_URL):
DATABASE_URL="your_production_database_url"

# Save: Ctrl+X, then Y, then Enter
```

#### Step 5: Install Dependencies

```bash
bun install
bunx prisma generate
```

#### Step 6: Run with Screen (Keeps Running After Disconnect)

```bash
# Install screen if not available
apt-get update && apt-get install -y screen

# Start a new screen session
screen -S anime-import

# Run the script
bun scripts/standalone-import.js

# Detach from screen: Press Ctrl+A, then D
# Reattach later: screen -r anime-import
# Kill session: screen -X -S anime-import quit
```

#### Step 7: Monitor Progress

**Check stats file:**
```bash
cat import-state.json
```

**Check health:**
```bash
cat import-health.json
```

**View logs:**
```bash
screen -r anime-import  # Reattach to see live logs
```

---

### Option 3: Run with PM2 (Process Manager)

**Best for:** Automatic restarts, better process management

#### Step 1: Install PM2

```bash
npm install -g pm2
```

#### Step 2: Create PM2 Ecosystem File

Create `ecosystem.config.js` in your backend directory:

```javascript
module.exports = {
  apps: [{
    name: 'anime-import',
    script: 'scripts/standalone-import.js',
    interpreter: 'bun',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
```

#### Step 3: Start with PM2

```bash
pm2 start ecosystem.config.js
```

#### Step 4: Monitor

```bash
# View logs
pm2 logs anime-import

# Check status
pm2 status

# Restart if needed
pm2 restart anime-import

# Stop
pm2 stop anime-import

# Delete from PM2
pm2 delete anime-import
```

---

## 📊 Monitoring & Progress Tracking

### Real-time Stats

The script creates two files:

**1. `import-state.json` - Progress tracking**
```json
{
  "totalFetched": 1234,
  "totalSkipped": 567,
  "totalSaved": 1234,
  "totalErrors": 5,
  "genresCompleted": 15,
  "currentGenre": "Action",
  "runtime": "2h 30m 45s",
  "fetchRate": "90.5"
}
```

**2. `import-health.json` - Heartbeat**
```json
{
  "status": "running",
  "lastUpdate": "2025-01-10T12:34:56.789Z",
  "uptime": "2h 30m 45s",
  "currentGenre": "Action",
  "totalSaved": 1234,
  "pid": 12345
}
```

### Check Progress

```bash
# Watch stats in real-time
watch -n 5 cat import-state.json

# Check if process is still running
ps aux | grep standalone-import

# View last 50 log lines
tail -50 import.log  # if you redirected output
```

---

## 🛑 Stopping the Import

### Graceful Stop (Recommended)

```bash
# If running in terminal: Press Ctrl+C

# If running in screen:
screen -r anime-import  # Reattach
# Then press Ctrl+C

# If running with PM2:
pm2 stop anime-import
```

The script will:
1. Save all pending anime to database
2. Write final stats to files
3. Disconnect from database
4. Exit cleanly

### Force Stop (Not Recommended)

```bash
# Find process ID
ps aux | grep standalone-import

# Kill process
kill -9 <PID>

# Note: You may lose pending anime (max 50)
```

---

## 🔍 Troubleshooting

### Connection Issues

**Problem:** Can't connect to database

**Solution:**
```bash
# Test database connection
bunx prisma studio

# Check DATABASE_URL format
echo $DATABASE_URL

# Common format:
# postgresql://user:password@host:5432/database?sslmode=require
```

### Rate Limit Issues

**Problem:** Getting rate limited by Jikan API

**Solution:** The script handles this automatically, but you can:
- Increase `RATE_LIMIT_DELAY` in the script
- Wait for the script to handle it (adds 60s+ delay)
- Check Jikan API status: https://status.jikan.moe/

### Out of Memory

**Problem:** Process killed due to memory

**Solution:**
```bash
# Reduce BATCH_SIZE in script (line 34)
# Change from 50 to 25 or even 10

# Or increase server memory
# Or use PM2 with max_memory_restart
```

### Script Crashes

**Problem:** Script stopped unexpectedly

**Solution:**
```bash
# Check logs for errors
tail -100 import.log

# Restart - it will skip already imported anime
bun scripts/standalone-import.js

# Use PM2 for auto-restart
pm2 start ecosystem.config.js
```

---

## 📈 Expected Performance

### Import Speed
- **~90 anime per hour** (optimized)
- **~720 anime per 8-hour overnight run**
- **~2,160 anime per day** (24 hours)

### Total Import Time
- **68 genres × 1000 anime = 68,000 anime**
- **~755 hours (~31 days)** at 90 anime/hour
- **Recommendation:** Run continuously for 1-2 weeks

### Database Size
- **~10,000 anime:** ~500 MB
- **~50,000 anime:** ~2.5 GB
- **Plan accordingly for your database tier**

---

## ✅ Post-Import

Once import is complete:

1. **Stop the script:**
   ```bash
   # Press Ctrl+C or
   pm2 stop anime-import
   ```

2. **Verify data:**
   ```bash
   bunx prisma studio
   # Check anime count and data quality
   ```

3. **Optional - Run weekly for new anime:**
   ```bash
   # Set up cron job to run weekly
   crontab -e
   
   # Add this line (runs every Sunday at 2 AM):
   0 2 * * 0 cd /root/AnimeSenpai-Backend && bun scripts/standalone-import.js >> import.log 2>&1
   ```

4. **Clean up files:**
   ```bash
   rm import-state.json
   rm import-health.json
   ```

---

## 🆘 Need Help?

### Quick Commands Reference

```bash
# Start import
bun scripts/standalone-import.js

# Check progress
cat import-state.json

# Stop gracefully
# Press Ctrl+C

# Run in background with screen
screen -S anime-import
bun scripts/standalone-import.js
# Detach: Ctrl+A then D

# Reattach to screen
screen -r anime-import

# Check if running
ps aux | grep standalone-import
```

---

## 📝 Notes

- **Backup your database** before running large imports
- **Monitor disk space** - logs and state files can grow
- **Check API status** at https://jikan.moe/ if issues occur
- **Be patient** - complete import takes weeks
- **Start small** - let it run overnight first to test

---

Good luck with your import! 🚀

