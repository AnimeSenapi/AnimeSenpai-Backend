import { router } from '../lib/trpc.js'
import { authRouter } from './auth.js'
import { twoFactorRouter } from './two-factor.js'
import { animeRouter } from './anime.js'
import { userRouter } from './user.js'
import { adminRouter } from './admin.js'
import { recommendationsRouter } from './recommendations.js'
import { groupingRouter } from './grouping.js'
import { onboardingRouter } from './onboarding.js'
import { socialRouter } from './social.js'
import { moderationRouter } from './moderation.js'
import { gdprRouter } from './gdpr.js'
import { studioRouter } from './studio.js'
import { activityRouter } from './activity.js'
import { reviewInteractionsRouter } from './review-interactions.js'
import { notificationsRouter } from './notifications.js'
import { privacyRouter } from './privacy.js'
import { messagingRouter } from './messaging.js'
import { achievementsRouter } from './achievements.js'
import { leaderboardsRouter } from './leaderboards.js'
import { safetyRouter } from './safety.js'
import { listToolsRouter } from './list-tools.js'
import { roleManagementRouter } from './role-management.js'
import { systemSettingsRouter } from './system-settings.js'
import { monitoringRouter } from './monitoring.js'
import { analyticsRouter } from './analytics.js'
import { appStatusRouter } from './app-status.js'
import { calendarRouter } from './calendar.js'

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
  calendar: calendarRouter,
  grouping: groupingRouter,
})

export type AppRouter = typeof appRouter
