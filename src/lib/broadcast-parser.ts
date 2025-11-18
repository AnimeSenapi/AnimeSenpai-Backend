/**
 * Broadcast Parser Utility
 * 
 * Parses anime broadcast strings (e.g., "Tuesdays at 01:29 (JST)") to extract:
 * - Day of week
 * - Time (with timezone handling)
 * - Generate episode air dates for a given date range
 */

interface BroadcastInfo {
  dayOfWeek: number // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  hour: number // 0-23
  minute: number // 0-59
  timezone: string // e.g., "JST", "UTC"
}

interface EpisodeAirDate {
  date: string // ISO date string (YYYY-MM-DD)
  time: string // Time string (HH:MM)
  episodeNumber: number
}

/**
 * Parse broadcast string to extract day, time, and timezone
 * Examples:
 * - "Tuesdays at 01:29 (JST)" -> { dayOfWeek: 2, hour: 1, minute: 29, timezone: "JST" }
 * - "Mondays at 12:00" -> { dayOfWeek: 1, hour: 12, minute: 0, timezone: "UTC" }
 */
export function parseBroadcast(broadcast: string | null | undefined): BroadcastInfo | null {
  if (!broadcast) return null

  const broadcastLower = broadcast.toLowerCase().trim()

  // Map day names to day of week (0 = Sunday)
  const dayMap: Record<string, number> = {
    sunday: 0,
    sundays: 0,
    monday: 1,
    mondays: 1,
    tuesday: 2,
    tuesdays: 2,
    wednesday: 3,
    wednesdays: 3,
    thursday: 4,
    thursdays: 4,
    friday: 5,
    fridays: 5,
    saturday: 6,
    saturdays: 6,
  }

  // Extract timezone (default to JST if not specified, as most anime air in JST)
  let timezone = 'JST'
  const timezoneMatch = broadcast.match(/\(([A-Z]{3,4})\)/i)
  if (timezoneMatch) {
    timezone = timezoneMatch[1].toUpperCase()
  }

  // Extract day of week
  let dayOfWeek: number | null = null
  for (const [dayName, dayNum] of Object.entries(dayMap)) {
    if (broadcastLower.includes(dayName)) {
      dayOfWeek = dayNum
      break
    }
  }

  // Extract time (HH:MM format)
  const timeMatch = broadcast.match(/(\d{1,2}):(\d{2})/)
  if (!timeMatch) {
    return null
  }

  const hour = parseInt(timeMatch[1] || '0', 10)
  const minute = parseInt(timeMatch[2] || '0', 10)

  if (dayOfWeek === null) {
    return null
  }

  return {
    dayOfWeek,
    hour,
    minute,
    timezone,
  }
}

/**
 * Convert time from source timezone to UTC
 * Note: This is a simplified conversion. For production, use a proper timezone library like date-fns-tz
 */
function convertToUTC(hour: number, minute: number, sourceTimezone: string): { hour: number; minute: number } {
  // Simplified timezone offsets (in hours)
  const timezoneOffsets: Record<string, number> = {
    JST: 9, // Japan Standard Time is UTC+9
    UTC: 0,
    EST: -5,
    PST: -8,
    GMT: 0,
  }

  const offset = timezoneOffsets[sourceTimezone] || 0
  let utcHour = hour - offset

  // Handle day rollover
  if (utcHour < 0) {
    utcHour += 24
  } else if (utcHour >= 24) {
    utcHour -= 24
  }

  return { hour: utcHour, minute }
}

/**
 * Generate episode air dates for a given date range
 * @param broadcast Broadcast string from anime
 * @param startDate Start date of range
 * @param endDate End date of range
 * @param animeStartDate When the anime started airing
 * @param totalEpisodes Total number of episodes
 * @returns Array of episode air dates within the range
 */
export function generateEpisodeSchedule(
  broadcast: string | null | undefined,
  startDate: Date,
  endDate: Date,
  animeStartDate: Date | null,
  totalEpisodes: number | null
): EpisodeAirDate[] {
  const broadcastInfo = parseBroadcast(broadcast)
  if (!broadcastInfo) {
    return []
  }

  // If anime hasn't started yet, return empty
  if (animeStartDate && animeStartDate > endDate) {
    return []
  }

  // Calculate the first air date (use animeStartDate if available, otherwise use startDate)
  const firstAirDate = animeStartDate || startDate
  const effectiveStartDate = firstAirDate > startDate ? firstAirDate : startDate

  // Find the first occurrence of the broadcast day on or after the effective start date
  const currentDate = new Date(effectiveStartDate)
  const currentDayOfWeek = currentDate.getDay()
  
  // Calculate days until next broadcast day
  let daysUntilBroadcast = (broadcastInfo.dayOfWeek - currentDayOfWeek + 7) % 7
  if (daysUntilBroadcast === 0 && currentDate > effectiveStartDate) {
    // If today is the broadcast day but we've already passed it, move to next week
    daysUntilBroadcast = 7
  }

  currentDate.setDate(currentDate.getDate() + daysUntilBroadcast)

  const episodes: EpisodeAirDate[] = []
  let episodeNumber = 1

  // Calculate episode number based on how many weeks have passed since anime started
  if (animeStartDate) {
    const weeksSinceStart = Math.floor(
      (currentDate.getTime() - animeStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
    )
    episodeNumber = weeksSinceStart + 1
  }

  // Generate episodes until we exceed the end date or run out of episodes
  while (currentDate <= endDate && (!totalEpisodes || episodeNumber <= totalEpisodes)) {
    const { hour, minute } = convertToUTC(
      broadcastInfo.hour,
      broadcastInfo.minute,
      broadcastInfo.timezone
    )

    episodes.push({
      date: currentDate.toISOString().split('T')[0] || '',
      time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
      episodeNumber,
    })

    // Move to next week
    currentDate.setDate(currentDate.getDate() + 7)
    episodeNumber++
  }

  return episodes
}

/**
 * Get the next air date for an anime based on its broadcast schedule
 */
export function getNextAirDate(
  broadcast: string | null | undefined,
  animeStartDate: Date | null,
  totalEpisodes: number | null
): Date | null {
  const broadcastInfo = parseBroadcast(broadcast)
  if (!broadcastInfo) {
    return null
  }

  const now = new Date()
  
  // If anime hasn't started yet, return start date
  if (animeStartDate && animeStartDate > now) {
    return animeStartDate
  }

  // If anime has ended (all episodes aired), return null
  if (animeStartDate && totalEpisodes) {
    const estimatedEndDate = new Date(animeStartDate)
    estimatedEndDate.setDate(estimatedEndDate.getDate() + (totalEpisodes - 1) * 7)
    if (estimatedEndDate < now) {
      return null
    }
  }

  // Find next occurrence of broadcast day
  const currentDayOfWeek = now.getDay()
  let daysUntilBroadcast = (broadcastInfo.dayOfWeek - currentDayOfWeek + 7) % 7
  
  // If today is the broadcast day, check if we've passed the time
  if (daysUntilBroadcast === 0) {
    const { hour, minute } = convertToUTC(
      broadcastInfo.hour,
      broadcastInfo.minute,
      broadcastInfo.timezone
    )
    const broadcastTime = new Date(now)
    broadcastTime.setHours(hour, minute, 0, 0)
    
    if (now >= broadcastTime) {
      daysUntilBroadcast = 7 // Move to next week
    }
  }

  const nextAirDate = new Date(now)
  nextAirDate.setDate(nextAirDate.getDate() + daysUntilBroadcast)
  
  return nextAirDate
}

