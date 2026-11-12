import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { z, ZodError } from 'zod'
import { isProduction } from '../env'
import type { Context } from './context'

const t = initTRPC.context<Context>().create({
  // Keeps Date (and other non-JSON types) intact between the API and React.
  transformer: superjson,
  isDev: !isProduction,
  errorFormatter({ shape, error }) {
    // Never leak database or code details to the browser in production.
    const hide = isProduction && error.code === 'INTERNAL_SERVER_ERROR'
    return {
      ...shape,
      message: hide ? 'Internal server error' : shape.message,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? z.flattenError(error.cause) : null,
      },
    }
  },
})

export const router = t.router

/** Anyone, logged in or not. Only for login and health checks. */
export const publicProcedure = t.procedure

/** Any logged-in user (admin or viewer). */
export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.auth) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Please log in' })
  return next({ ctx: { ...ctx, auth: ctx.auth } })
})

/** Admins only: writing data and managing users. */
export const adminProcedure = authedProcedure.use(({ ctx, next }) => {
  if (ctx.auth.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admins only' })
  }
  return next()
})
