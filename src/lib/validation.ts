import { z } from 'zod'
import { createError, AppError, ErrorCode } from './errors'

// Common validation schemas
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please provide a valid email address')
  .max(255, 'Email must be less than 255 characters')
  .toLowerCase()
  .trim()

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must be less than 128 characters')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')

export const usernameSchema = z
  .string()
  .min(2, 'Username must be at least 2 characters long')
  .max(50, 'Username must be less than 50 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')

export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must be less than 100 characters')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')

export const slugSchema = z
  .string()
  .min(1, 'Slug is required')
  .max(100, 'Slug must be less than 100 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')

export const uuidSchema = z
  .string()
  .uuid('Invalid UUID format')

export const positiveIntSchema = z
  .number()
  .int('Must be an integer')
  .positive('Must be a positive number')

export const nonNegativeIntSchema = z
  .number()
  .int('Must be an integer')
  .min(0, 'Must be a non-negative number')

export const ratingSchema = z
  .number()
  .min(0, 'Rating must be at least 0')
  .max(10, 'Rating must be at most 10')
  .multipleOf(0.5, 'Rating must be in increments of 0.5')

// Auth validation schemas
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
  firstName: nameSchema,
  lastName: nameSchema.optional(),
  gdprConsent: z.boolean().refine(val => val === true, 'GDPR consent is required'),
  marketingConsent: z.boolean().optional(),
  dataProcessingConsent: z.boolean().refine(val => val === true, 'Data processing consent is required'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const signinSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmNewPassword: z.string().min(1, 'New password confirmation is required'),
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: 'New passwords do not match',
  path: ['confirmNewPassword'],
})

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: passwordSchema,
  confirmNewPassword: z.string().min(1, 'New password confirmation is required'),
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: 'New passwords do not match',
  path: ['confirmNewPassword'],
})

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
})

export const resendVerificationSchema = z.object({
  email: emailSchema,
})

// User validation schemas
export const updateProfileSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  username: usernameSchema.optional(),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  dateOfBirth: z.string().datetime().optional(),
  location: z.string().max(100, 'Location must be less than 100 characters').optional(),
  website: z.string().url('Please provide a valid URL').optional(),
})

export const updatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().min(2, 'Language must be at least 2 characters').max(10, 'Language must be less than 10 characters').optional(),
  notifications: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    marketing: z.boolean().optional(),
  }).optional(),
  privacy: z.object({
    profileVisibility: z.enum(['public', 'friends', 'private']).optional(),
    showEmail: z.boolean().optional(),
    showActivity: z.boolean().optional(),
  }).optional(),
})

// Anime validation schemas
export const animeListEntrySchema = z.object({
  animeId: positiveIntSchema,
  status: z.enum(['watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch']),
  progress: nonNegativeIntSchema.optional(),
  rating: ratingSchema.optional(),
  notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional(),
  startDate: z.string().datetime().optional(),
  finishDate: z.string().datetime().optional(),
})

export const updateAnimeListEntrySchema = z.object({
  status: z.enum(['watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch']).optional(),
  progress: nonNegativeIntSchema.optional(),
  rating: ratingSchema.optional(),
  notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional(),
  startDate: z.string().datetime().optional(),
  finishDate: z.string().datetime().optional(),
})

export const animeRatingSchema = z.object({
  animeId: positiveIntSchema,
  rating: ratingSchema,
  review: z.string().max(5000, 'Review must be less than 5000 characters').optional(),
})

export const animeReviewSchema = z.object({
  animeId: positiveIntSchema,
  title: z.string().min(1, 'Review title is required').max(200, 'Review title must be less than 200 characters'),
  content: z.string().min(10, 'Review content must be at least 10 characters').max(5000, 'Review content must be less than 5000 characters'),
  rating: ratingSchema,
  spoilers: z.boolean().optional(),
})

// Query validation schemas
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
})

export const animeQuerySchema = z.object({
  search: z.string().max(100, 'Search query must be less than 100 characters').optional(),
  genre: z.string().max(50, 'Genre must be less than 50 characters').optional(),
  tag: z.string().max(50, 'Tag must be less than 50 characters').optional(),
  status: z.enum(['airing', 'completed', 'upcoming']).optional(),
  sort: z.enum(['title', 'rating', 'popularity', 'release_date']).default('popularity'),
  order: z.enum(['asc', 'desc']).default('desc'),
  ...paginationSchema.shape,
})

export const userAnimeListQuerySchema = z.object({
  status: z.enum(['watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch']).optional(),
  sort: z.enum(['title', 'rating', 'progress', 'updated_at']).default('updated_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  ...paginationSchema.shape,
})

// Validation utility functions
export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown, context?: { field?: string; requestId?: string }): T {
  try {
    return schema.parse(input)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]
      const field = firstError.path.join('.')
      const message = firstError.message
      
      throw createError.validationError(
        `Validation failed: ${message}`,
        field || context?.field,
        { 
          errors: error.errors,
          input: typeof input === 'object' ? input : { value: input }
        }
      )
    }
    
    throw createError.validationError(
      'Invalid input format',
      context?.field,
      { originalError: error }
    )
  }
}

export function validateEmail(email: string): string {
  return validateInput(emailSchema, email, { field: 'email' })
}

export function validatePassword(password: string): string {
  return validateInput(passwordSchema, password, { field: 'password' })
}

export function validateUsername(username: string): string {
  return validateInput(usernameSchema, username, { field: 'username' })
}

export function validateName(name: string, fieldName: string = 'name'): string {
  return validateInput(nameSchema, name, { field: fieldName })
}

export function validateSlug(slug: string): string {
  return validateInput(slugSchema, slug, { field: 'slug' })
}

export function validateUUID(uuid: string, fieldName: string = 'id'): string {
  return validateInput(uuidSchema, uuid, { field: fieldName })
}

export function validateRating(rating: number): number {
  return validateInput(ratingSchema, rating, { field: 'rating' })
}

// Sanitization functions
export function sanitizeString(input: string, maxLength?: number): string {
  let sanitized = input.trim()
  
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength)
  }
  
  return sanitized
}

export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

export function sanitizeHtml(input: string): string {
  // Basic HTML sanitization - remove script tags and dangerous attributes
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '')
}

export function sanitizeSearchQuery(query: string): string {
  return query
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML/XML tags
    .replace(/['"]/g, '') // Remove quotes that could break queries
    .substring(0, 100) // Limit length
}

// Custom validation functions
export function validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }
  
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  
  if (!/[@$!%*?&]/.test(password)) {
    errors.push('Password must contain at least one special character (@$!%*?&)')
  }
  
  // Check for common weak patterns
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password cannot contain more than 2 consecutive identical characters')
  }
  
  if (/123|abc|qwe|asd|zxc/i.test(password)) {
    errors.push('Password cannot contain common sequences')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

export function validateEmailDomain(email: string): { isValid: boolean; reason?: string } {
  const domain = email.split('@')[1]?.toLowerCase()
  
  if (!domain) {
    return { isValid: false, reason: 'Invalid email format' }
  }
  
  // Block disposable email domains
  const disposableDomains = [
    '10minutemail.com',
    'tempmail.org',
    'guerrillamail.com',
    'mailinator.com',
    'throwaway.email',
    // Add more as needed
  ]
  
  if (disposableDomains.includes(domain)) {
    return { isValid: false, reason: 'Disposable email addresses are not allowed' }
  }
  
  // Block suspicious domains
  const suspiciousPatterns = [
    /temp/i,
    /fake/i,
    /test/i,
    /spam/i,
  ]
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(domain)) {
      return { isValid: false, reason: 'Suspicious email domain detected' }
    }
  }
  
  return { isValid: true }
}

// Rate limiting validation
export function validateRateLimit(attempts: number, maxAttempts: number, windowMs: number): { isValid: boolean; retryAfter?: number } {
  if (attempts >= maxAttempts) {
    return { 
      isValid: false, 
      retryAfter: Math.ceil(windowMs / 1000) 
    }
  }
  
  return { isValid: true }
}

// Export all schemas for use in tRPC routers
export const schemas = {
  // Auth
  signup: signupSchema,
  signin: signinSchema,
  changePassword: changePasswordSchema,
  forgotPassword: forgotPasswordSchema,
  resetPassword: resetPasswordSchema,
  verifyEmail: verifyEmailSchema,
  resendVerification: resendVerificationSchema,
  
  // User
  updateProfile: updateProfileSchema,
  updatePreferences: updatePreferencesSchema,
  
  // Anime
  animeListEntry: animeListEntrySchema,
  updateAnimeListEntry: updateAnimeListEntrySchema,
  animeRating: animeRatingSchema,
  animeReview: animeReviewSchema,
  
  // Query
  pagination: paginationSchema,
  animeQuery: animeQuerySchema,
  userAnimeListQuery: userAnimeListQuerySchema,
  
  // Common
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema,
  name: nameSchema,
  slug: slugSchema,
  uuid: uuidSchema,
  positiveInt: positiveIntSchema,
  nonNegativeInt: nonNegativeIntSchema,
  rating: ratingSchema,
}
