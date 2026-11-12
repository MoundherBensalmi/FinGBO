import { relations } from 'drizzle-orm'
import { index, integer, pgTable } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { fileColumns } from './columns'
import { movements, receipts } from './ledger'

// Files (pictures, PDFs) attached to receipts and to movements.

export const receiptFiles = pgTable(
  'receipt_files',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    receiptId: integer()
      .notNull()
      .references(() => receipts.id, { onDelete: 'cascade' }),
    ...fileColumns(),
  },
  (t) => [index('receipt_files_receipt_idx').on(t.receiptId)],
)

export const movementFiles = pgTable(
  'movement_files',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    movementId: integer()
      .notNull()
      .references(() => movements.id, { onDelete: 'cascade' }),
    ...fileColumns(),
  },
  (t) => [index('movement_files_movement_idx').on(t.movementId)],
)

export const receiptFilesRelations = relations(receiptFiles, ({ one }) => ({
  receipt: one(receipts, { fields: [receiptFiles.receiptId], references: [receipts.id] }),
  createdBy: one(users, {
    fields: [receiptFiles.createdById],
    references: [users.id],
    relationName: 'receipt_file_created_by',
  }),
}))

export const movementFilesRelations = relations(movementFiles, ({ one }) => ({
  movement: one(movements, { fields: [movementFiles.movementId], references: [movements.id] }),
  createdBy: one(users, {
    fields: [movementFiles.createdById],
    references: [users.id],
    relationName: 'movement_file_created_by',
  }),
}))

export type ReceiptFile = typeof receiptFiles.$inferSelect
export type MovementFile = typeof movementFiles.$inferSelect
