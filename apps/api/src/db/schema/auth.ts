import { relations, sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  check,
  index,
  inet,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { USER_ROLES } from '@fingbo/shared/auth'

/**
 * admin  -> does everything, including managing users and sessions
 * viewer -> can only read the caisse data; cannot see or manage users
 */
export const userRole = pgEnum('user_role', USER_ROLES)

export const users = pgTable(
  'users',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** Login name. Unique regardless of upper/lower case. */
    username: text().notNull(),
    /** argon2 hash, never the password itself. */
    passwordHash: text().notNull(),
    fullName: text(),
    role: userRole().notNull().default('viewer'),
    /** A disabled user cannot log in, and their open sessions stop working. */
    disabledAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    /** Empty only for users created from the command line. */
    createdById: integer().references((): AnyPgColumn => users.id, { onDelete: 'restrict' }),
  },
  (t) => [
    uniqueIndex('users_username_unique').on(sql`lower(${t.username})`),
    check('users_username_not_blank', sql`btrim(${t.username}) <> ''`),
  ],
)

/**
 * One row per login. Its id is put in the JWT (`sid` claim), and every request
 * checks that the session is not revoked, so a token can be killed from the admin
 * panel even though it never expires.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** Login time. */
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** IP address used to log in. */
    ip: inet(),
    /** Raw User-Agent header sent at login. */
    userAgent: text(),
    /** Readable device, e.g. "Samsung SM-A546E · Android 14 · Chrome 131". */
    device: text(),
    /** Last request seen with this session (updated at most every few minutes). */
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastIp: inet(),
    revokedAt: timestamp({ withTimezone: true }),
    /** Admin who revoked it, or the user themself when they log out. */
    revokedById: integer().references(() => users.id, { onDelete: 'restrict' }),
  },
  (t) => [
    index('sessions_user_idx').on(t.userId, t.createdAt),
    check('sessions_revoked_together', sql`num_nulls(${t.revokedAt}, ${t.revokedById}) IN (0, 2)`),
  ],
)

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions, { relationName: 'session_user' }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
    relationName: 'session_user',
  }),
  revokedBy: one(users, {
    fields: [sessions.revokedById],
    references: [users.id],
    relationName: 'session_revoked_by',
  }),
}))

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
