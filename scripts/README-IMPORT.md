# 🎬 Anime Import Script

## Overview

This script imports anime data from the Jikan API (MyAnimeList) into your database with comprehensive data including:

- ✅ **Basic Info**: Title, description, year, episodes, status, type
- ✅ **Images**: Cover and banner images
- ✅ **Ratings & Stats**: Score, popularity, members, favorites, rank
- ✅ **Genres & Tags**: All genres, themes, and demographics
- ✅ **Studios & Producers**: Production companies
- ✅ **Streaming Links**: Where to watch (Crunchyroll, Netflix, etc.)
- ✅ **Metadata**: Aired dates, broadcast info, source material
- ✅ **Smart Slugs**: Intelligent slug generation from English titles with duplicate handling

## Features

- 🚀 **Smart Rate Limiting**: Respects Jikan's 3 req/sec limit (uses 0.83 req/sec for safety)
- 🔄 **Auto-Retry**: Automatically retries failed requests up to 5 times
- 🚫 **Content Filtering**: Automatically filters out adult content (Hentai, Rx-rated, Ecchi)
- 💾 **Progress Saving**: Saves progress every 5 minutes, resume if interrupted
- 📊 **Progress Bars**: Visual progress indicators for genres and pages
- 🛑 **Graceful Shutdown**: Press Ctrl+C to stop and save progress
- ⚡ **Batch Processing**: Saves in batches of 20 for efficiency
- 🔍 **Duplicate Detection**: Skips anime already in database
- 🔗 **Smart Slug Generation**: Intelligent URL slugs with duplicate handling

### Slug Strategy

The script generates SEO-friendly slugs from anime titles:

1. **Primary**: English title (`title_english`)
2. **Fallback 1**: Japanese title (`title`)
3. **Fallback 2**: Alternative title (`title_japanese`)

**Smart Slug Examples:**
- "Attack on Titan" → `attack-on-titan`
- "Attack on Titan Season 2" → `attack-on-titan-season-2`
- "One Piece Film: Red" → `one-piece-film-red`
- "Naruto Shippuden" → `naruto-shippuden`

**Duplicate Handling:**
- If exact duplicate detected, adds year: `attack-on-titan-2013`
- Works perfectly with frontend series grouping
- Each anime in a series gets unique slug

## Configuration

The script targets **Top 1000 anime per genre** across **68 genres**:
- Expected: ~27,000 total anime
- Time: ~20-25 hours
- Rate: ~1,300 anime/hour

## Usage

### Prerequisites

1. Make sure your backend is set up with Prisma
2. Ensure `.env` file has `DATABASE_URL`
3. Database should be migrated and ready

### Run the Import

```bash
cd AnimeSenpai-Backend/scripts
bun standalone-import.js
```

### Stop the Import

Press `Ctrl+C` to stop gracefully. The script will:
- Save any pending anime to the database
- Save final statistics
- Clean up and exit

## Files Created

- `import-state.json` - Current progress and statistics
- `import-health.json` - Health check file (updated every 5 minutes)

## Monitoring Progress

The script shows:
- Current genre being processed
- Pages completed per genre
- Overall progress bar
- Detailed statistics every 10 pages

### Example Output

```
📚 Processing Genre: Action (1/68)
Overall Progress: [████████████████░░░░] 2% (1/68)
  Action Pages: [████████████████████] 50% (20/40)

======================================================================
Current Statistics:
======================================================================
Runtime:          2h 15m 30s
Current Genre:    Action
Genres Completed: 0/68
Total Fetched:    850
Total Filtered:   45 (adult content)
Total Skipped:    120 (already in DB)
Total Saved:      685
Pending Save:     0
Total Errors:     2
Platforms Found:  234
Fetch Rate:       6.3 anime/min
======================================================================
```

## Rate Limiting

The script uses **conservative rate limiting** to avoid hitting Jikan's limits:
- **Delay**: 1200ms between requests (0.83 req/sec)
- **Jikan Limit**: 3 req/sec
- **Safety Margin**: 70% below limit

## Content Filtering

Automatically filters out:
- ❌ Hentai
- ❌ Rx-rated content
- ❌ Ecchi (optional - can be enabled)

## Error Handling

- **Retries**: Up to 5 retries with exponential backoff
- **Skip Failed**: Skips anime that fail after max retries
- **Continue**: Script continues even if some anime fail

## Database Schema

The script saves data to these tables:
- `anime` - Main anime data
- `genre` - Genre definitions
- `anime_genre` - Anime-genre relationships
- `streaming_platform` - Platform definitions
- `anime_streaming_platform` - Anime-platform relationships

## Resuming After Interruption

If the script is stopped (Ctrl+C) or crashes:
1. Simply run it again: `bun standalone-import.js`
2. It will automatically:
   - Load previous statistics
   - Skip anime already in database
   - Continue from where it left off

## Troubleshooting

### Connection Errors

If you see database connection errors:
1. Check that your backend is running
2. Verify `DATABASE_URL` in `.env` is correct
3. Ensure database is accessible

### Rate Limit Errors

If you see "429 Too Many Requests":
- The script will automatically wait and retry
- This is normal and handled automatically
- No action needed

### Import Taking Too Long

The script is designed to run for **20-25 hours** for all genres. This is normal! You can:
- Let it run overnight
- Stop and resume later (progress is saved)
- Reduce target pages per genre (modify `maxPages` in code)

## Performance

- **Speed**: ~1,300 anime/hour
- **Efficiency**: Batch saves every 20 anime
- **Memory**: Low memory footprint
- **CPU**: Minimal CPU usage

## Tips

1. **Run Overnight**: Best to run when you're not actively using the app
2. **Monitor Progress**: Check `import-state.json` for current stats
3. **Be Patient**: Importing 27k anime takes time - it's worth it!

## Support

If you encounter issues:
1. Check the state file: `import-state.json`
2. Ensure Jikan API is accessible: https://api.jikan.moe/v4/anime/1

---

**Happy Importing! 🎉**


## Overview

This script imports anime data from the Jikan API (MyAnimeList) into your database with comprehensive data including:

- ✅ **Basic Info**: Title, description, year, episodes, status, type
- ✅ **Images**: Cover and banner images
- ✅ **Ratings & Stats**: Score, popularity, members, favorites, rank
- ✅ **Genres & Tags**: All genres, themes, and demographics
- ✅ **Studios & Producers**: Production companies
- ✅ **Streaming Links**: Where to watch (Crunchyroll, Netflix, etc.)
- ✅ **Metadata**: Aired dates, broadcast info, source material
- ✅ **Smart Slugs**: Intelligent slug generation from English titles with duplicate handling

## Features

- 🚀 **Smart Rate Limiting**: Respects Jikan's 3 req/sec limit (uses 0.83 req/sec for safety)
- 🔄 **Auto-Retry**: Automatically retries failed requests up to 5 times
- 🚫 **Content Filtering**: Automatically filters out adult content (Hentai, Rx-rated, Ecchi)
- 💾 **Progress Saving**: Saves progress every 5 minutes, resume if interrupted
- 📊 **Progress Bars**: Visual progress indicators for genres and pages
- 🛑 **Graceful Shutdown**: Press Ctrl+C to stop and save progress
- ⚡ **Batch Processing**: Saves in batches of 20 for efficiency
- 🔍 **Duplicate Detection**: Skips anime already in database
- 🔗 **Smart Slug Generation**: Intelligent URL slugs with duplicate handling

### Slug Strategy

The script generates SEO-friendly slugs from anime titles:

1. **Primary**: English title (`title_english`)
2. **Fallback 1**: Japanese title (`title`)
3. **Fallback 2**: Alternative title (`title_japanese`)

**Smart Slug Examples:**
- "Attack on Titan" → `attack-on-titan`
- "Attack on Titan Season 2" → `attack-on-titan-season-2`
- "One Piece Film: Red" → `one-piece-film-red`
- "Naruto Shippuden" → `naruto-shippuden`

**Duplicate Handling:**
- If exact duplicate detected, adds year: `attack-on-titan-2013`
- Works perfectly with frontend series grouping
- Each anime in a series gets unique slug

## Configuration

The script targets **Top 1000 anime per genre** across **68 genres**:
- Expected: ~27,000 total anime
- Time: ~20-25 hours
- Rate: ~1,300 anime/hour

## Usage

### Prerequisites

1. Make sure your backend is set up with Prisma
2. Ensure `.env` file has `DATABASE_URL`
3. Database should be migrated and ready

### Run the Import

```bash
cd AnimeSenpai-Backend/scripts
bun standalone-import.js
```

### Stop the Import

Press `Ctrl+C` to stop gracefully. The script will:
- Save any pending anime to the database
- Save final statistics
- Clean up and exit

## Files Created

- `import-state.json` - Current progress and statistics
- `import-health.json` - Health check file (updated every 5 minutes)

## Monitoring Progress

The script shows:
- Current genre being processed
- Pages completed per genre
- Overall progress bar
- Detailed statistics every 10 pages

### Example Output

```
📚 Processing Genre: Action (1/68)
Overall Progress: [████████████████░░░░] 2% (1/68)
  Action Pages: [████████████████████] 50% (20/40)

======================================================================
Current Statistics:
======================================================================
Runtime:          2h 15m 30s
Current Genre:    Action
Genres Completed: 0/68
Total Fetched:    850
Total Filtered:   45 (adult content)
Total Skipped:    120 (already in DB)
Total Saved:      685
Pending Save:     0
Total Errors:     2
Platforms Found:  234
Fetch Rate:       6.3 anime/min
======================================================================
```

## Rate Limiting

The script uses **conservative rate limiting** to avoid hitting Jikan's limits:
- **Delay**: 1200ms between requests (0.83 req/sec)
- **Jikan Limit**: 3 req/sec
- **Safety Margin**: 70% below limit

## Content Filtering

Automatically filters out:
- ❌ Hentai
- ❌ Rx-rated content
- ❌ Ecchi (optional - can be enabled)

## Error Handling

- **Retries**: Up to 5 retries with exponential backoff
- **Skip Failed**: Skips anime that fail after max retries
- **Continue**: Script continues even if some anime fail

## Database Schema

The script saves data to these tables:
- `anime` - Main anime data
- `genre` - Genre definitions
- `anime_genre` - Anime-genre relationships
- `streaming_platform` - Platform definitions
- `anime_streaming_platform` - Anime-platform relationships

## Resuming After Interruption

If the script is stopped (Ctrl+C) or crashes:
1. Simply run it again: `bun standalone-import.js`
2. It will automatically:
   - Load previous statistics
   - Skip anime already in database
   - Continue from where it left off

## Troubleshooting

### Connection Errors

If you see database connection errors:
1. Check that your backend is running
2. Verify `DATABASE_URL` in `.env` is correct
3. Ensure database is accessible

### Rate Limit Errors

If you see "429 Too Many Requests":
- The script will automatically wait and retry
- This is normal and handled automatically
- No action needed

### Import Taking Too Long

The script is designed to run for **20-25 hours** for all genres. This is normal! You can:
- Let it run overnight
- Stop and resume later (progress is saved)
- Reduce target pages per genre (modify `maxPages` in code)

## Performance

- **Speed**: ~1,300 anime/hour
- **Efficiency**: Batch saves every 20 anime
- **Memory**: Low memory footprint
- **CPU**: Minimal CPU usage

## Tips

1. **Run Overnight**: Best to run when you're not actively using the app
2. **Monitor Progress**: Check `import-state.json` for current stats
3. **Be Patient**: Importing 27k anime takes time - it's worth it!

## Support

If you encounter issues:
1. Check the state file: `import-state.json`
2. Ensure Jikan API is accessible: https://api.jikan.moe/v4/anime/1

---

**Happy Importing! 🎉**

