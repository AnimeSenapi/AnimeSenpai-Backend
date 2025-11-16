import { router } from '../lib/trpc'
import { authRouter } from './auth'
import { twoFactorRouter } from './two-factor'
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
import { messagingRouter } from './messaging'
import { achievementsRouter } from './achievements'
import { leaderboardsRouter } from './leaderboards'
import { safetyRouter } from './safety'
import { listToolsRouter } from './list-tools'
import { roleManagementRouter } from './role-management'
import { systemSettingsRouter } from './system-settings'
import { monitoringRouter } from './monitoring'
import { analyticsRouter } from './analytics'
import { appStatusRouter } from './app-status'

export const appRouter = router({
  auth: authRouter,
  twoFactor: twoFactorRouter,
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
  messaging: messagingRouter,
  achievements: achievementsRouter,
  leaderboards: leaderboardsRouter,
  safety: safetyRouter,
  listTools: listToolsRouter,
  roleManagement: roleManagementRouter,
  systemSettings: systemSettingsRouter,
  monitoring: monitoringRouter,
  analytics: analyticsRouter,
  appStatus: appStatusRouter,
})

export type AppRouter = typeof appRouter
