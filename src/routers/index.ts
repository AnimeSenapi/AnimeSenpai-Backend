import { router } from '../lib/trpc'
import { authRouter } from './auth'
import { animeRouter } from './anime'
import { userRouter } from './user'
import { adminRouter } from './admin'
import { recommendationsRouter } from './recommendations'
import { onboardingRouter } from './onboarding'
import { socialRouter } from './social'

export const appRouter = router({
  auth: authRouter,
  anime: animeRouter,
  user: userRouter,
  admin: adminRouter,
  recommendations: recommendationsRouter,
  onboarding: onboardingRouter,
  social: socialRouter,
})

export type AppRouter = typeof appRouter
