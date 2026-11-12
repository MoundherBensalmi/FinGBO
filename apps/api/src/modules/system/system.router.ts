import { publicProcedure, router } from '../../trpc/init'

export const systemRouter = router({
  /** Lets the web app check that it can reach the API. */
  health: publicProcedure.query(() => ({ ok: true as const, serverTime: new Date() })),
})
