import { router } from '../lib/trpc'
import { authRouter } from './auth'
import { animeRouter } from './anime'
import { userRouter } from './user'
import { adminRouter } from './admin'
import { recommendationsRouter } from './recommendations'
import { onboardingRouter } from './onboarding'
import { socialRouter } from './social'
import { moderationRouter } from './moderation'
import { gdprRouter } from './gdpr'
import { studioRouter } from './studio'
import { activityRouter } from './activity'
import { reviewInteractionsRouter } from './review-interactions'
import { notificationsRouter } from './notifications'
import { privacyRouter } from './privacy'

export const appRouter = router({
  auth: authRouter,
  anime: animeRouter,
  user: userRouter,
  admin: adminRouter,
  recommendations: recommendationsRouter,
  onboarding: onboardingRouter,
  social: socialRouter,
  moderation: moderationRouter,
  gdpr: gdprRouter,
  studio: studioRouter,
  activity: activityRouter,
  reviewInteractions: reviewInteractionsRouter,
  notifications: notificationsRouter,
  privacy: privacyRouter,
})

export type AppRouter = typeof appRouter
