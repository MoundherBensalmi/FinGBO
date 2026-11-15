import { idSchema } from '@fingbo/shared/common'
import { z } from 'zod'
import { adminProcedure, router } from '../../trpc/init'
import { FILE_KINDS, deleteFile } from './files.service'

// Uploading and downloading go through plain HTTP routes (files.routes.ts).
export const filesRouter = router({
  delete: adminProcedure
    .input(z.object({ kind: z.enum(FILE_KINDS), id: idSchema }))
    .mutation(({ ctx, input }) => deleteFile(ctx.db, input.kind, input.id)),
})
