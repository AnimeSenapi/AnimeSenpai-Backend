# 🎬 Anime Import Script - Enhancement Plan

## ✅ Completed Enhancements

### 1. Smart Slug Generation
- ✅ Generates slugs from English titles
- ✅ Falls back to Japanese title if English unavailable
- ✅ Uses title synonyms for better differentiation (season, part, movie, etc.)
- ✅ Adds year suffix only for exact duplicates
- ✅ Works perfectly with frontend series grouping

**Examples:**
- "Attack on Titan" → `attack-on-titan`
- "Attack on Titan Season 2" → `attack-on-titan-season-2`
- "Attack on Titan" (duplicate) → `attack-on-titan-2013`

---

## 🔄 Pending Enhancements

### 2. Character & Voice Actor Import
**Status**: Schema ready, needs implementation

**What to add:**
- Fetch characters from Jikan API (`/anime/{id}/characters`)
- Fetch voice actors for each character
- Create Character, VoiceActor, AnimeCharacter, CharacterVoiceActor records

**API Endpoints:**
- `GET /v4/anime/{id}/characters` - Get all characters
- Each character has: name, image, role, favorites, voice_actors[]

**Data to import:**
```javascript
{
  character: {
    malId: 123,
    name: "Naruto Uzumaki",
    nameKanji: "うずまき ナルト",
    imageUrl: "https://...",
    description: "...",
    favorites: 12345
  },
  voiceActors: [
    {
      malId: 456,
      name: "Junko Takeuchi",
      imageUrl: "https://...",
      language: "Japanese"
    }
  ]
}
```

---

### 3. Banner Images
**Status**: Schema ready, needs implementation

**What to add:**
- Fetch banner image URL from Jikan API
- Store in `bannerImage` field

**API Field:**
- `images.webp.large_image_url` or `images.jpg.large_image_url`

---

### 4. Related Anime
**Status**: Schema ready, needs implementation

**What to add:**
- Fetch related anime from Jikan API (`/anime/{id}/relations`)
- Create RelatedAnime records with relation type

**API Endpoints:**
- `GET /v4/anime/{id}/relations` - Get related anime

**Relation Types:**
- "Sequel"
- "Prequel"
- "Alternative version"
- "Side story"
- "Character"
- "Summary"
- "Other"

**Data to import:**
```javascript
{
  animeId: "anime-123",
  relatedId: "anime-456",
  relation: "Sequel"
}
```

---

### 5. External Links
**Status**: Schema ready, needs implementation

**What to add:**
- Fetch external links from Jikan API
- Store as JSON array in `externalLinks` field

**API Field:**
- `external[]` - Array of {name, url} objects

**Example:**
```javascript
externalLinks: [
  { name: "Official Site", url: "https://..." },
  { name: "Wikipedia", url: "https://..." },
  { name: "AniDB", url: "https://..." }
]
```

---

### 6. Opening/Ending Themes
**Status**: Schema ready, needs implementation

**What to add:**
- Fetch themes from Jikan API (`/anime/{id}/themes`)
- Create AnimeTheme records

**API Endpoints:**
- `GET /v4/anime/{id}/themes` - Get opening/ending themes

**Data to import:**
```javascript
{
  animeId: "anime-123",
  type: "Opening", // or "Ending"
  number: 1, // OP1, OP2, ED1, ED2, etc.
  name: "Blue Bird",
  artist: "Ikimono-gakari"
}
```

---

### 7. ETA (Estimated Time to Completion)
**Status**: Needs implementation

**What to add:**
- Calculate ETA based on current progress
- Display in progress bars
- Update every 10 pages

**Formula:**
```javascript
const elapsed = Date.now() - state.startTime
const rate = state.stats.totalFetched / (elapsed / 1000 / 60) // anime/min
const remaining = totalAnime - state.stats.totalFetched
const etaMinutes = remaining / rate
const eta = formatTime(etaMinutes)
```

---

### 8. Data Validation
**Status**: Needs implementation

**What to add:**
- Validate required fields before saving
- Check data types
- Sanitize strings
- Validate URLs

**Validation Rules:**
```javascript
function validateAnimeData(anime) {
  // Required fields
  if (!anime.title) throw new Error('Missing title')
  if (!anime.slug) throw new Error('Missing slug')
  
  // Data types
  if (typeof anime.episodes !== 'number' && anime.episodes !== null) {
    throw new Error('Invalid episodes type')
  }
  
  // Sanitize
  anime.synopsis = sanitizeHtml(anime.synopsis)
  
  // Validate URLs
  if (anime.coverImage && !isValidUrl(anime.coverImage)) {
    anime.coverImage = null
  }
  
  return anime
}
```

---

## 📊 Implementation Priority

### High Priority (Core Features)
1. ✅ **Smart Slug Generation** - DONE
2. **Banner Images** - Easy, high impact
3. **External Links** - Easy, useful
4. **ETA Display** - Easy, improves UX

### Medium Priority (Nice to Have)
5. **Related Anime** - Medium complexity, great for recommendations
6. **Data Validation** - Medium complexity, prevents bad data

### Low Priority (Future Enhancements)
7. **Character & Voice Actor Import** - Complex, requires multiple API calls per anime
8. **Opening/Ending Themes** - Nice to have, not essential

---

## 🎯 Recommended Next Steps

1. **Start with Banner Images** (5 minutes)
2. **Add External Links** (5 minutes)
3. **Add ETA Display** (10 minutes)
4. **Add Data Validation** (15 minutes)
5. **Add Related Anime** (20 minutes)
6. **Add Character/VA Import** (30+ minutes - can be done later)

---

## 📝 Notes

- All schema changes are already done
- Import script is already robust with error handling
- Rate limiting is already in place
- Progress saving already works
- Just need to add the new data fetching and processing

---

**Ready to implement?** Let me know which features you want me to add first! 🚀

