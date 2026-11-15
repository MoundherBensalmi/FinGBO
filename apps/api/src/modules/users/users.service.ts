import type { UserRole } from '@fingbo/shared/auth'
import { TRPCError } from '@trpc/server'
import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { Db, DbOrTx } from '../../db'
import { sessions, users } from '../../db/schema'
import { isUniqueViolation } from '../../lib/pg-errors'
import type { Auth } from '../auth/auth.service'
import { hashPassword } from '../auth/password'

// Admin panel: users and their sessions. Every function here is called by admins only.
//
// Safety rules:
//   - an admin cannot disable themself or remove their own admin role;
//   - the last active admin can never be disabled or demoted.

const creator = alias(users, 'creator')

const userColumns = {
  id: users.id,
  username: users.username,
  fullName: users.fullName,
  role: users.role,
  disabledAt: users.disabledAt,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
}

/** Everyone, with who created them, their last activity and how many sessions are open. */
export async function listUsers(db: DbOrTx) {
  const s = db
    .select({
      userId: sessions.userId,
      lastSeenAt: sql<Date | null>`max(${sessions.lastSeenAt})`.mapWith(sessions.lastSeenAt).as('last_seen_at'),
      activeSessions: sql<number>`count(*) filter (where ${sessions.revokedAt} is null)`.mapWith(Number).as('active_sessions'),
    })
    .from(sessions)
    .groupBy(sessions.userId)
    .as('s')

  const rows = await db
    .select({
      ...userColumns,
      createdBy: { id: creator.id, username: creator.username, fullName: creator.fullName },
      lastSeenAt: s.lastSeenAt,
      activeSessions: s.activeSessions,
    })
    .from(users)
    .leftJoin(creator, eq(creator.id, users.createdById))
    .leftJoin(s, eq(s.userId, users.id))
    .orderBy(sql`${users.disabledAt} is not null`, sql`lower(${users.username})`)

  return rows.map((r) => ({ ...r, lastSeenAt: r.lastSeenAt ?? null, activeSessions: r.activeSessions ?? 0 }))
}

async function findUser(db: DbOrTx, id: number) {
  const [user] = await db.select(userColumns).from(users).where(eq(users.id, id)).limit(1)
  if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'Utilisateur introuvable' })
  return user
}

/**
 * Serializes the changes that can take away an admin (disable, change role) until
 * the transaction ends, so two admins demoting each other at the same time cannot
 * leave nobody in charge.
 */
const lockAdminChanges = (tx: DbOrTx) => tx.execute(sql`select pg_advisory_xact_lock(hashtext('fingbo:admin-changes'))`)

/**
 * Refuses a change that would take away an active admin (disabling or demoting
 * them) when it is the actor themself or the last active admin.
 * Call it after lockAdminChanges, inside the same transaction.
 */
async function assertAdminCanBeRemoved(
  tx: DbOrTx,
  actor: Auth['user'],
  target: { id: number; role: UserRole; disabledAt: Date | null },
  ownMessage: string,
) {
  if (target.id === actor.id) throw new TRPCError({ code: 'FORBIDDEN', message: ownMessage })
  if (target.role !== 'admin' || target.disabledAt) return

  const [row] = await tx
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(users)
    .where(and(eq(users.role, 'admin'), isNull(users.disabledAt)))
  if ((row?.count ?? 0) <= 1) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Il doit rester au moins un administrateur actif' })
  }
}

/** Revokes every open session of a user, except `keepSessionId` if given. Returns how many. */
async function revokeUserSessions(db: DbOrTx, userId: number, actor: Auth['user'], keepSessionId?: string) {
  const rows = await db
    .update(sessions)
    .set({ revokedAt: new Date(), revokedById: actor.id })
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        keepSessionId ? ne(sessions.id, keepSessionId) : undefined,
      ),
    )
    .returning({ id: sessions.id })
  return rows.length
}

type ValidUserCreate = { username: string; fullName: string | null; role: UserRole; password: string }

export async function createUser(db: DbOrTx, actor: Auth['user'], input: ValidUserCreate) {
  const passwordHash = await hashPassword(input.password)
  try {
    const [row] = await db
      .insert(users)
      .values({
        username: input.username,
        fullName: input.fullName,
        role: input.role,
        passwordHash,
        createdById: actor.id,
      })
      .returning(userColumns)
    return row!
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    throw new TRPCError({ code: 'CONFLICT', message: `Le nom d'utilisateur « ${input.username} » est déjà pris` })
  }
}

export async function updateUser(
  db: Db,
  actor: Auth['user'],
  input: { id: number; fullName: string | null; role: UserRole },
) {
  return db.transaction(async (tx) => {
    await lockAdminChanges(tx)
    const target = await findUser(tx, input.id)
    if (target.role === 'admin' && input.role !== 'admin') {
      await assertAdminCanBeRemoved(tx, actor, target, 'Vous ne pouvez pas retirer votre propre rôle d’administrateur')
    }
    const [row] = await tx
      .update(users)
      .set({ fullName: input.fullName, role: input.role })
      .where(eq(users.id, input.id))
      .returning(userColumns)
    return row!
  })
}

/** Disabling also revokes all their open sessions, so they are logged out at once. */
export async function setUserDisabled(db: Db, actor: Auth['user'], input: { id: number; disabled: boolean }) {
  return db.transaction(async (tx) => {
    await lockAdminChanges(tx)
    const target = await findUser(tx, input.id)
    if (!input.disabled) {
      const [row] = await tx.update(users).set({ disabledAt: null }).where(eq(users.id, input.id)).returning(userColumns)
      return { user: row!, revokedSessions: 0 }
    }
    await assertAdminCanBeRemoved(tx, actor, target, 'Vous ne pouvez pas désactiver votre propre compte')
    const [row] = await tx
      .update(users)
      .set({ disabledAt: target.disabledAt ?? new Date() })
      .where(eq(users.id, input.id))
      .returning(userColumns)
    const revokedSessions = await revokeUserSessions(tx, input.id, actor)
    return { user: row!, revokedSessions }
  })
}

/**
 * Sets a new password and revokes the user's open sessions.
 * When admins reset their own password, the session they are using stays open.
 */
export async function resetPassword(db: Db, auth: Auth, input: { id: number; password: string }) {
  const passwordHash = await hashPassword(input.password)
  return db.transaction(async (tx) => {
    await findUser(tx, input.id)
    await tx.update(users).set({ passwordHash }).where(eq(users.id, input.id))
    const keep = input.id === auth.user.id ? auth.sessionId : undefined
    return { revokedSessions: await revokeUserSessions(tx, input.id, auth.user, keep) }
  })
}

/** How many past sessions are shown per user (most recent first). */
const SESSIONS_LIMIT = 100

const revoker = alias(users, 'revoker')

/** A user's sessions, newest first; `current` marks the one making this request. */
export async function listUserSessions(db: DbOrTx, auth: Auth, userId: number) {
  const user = await findUser(db, userId)
  const rows = await db
    .select({
      id: sessions.id,
      device: sessions.device,
      userAgent: sessions.userAgent,
      ip: sessions.ip,
      lastIp: sessions.lastIp,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
      revokedAt: sessions.revokedAt,
      revokedBy: { id: revoker.id, username: revoker.username, fullName: revoker.fullName },
    })
    .from(sessions)
    .leftJoin(revoker, eq(revoker.id, sessions.revokedById))
    .where(eq(sessions.userId, userId))
    .orderBy(sql`${sessions.revokedAt} is not null`, desc(sessions.lastSeenAt))
    .limit(SESSIONS_LIMIT)

  return {
    user,
    currentSessionId: auth.sessionId,
    sessions: rows.map((r) => ({ ...r, current: r.id === auth.sessionId })),
  }
}

/** Revokes one session. `current` tells the page it just logged itself out. */
export async function revokeSession(db: DbOrTx, auth: Auth, sessionId: string) {
  const [row] = await db
    .update(sessions)
    .set({ revokedAt: new Date(), revokedById: auth.user.id })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)))
    .returning({ id: sessions.id })

  if (!row) {
    const exists = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.id, sessionId)).limit(1)
    if (!exists.length) throw new TRPCError({ code: 'NOT_FOUND', message: 'Session introuvable' })
    // Already revoked: nothing to do.
  }
  return { revoked: row ? 1 : 0, current: sessionId === auth.sessionId }
}

/** Revokes every open session of a user (the current one too, if it is theirs). */
export async function revokeAllSessions(db: DbOrTx, auth: Auth, userId: number) {
  await findUser(db, userId)
  const revoked = await revokeUserSessions(db, userId, auth.user)
  return { revoked, current: userId === auth.user.id }
}
