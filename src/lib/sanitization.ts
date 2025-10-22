/**
 * Input Sanitization and XSS Protection
 * Prevents injection attacks and malicious input
 */

/**
 * Sanitize string input to prevent XSS attacks
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return String(input)
  }
  
  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Escape HTML special characters
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    // Remove potential script injections
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
}

/**
 * Sanitize HTML content (for rich text editors)
 * Allows safe HTML tags while removing dangerous ones
 */
export function sanitizeHTML(html: string): string {
  if (typeof html !== 'string') {
    return ''
  }
  
  // Remove dangerous tags completely
  const dangerous = /<(script|iframe|object|embed|link|style|form|input|textarea|button)[^>]*>.*?<\/\1>/gis
  let cleaned = html.replace(dangerous, '')
  
  // Remove event handlers
  cleaned = cleaned.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
  cleaned = cleaned.replace(/on\w+\s*=\s*[^\s>]*/gi, '')
  
  // Remove javascript: protocol
  cleaned = cleaned.replace(/javascript:/gi, '')
  
  // Remove data: protocol (except for images)
  cleaned = cleaned.replace(/data:(?!image\/)/gi, '')
  
  return cleaned
}

/**
 * Sanitize SQL-like input to prevent SQL injection
 * Note: Using Prisma ORM prevents most SQL injection,
 * but this adds an extra layer for raw queries
 */
export function sanitizeSQLInput(input: string): string {
  if (typeof input !== 'string') {
    return String(input)
  }
  
  return input
    // Remove SQL comments
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    // Remove dangerous SQL keywords
    .replace(/;\s*(DROP|DELETE|TRUNCATE|ALTER|CREATE|GRANT|REVOKE)\s/gi, '')
    // Escape single quotes
    .replace(/'/g, "''")
    // Remove null bytes
    .replace(/\0/g, '')
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') {
    return ''
  }
  
  return email
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9@._+-]/g, '')
}

/**
 * Sanitize username (alphanumeric + underscore/dash)
 */
export function sanitizeUsername(username: string): string {
  if (typeof username !== 'string') {
    return ''
  }
  
  return username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '')
    .substring(0, 30) // Max length
}

/**
 * Sanitize URL to prevent open redirect attacks
 */
export function sanitizeURL(url: string, allowedDomains: string[] = []): string {
  if (typeof url !== 'string') {
    return ''
  }
  
  try {
    const parsed = new URL(url)
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return ''
    }
    
    // If allowed domains specified, check
    if (allowedDomains.length > 0) {
      const isAllowed = allowedDomains.some(domain => 
        parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
      )
      
      if (!isAllowed) {
        return ''
      }
    }
    
    return parsed.toString()
  } catch {
    // Invalid URL
    return ''
  }
}

/**
 * Sanitize file path to prevent directory traversal
 */
export function sanitizeFilePath(path: string): string {
  if (typeof path !== 'string') {
    return ''
  }
  
  return path
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove directory traversal attempts
    .replace(/\.\./g, '')
    .replace(/\/\//g, '/')
    // Remove dangerous characters
    .replace(/[<>:"|?*]/g, '')
    .trim()
}

/**
 * Sanitize JSON input
 */
export function sanitizeJSON(input: any): any {
  if (typeof input === 'string') {
    return sanitizeString(input)
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeJSON)
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(input)) {
      sanitized[sanitizeString(key)] = sanitizeJSON(value)
    }
    return sanitized
  }
  
  return input
}

/**
 * Validate and sanitize pagination parameters
 */
export function sanitizePagination(params: { page?: number; limit?: number; maxLimit?: number }) {
  const { page = 1, limit = 20, maxLimit = 100 } = params
  
  return {
    page: Math.max(1, Math.floor(Number(page) || 1)),
    limit: Math.min(maxLimit, Math.max(1, Math.floor(Number(limit) || 20))),
  }
}

/**
 * Sanitize search query
 */
export function sanitizeSearchQuery(query: string): string {
  if (typeof query !== 'string') {
    return ''
  }
  
  return query
    .trim()
    .substring(0, 200) // Max search length
    .replace(/[<>]/g, '') // Remove HTML brackets
    .replace(/\\/g, '') // Remove backslashes
}

/**
 * Strip all HTML tags from string
 */
export function stripHTMLTags(html: string): string {
  if (typeof html !== 'string') {
    return ''
  }
  
  return html.replace(/<[^>]*>/g, '')
}

/**
 * Sanitize object keys to prevent prototype pollution
 */
export function sanitizeObjectKeys(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }
  
  const safe: any = {}
  
  for (const [key, value] of Object.entries(obj)) {
    // Skip dangerous keys
    if (['__proto__', 'constructor', 'prototype'].includes(key)) {
      continue
    }
    
    // Recursively sanitize nested objects
    safe[key] = typeof value === 'object' && value !== null
      ? sanitizeObjectKeys(value)
      : value
  }
  
  return safe
}

/**
 * Validate input against regex pattern
 */
export function matchesPattern(input: string, pattern: RegExp): boolean {
  if (typeof input !== 'string') {
    return false
  }
  
  return pattern.test(input)
}

/**
 * Common validation patterns
 */
export const ValidationPatterns = {
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  username: /^[a-zA-Z0-9_-]{3,30}$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, // Min 8 chars, 1 upper, 1 lower, 1 digit
  url: /^https?:\/\/.+/,
  slug: /^[a-z0-9-]+$/,
  hexColor: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
}

/**
 * Rate limit key sanitization
 */
export function sanitizeRateLimitKey(identifier: string): string {
  if (typeof identifier !== 'string') {
    return 'unknown'
  }
  
  return identifier
    .replace(/[^a-zA-Z0-9.:_-]/g, '')
    .substring(0, 100)
}

