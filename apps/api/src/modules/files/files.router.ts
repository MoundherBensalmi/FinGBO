import { idSchema } from '@fingbo/shared/common'
import { z } from 'zod'
import { adminProcedure, router } from '../../trpc/init'
import { deleteMovementFile } from './files.service'

// Uploading and downloading go through plain HTTP routes (files.routes.ts).
export const filesRouter = router({
  deleteMovementFile: adminProcedure
    .input(z.object({ id: idSchema }))
    .mutation(({ ctx, input }) => deleteMovementFile(ctx.db, input.id)),
})
