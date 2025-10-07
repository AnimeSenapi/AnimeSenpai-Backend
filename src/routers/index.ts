import { router } from '../lib/trpc'
import { authRouter } from './auth'
import { animeRouter } from './anime'
import { userRouter } from './user'
import { adminRouter } from './admin'

export const appRouter = router({
  auth: authRouter,
  anime: animeRouter,
  user: userRouter,
  admin: adminRouter,
})

export type AppRouter = typeof appRouter
