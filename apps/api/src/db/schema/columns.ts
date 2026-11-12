import { sql } from 'drizzle-orm'
import { type AnyPgColumn, bigint, check, integer, text, timestamp } from 'drizzle-orm/pg-core'
import { users } from './auth'

/** Money is stored in centimes (1 DA = 100) as a whole number, never as a decimal. */
export const money = () => bigint({ mode: 'number' }).notNull()

/** When and by whom a record was created and last changed. */
export const tracking = () => ({
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  createdById: integer()
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  updatedById: integer()
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
})

/**
 * Entries are cancelled, not deleted, so the caisse history always reconciles.
 * Every balance query must filter on `cancelled_at IS NULL`.
 */
export const cancellation = () => ({
  cancelledAt: timestamp({ withTimezone: true }),
  cancelledById: integer().references(() => users.id, { onDelete: 'restrict' }),
  cancelReason: text(),
})

/** The three cancellation columns are either all empty or all filled. */
export const cancelledTogether = (
  name: string,
  t: { cancelledAt: AnyPgColumn; cancelledById: AnyPgColumn; cancelReason: AnyPgColumn },
) => check(name, sql`num_nulls(${t.cancelledAt}, ${t.cancelledById}, ${t.cancelReason}) IN (0, 3)`)

export const fileColumns = () => ({
  /** Object key in the MinIO / S3 bucket, e.g. "receipts/2027/01/3f9c...e1.jpg". */
  storageKey: text().notNull(),
  originalName: text().notNull(),
  mimeType: text(),
  /** Who uploaded the file. */
  createdById: integer()
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
})
