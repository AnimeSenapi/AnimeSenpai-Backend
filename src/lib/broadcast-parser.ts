/**
 * Broadcast Parser Utility
 * 
 * Parses anime broadcast strings (e.g., "Tuesdays at 01:29 (JST)") to extract:
 * - Day of week
 * - Time (with timezone handling)
 * - Generate episode air dates for a given date range
 */

import { fromZonedTime } from 'date-fns-tz'

interface BroadcastInfo {
  dayOfWeek: number // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  hour: number // 0-23
  minute: number // 0-59
  timezone: string // IANA timezone identifier (e.g., "Asia/Tokyo", "UTC")
}

interface EpisodeAirDate {
  date: string // ISO date string (YYYY-MM-DD)
  time: string // Time string (HH:MM)
  episodeNumber: number
}

/**
 * Parse broadcast string to extract day, time, and timezone
 * Examples:
 * - "Tuesdays at 01:29 (JST)" -> { dayOfWeek: 2, hour: 1, minute: 29, timezone: "Asia/Tokyo" }
 * - "Mondays at 12:00" -> { dayOfWeek: 1, hour: 12, minute: 0, timezone: "Asia/Tokyo" }
 * - "Every Tuesday at 01:29 JST" -> { dayOfWeek: 2, hour: 1, minute: 29, timezone: "Asia/Tokyo" }
 * - "Tue 01:29" -> { dayOfWeek: 2, hour: 1, minute: 29, timezone: "Asia/Tokyo" }
 */
export function parseBroadcast(broadcast: string | null | undefined): BroadcastInfo | null {
  if (!broadcast) return null

  const broadcastLower = broadcast.toLowerCase().trim()

  // Map day names to day of week (0 = Sunday)
  // Support both full names and abbreviations
  const dayMap: Record<string, number> = {
    sunday: 0,
    sundays: 0,
    sun: 0,
    monday: 1,
    mondays: 1,
    mon: 1,
    tuesday: 2,
    tuesdays: 2,
    tue: 2,
    tues: 2,
    wednesday: 3,
    wednesdays: 3,
    wed: 3,
    thursday: 4,
    thursdays: 4,
    thu: 4,
    thurs: 4,
    friday: 5,
    fridays: 5,
    fri: 5,
    saturday: 6,
    saturdays: 6,
    sat: 6,
  }

  // Extract timezone (default to Asia/Tokyo if not specified, as most anime air in JST)
  // Map common abbreviations to IANA timezone identifiers
  const timezoneMap: Record<string, string> = {
    JST: 'Asia/Tokyo',
    UTC: 'UTC',
    GMT: 'UTC',
    EST: 'America/New_York',
    EDT: 'America/New_York',
    PST: 'America/Los_Angeles',
    PDT: 'America/Los_Angeles',
    CST: 'America/Chicago',
    CDT: 'America/Chicago',
    MST: 'America/Denver',
    MDT: 'America/Denver',
  }
  
  let timezone = 'Asia/Tokyo' // Default to JST
  // Try multiple timezone patterns: (JST), JST, (Asia/Tokyo), etc.
  const timezonePatterns = [
    /\(([A-Z]{3,4})\)/i, // (JST)
    /\b([A-Z]{3,4})\b/i, // JST (standalone)
    /\(([A-Z]+\/[A-Z]+)\)/i, // (Asia/Tokyo)
  ]
  
  for (const pattern of timezonePatterns) {
    const match = broadcast.match(pattern)
    if (match && match[1]) {
      const tzAbbr = match[1].toUpperCase()
      // Check if it's already an IANA timezone
      if (tzAbbr.includes('/')) {
        timezone = tzAbbr
        break
      }
      // Map abbreviation to IANA
      if (timezoneMap[tzAbbr]) {
        timezone = timezoneMap[tzAbbr]
        break
      }
    }
  }

  // Extract day of week - try full names first, then abbreviations
  let dayOfWeek: number | null = null
  // Sort by length (longest first) to match full names before abbreviations
  const sortedDayEntries = Object.entries(dayMap).sort((a, b) => b[0].length - a[0].length)
  
  for (const [dayName, dayNum] of sortedDayEntries) {
    // Use word boundary to avoid partial matches
    const regex = new RegExp(`\\b${dayName}\\b`, 'i')
    if (regex.test(broadcastLower)) {
      dayOfWeek = dayNum
      break
    }
  }

  // Extract time (HH:MM or H:MM format)
  // Support multiple formats: 01:29, 1:29, 01:29:00
  const timePatterns = [
    /(\d{1,2}):(\d{2})(?::\d{2})?/, // HH:MM or HH:MM:SS
    /(\d{1,2})\s*:\s*(\d{2})/, // HH : MM (with spaces)
  ]
  
  let hour: number | null = null
  let minute: number | null = null
  
  for (const pattern of timePatterns) {
    const match = broadcast.match(pattern)
    if (match) {
      hour = parseInt(match[1] || '0', 10)
      minute = parseInt(match[2] || '0', 10)
      
      // Validate hour and minute ranges
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        break
      } else {
        hour = null
        minute = null
      }
    }
  }

  // Validation: all required fields must be present
  if (dayOfWeek === null || hour === null || minute === null) {
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
 * Convert time from source timezone to UTC using proper timezone library
 * Handles DST transitions and timezone complexities correctly
 */
function convertToUTC(
  hour: number,
  minute: number,
  sourceTimezone: string,
  referenceDate: Date = new Date()
): { hour: number; minute: number } {
  try {
    // Create a date object representing the local time in the source timezone
    const year = referenceDate.getFullYear()
    const month = String(referenceDate.getMonth() + 1).padStart(2, '0')
    const day = String(referenceDate.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`
    const localDateTime = new Date(`${dateStr}T${timeStr}`)
    
    // Convert from zoned time to UTC using proper timezone handling
    // fromZonedTime treats the date as if it's in the source timezone and converts to UTC
    const utcDate = fromZonedTime(localDateTime, sourceTimezone)
    
    return {
      hour: utcDate.getUTCHours(),
      minute: utcDate.getUTCMinutes(),
    }
  } catch (error) {
    // Fallback to simple offset if timezone is invalid
  const timezoneOffsets: Record<string, number> = {
      'Asia/Tokyo': 9,
      'UTC': 0,
      'America/New_York': -5,
      'America/Los_Angeles': -8,
      'America/Chicago': -6,
      'America/Denver': -7,
  }

    const offset = timezoneOffsets[sourceTimezone] || 9 // Default to JST
  let utcHour = hour - offset

  // Handle day rollover
  if (utcHour < 0) {
    utcHour += 24
  } else if (utcHour >= 24) {
    utcHour -= 24
  }

  return { hour: utcHour, minute }
  }
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
    // Use the current date for timezone conversion to handle DST correctly
    const { hour, minute } = convertToUTC(
      broadcastInfo.hour,
      broadcastInfo.minute,
      broadcastInfo.timezone,
      currentDate
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
      broadcastInfo.timezone,
      now
    )
    const broadcastTime = new Date(now)
    broadcastTime.setUTCHours(hour, minute, 0, 0)
    
    if (now >= broadcastTime) {
      daysUntilBroadcast = 7 // Move to next week
    }
  }

  const nextAirDate = new Date(now)
  nextAirDate.setDate(nextAirDate.getDate() + daysUntilBroadcast)
  
  return nextAirDate
}

