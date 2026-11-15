import { categoryCreateSchema } from '@fingbo/shared/categories'
import { adminProcedure, authedProcedure, router } from '../../trpc/init'
import { createCategory, listCategories } from './categories.service'

export const categoriesRouter = router({
  /** All categories, archived ones included (forms hide them). */
  list: authedProcedure.query(({ ctx }) => listCategories(ctx.db)),

  create: adminProcedure
    .input(categoryCreateSchema)
    .mutation(({ ctx, input }) => createCategory(ctx.db, ctx.auth.user, input)),
})
