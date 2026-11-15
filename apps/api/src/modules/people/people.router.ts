import { personCreateSchema } from '@fingbo/shared/people'
import { adminProcedure, authedProcedure, router } from '../../trpc/init'
import { createPerson, listPeople } from './people.service'

export const peopleRouter = router({
  list: authedProcedure.query(({ ctx }) => listPeople(ctx.db)),

  create: adminProcedure
    .input(personCreateSchema)
    .mutation(({ ctx, input }) => createPerson(ctx.db, ctx.auth.user, input)),
})
