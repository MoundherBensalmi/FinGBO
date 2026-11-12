import { loginInputSchema } from '@fingbo/shared/auth'
import { authedProcedure, publicProcedure, router } from '../../trpc/init'
import { login, logout } from './auth.service'

export const authRouter = router({
  /** Returns a token to keep in localStorage and send as "Authorization: Bearer <token>". */
  login: publicProcedure
    .input(loginInputSchema)
    .mutation(({ ctx, input }) => login(ctx.db, input, ctx.client)),

  /** The logged-in user. Fails with UNAUTHORIZED when the token is missing or revoked. */
  me: authedProcedure.query(({ ctx }) => ctx.auth.user),

  logout: authedProcedure.mutation(async ({ ctx }) => {
    await logout(ctx.db, ctx.auth)
    return { ok: true as const }
  }),
})
