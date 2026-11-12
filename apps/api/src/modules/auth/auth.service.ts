import type { LoginInput } from '@fingbo/shared/auth'
import { TRPCError } from '@trpc/server'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { DbOrTx } from '../../db'
import { sessions, users, type User } from '../../db/schema'
import type { ClientInfo } from '../../lib/client-info'
import { describeDevice } from './device'
import { burnPasswordCheck, verifyPassword } from './password'
import { assertLoginAllowed, clearLoginFailures, recordLoginFailure } from './rate-limit'
import { signToken, verifyToken } from './token'

export type AuthUser = Pick<User, 'id' | 'username' | 'fullName' | 'role'>
export type Auth = { sessionId: string; user: AuthUser }

/** How often a session's last-seen time and IP are written (not on every request). */
const LAST_SEEN_INTERVAL_MS = 5 * 60_000

const toAuthUser = (u: User): AuthUser => ({
  id: u.id,
  username: u.username,
  fullName: u.fullName,
  role: u.role,
})

export async function login(db: DbOrTx, input: LoginInput, client: ClientInfo) {
  assertLoginAllowed(client.ip, input.username)

  const user = await db.query.users.findFirst({
    where: sql`lower(${users.username}) = lower(${input.username})`,
  })

  let passwordOk = false
  if (user) passwordOk = await verifyPassword(user.passwordHash, input.password)
  else await burnPasswordCheck(input.password)

  if (!user || !passwordOk) {
    recordLoginFailure(client.ip, input.username)
    // Same message for an unknown username and a wrong password.
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid username or password' })
  }

  if (user.disabledAt) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'This account is disabled' })
  }

  clearLoginFailures(client.ip, input.username)

  const [session] = await db
    .insert(sessions)
    .values({
      userId: user.id,
      ip: client.ip,
      lastIp: client.ip,
      userAgent: client.userAgent,
      device: describeDevice(client.userAgent, input.device),
    })
    .returning({ id: sessions.id })

  if (!session) throw new Error('Session insert returned no row')

  const token = await signToken({ userId: user.id, sessionId: session.id })
  return { token, user: toAuthUser(user) }
}

/**
 * Resolves the "Authorization: Bearer <token>" header to the logged-in user.
 * Returns null when there is no token, the token is invalid, the session was
 * revoked, or the user is disabled.
 */
export async function authenticate(
  db: DbOrTx,
  authorization: string | undefined,
  client: ClientInfo,
): Promise<Auth | null> {
  const token = authorization && /^Bearer\s+(\S+)$/i.exec(authorization)?.[1]
  if (!token) return null

  const claims = await verifyToken(token)
  if (!claims) return null

  const [row] = await db
    .select({
      sessionId: sessions.id,
      lastSeenAt: sessions.lastSeenAt,
      user: { id: users.id, username: users.username, fullName: users.fullName, role: users.role },
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.id, claims.sessionId),
        eq(sessions.userId, claims.userId),
        isNull(sessions.revokedAt),
        isNull(users.disabledAt),
      ),
    )
    .limit(1)

  if (!row) return null

  if (Date.now() - row.lastSeenAt.getTime() > LAST_SEEN_INTERVAL_MS) {
    await db
      .update(sessions)
      .set({ lastSeenAt: new Date(), lastIp: client.ip })
      .where(eq(sessions.id, row.sessionId))
  }

  return { sessionId: row.sessionId, user: row.user }
}

/** Revokes the current session; the token stops working immediately. */
export async function logout(db: DbOrTx, auth: Auth): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date(), revokedById: auth.user.id })
    .where(and(eq(sessions.id, auth.sessionId), isNull(sessions.revokedAt)))
}
