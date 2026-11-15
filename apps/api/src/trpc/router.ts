import { authRouter } from '../modules/auth/auth.router'
import { categoriesRouter } from '../modules/categories/categories.router'
import { movementsRouter } from '../modules/movements/movements.router'
import { peopleRouter } from '../modules/people/people.router'
import { systemRouter } from '../modules/system/system.router'
import { router } from './init'

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  categories: categoriesRouter,
  people: peopleRouter,
  movements: movementsRouter,
})

/** Imported (as a type only) by the web app for end-to-end type safety. */
export type AppRouter = typeof appRouter
