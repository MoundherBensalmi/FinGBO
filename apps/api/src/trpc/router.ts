import { authRouter } from '../modules/auth/auth.router'
import { categoriesRouter } from '../modules/categories/categories.router'
import { filesRouter } from '../modules/files/files.router'
import { movementsRouter } from '../modules/movements/movements.router'
import { peopleRouter } from '../modules/people/people.router'
import { receiptsRouter } from '../modules/receipts/receipts.router'
import { systemRouter } from '../modules/system/system.router'
import { usersRouter } from '../modules/users/users.router'
import { router } from './init'

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  categories: categoriesRouter,
  people: peopleRouter,
  movements: movementsRouter,
  receipts: receiptsRouter,
  files: filesRouter,
  users: usersRouter,
})

/** Imported (as a type only) by the web app for end-to-end type safety. */
export type AppRouter = typeof appRouter
