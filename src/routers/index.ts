import { router } from '../lib/trpc'
import { authRouter } from './auth'
import { animeRouter } from './anime'
import { userRouter } from './user'

export const appRouter = router({
  auth: authRouter,
  anime: animeRouter,
  user: userRouter
})

export type AppRouter = typeof appRouter
