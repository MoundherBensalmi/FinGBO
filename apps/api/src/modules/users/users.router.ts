import {
  sessionIdSchema,
  userCreateSchema,
  userIdSchema,
  userPasswordResetSchema,
  userSetDisabledSchema,
  userUpdateSchema,
} from '@fingbo/shared/users'
import { adminProcedure, router } from '../../trpc/init'
import {
  createUser,
  listUserSessions,
  listUsers,
  resetPassword,
  revokeAllSessions,
  revokeSession,
  setUserDisabled,
  updateUser,
} from './users.service'

/** Users and sessions admin panel. Admins only: viewers never see users. */
export const usersRouter = router({
  list: adminProcedure.query(({ ctx }) => listUsers(ctx.db)),

  create: adminProcedure
    .input(userCreateSchema)
    .mutation(({ ctx, input }) => createUser(ctx.db, ctx.auth.user, input)),

  /** Full name and role. */
  update: adminProcedure
    .input(userUpdateSchema)
    .mutation(({ ctx, input }) => updateUser(ctx.db, ctx.auth.user, input)),

  /** Disabling also revokes every open session of that user. */
  setDisabled: adminProcedure
    .input(userSetDisabledSchema)
    .mutation(({ ctx, input }) => setUserDisabled(ctx.db, ctx.auth.user, input)),

  /** New password; their sessions are revoked (except the admin's own current one). */
  resetPassword: adminProcedure
    .input(userPasswordResetSchema)
    .mutation(({ ctx, input }) => resetPassword(ctx.db, ctx.auth, input)),

  /** A user's sessions, with `current` on the one making the request. */
  sessions: adminProcedure.input(userIdSchema).query(({ ctx, input }) => listUserSessions(ctx.db, ctx.auth, input.id)),

  revokeSession: adminProcedure
    .input(sessionIdSchema)
    .mutation(({ ctx, input }) => revokeSession(ctx.db, ctx.auth, input.sessionId)),

  revokeAllSessions: adminProcedure
    .input(userIdSchema)
    .mutation(({ ctx, input }) => revokeAllSessions(ctx.db, ctx.auth, input.id)),
})
