import { personCreateSchema, personIdSchema, personUpdateSchema } from '@fingbo/shared/people'
import { adminProcedure, authedProcedure, router } from '../../trpc/init'
import { createPerson, getPersonAccount, listBalances, listPeople, updatePerson } from './people.service'

export const peopleRouter = router({
  /** Short list for pickers. */
  list: authedProcedure.query(({ ctx }) => listPeople(ctx.db)),

  /** Everyone with what you owe them and what you received from them. */
  balances: authedProcedure.query(({ ctx }) => listBalances(ctx.db)),

  /** One person's page: details, account statement, and what they carried. */
  account: authedProcedure.input(personIdSchema).query(({ ctx, input }) => getPersonAccount(ctx.db, input.id)),

  create: adminProcedure
    .input(personCreateSchema)
    .mutation(({ ctx, input }) => createPerson(ctx.db, ctx.auth.user, input)),

  update: adminProcedure
    .input(personUpdateSchema)
    .mutation(({ ctx, input }) => updatePerson(ctx.db, ctx.auth.user, input)),
})
