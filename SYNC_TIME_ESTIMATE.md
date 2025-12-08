# Daily Sync Time Estimate

## Overview
This document estimates how long the daily anime data sync and calendar sync will take to complete.

## Sync Components

### 1. Daily Anime Data Sync (`syncDailyAnimeData`)
**Runs:** Once per day (24 hour interval)

**Fetches:**
- Current season anime (seasons/now) - all pages (~50-100 anime, 2-4 pages)
- Upcoming season anime (seasons/upcoming) - all pages (~50-100 anime, 2-4 pages)
- Top anime (top/anime) - first 3 pages (75 anime)

**Processing:**
- Combines to unique set: ~150-200 unique anime
- For each anime:
  - 1 API call to fetch full details (`/anime/{id}`)
  - Apply filters
  - Database upsert (create or update)
  - Rate limit: 1200ms between requests

**Time Estimate:**
- API calls: ~150-200 anime × 1.2 seconds = 180-240 seconds
- Database operations: ~150-200 operations × ~0.1 seconds = 15-20 seconds
- **Total: ~3-4 minutes**

### 2. Calendar Sync (`syncAiringAnimeCalendarData`)
**Runs:** Once per day (24 hour interval)

**Fetches:**
- Current season (seasons/now) - all pages (~50-100 anime)
- Weekly schedules (schedules) - 7 days (~100-150 unique anime)
- Upcoming season (seasons/upcoming) - all pages (~50-100 anime)

**Processing:**
- Combines to unique set: ~150-200 unique anime
- For existing anime:
  - 1 API call to update calendar data only
  - Rate limit: 1200ms
- For new anime (not in database):
  - 1 API call for partial data check (filter)
  - 1 API call for full details (`/anime/{id}`)
  - Database create
  - Rate limit: 1200ms between each

**Time Estimate (after initial run, most anime exist):**
- Existing anime updates: ~150 anime × 1.2 seconds = 180 seconds
- New anime (estimated 10-20%): ~20 anime × 2.4 seconds = 48 seconds
- Database operations: ~170 operations × ~0.1 seconds = 17 seconds
- **Total: ~4-5 minutes**

**Time Estimate (first run, many new anime):**
- Existing anime: ~50 anime × 1.2 seconds = 60 seconds
- New anime: ~150 anime × 2.4 seconds = 360 seconds
- Database operations: ~200 operations × ~0.1 seconds = 20 seconds
- **Total: ~7-8 minutes**

## Combined Daily Sync Time

### Typical Day (After Initial Setup)
- Daily anime sync: **3-4 minutes**
- Calendar sync: **4-5 minutes**
- **Total: ~7-9 minutes per day**

### First Run (Initial Setup)
- Daily anime sync: **3-4 minutes**
- Calendar sync: **7-8 minutes**
- **Total: ~10-12 minutes**

## Rate Limiting

- **Jikan API Rate Limit:** 3 requests/second
- **Our Rate Limit:** 0.83 requests/second (1200ms delay)
- **Safety Margin:** ~3.6x slower than max to avoid rate limit errors

## Optimization Notes

1. Both syncs run independently and can overlap
2. Calendar sync runs 5 seconds after startup
3. Daily anime sync runs 10 seconds after startup
4. They will run in parallel after initial startup
5. Most time is spent waiting for rate limits, not processing

## Future Optimizations

- Could batch database operations
- Could parallelize some API calls (with careful rate limiting)
- Could cache frequently accessed anime data
- Could skip full fetch for anime that already exist and pass initial filter
