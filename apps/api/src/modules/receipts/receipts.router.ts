import {
  receiptCancelSchema,
  receiptInputSchema,
  receiptListSchema,
  receiptUpdateSchema,
} from '@fingbo/shared/receipts'
import { adminProcedure, authedProcedure, router } from '../../trpc/init'
import { cancelReceipt, createReceipt, listReceipts, updateReceipt } from './receipts.service'

export const receiptsRouter = router({
  list: authedProcedure.input(receiptListSchema).query(({ ctx, input }) => listReceipts(ctx.db, input)),

  create: adminProcedure
    .input(receiptInputSchema)
    .mutation(({ ctx, input }) => createReceipt(ctx.db, ctx.auth.user, input)),

  update: adminProcedure
    .input(receiptUpdateSchema)
    .mutation(({ ctx, input }) => updateReceipt(ctx.db, ctx.auth.user, input)),

  cancel: adminProcedure
    .input(receiptCancelSchema)
    .mutation(({ ctx, input }) => cancelReceipt(ctx.db, ctx.auth.user, input)),
})
