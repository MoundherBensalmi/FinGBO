import {
  movementCancelSchema,
  movementDaySchema,
  movementInputSchema,
  movementUpdateSchema,
} from '@fingbo/shared/movements'
import { adminProcedure, authedProcedure, router } from '../../trpc/init'
import { cancelMovement, createMovement, getDay, updateMovement } from './movements.service'

export const movementsRouter = router({
  /** The caisse journal for one day, with balances. */
  day: authedProcedure
    .input(movementDaySchema)
    .query(({ ctx, input }) => getDay(ctx.db, input.date)),

  create: adminProcedure
    .input(movementInputSchema)
    .mutation(({ ctx, input }) => createMovement(ctx.db, ctx.auth.user, input)),

  update: adminProcedure
    .input(movementUpdateSchema)
    .mutation(({ ctx, input }) => updateMovement(ctx.db, ctx.auth.user, input)),

  cancel: adminProcedure
    .input(movementCancelSchema)
    .mutation(({ ctx, input }) => cancelMovement(ctx.db, ctx.auth.user, input)),
})
