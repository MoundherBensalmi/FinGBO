import { authRouter } from '../modules/auth/auth.router'
import { systemRouter } from '../modules/system/system.router'
import { router } from './init'

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
})

/** Imported (as a type only) by the web app for end-to-end type safety. */
export type AppRouter = typeof appRouter
