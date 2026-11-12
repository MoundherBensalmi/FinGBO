import { relations, sql } from 'drizzle-orm'
import { check, date, index, integer, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { cancellation, cancelledTogether, money, tracking } from './columns'
import { movementFiles, receiptFiles } from './files'

// ---------------------------------------------------------------------------
// People: everyone you buy from, pay, receive money from, or send on errands
// ---------------------------------------------------------------------------

export const people = pgTable(
  'people',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    phone: text(),
    address: text(),
    occupation: text(),
    note: text(),
    ...tracking(),
  },
  (t) => [
    index('people_name_idx').on(t.name),
    check('people_name_not_blank', sql`btrim(${t.name}) <> ''`),
  ],
)

// ---------------------------------------------------------------------------
// Receipts: what you bought from a person (adds to what you owe them)
// ---------------------------------------------------------------------------

export const receipts = pgTable(
  'receipts',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    personId: integer()
      .notNull()
      .references(() => people.id, { onDelete: 'restrict' }),
    date: date({ mode: 'string' }).notNull(),
    amount: money(),
    note: text(),
    ...tracking(),
    ...cancellation(),
  },
  (t) => [
    index('receipts_person_date_idx').on(t.personId, t.date),
    index('receipts_date_idx').on(t.date),
    check('receipts_amount_positive', sql`${t.amount} > 0`),
    cancelledTogether('receipts_cancelled_together', t),
  ],
)

// ---------------------------------------------------------------------------
// Movements: money in and out of the caisse
//   in  -> person is who the money came from
//   out -> person is who was paid (reduces what you owe them)
//   by  -> optional person who carried the money
// ---------------------------------------------------------------------------

export const movementDirection = pgEnum('movement_direction', ['in', 'out'])

export const movements = pgTable(
  'movements',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    date: date({ mode: 'string' }).notNull(),
    direction: movementDirection().notNull(),
    amount: money(),
    personId: integer()
      .notNull()
      .references(() => people.id, { onDelete: 'restrict' }),
    byPersonId: integer().references(() => people.id, { onDelete: 'restrict' }),
    note: text(),
    ...tracking(),
    ...cancellation(),
  },
  (t) => [
    index('movements_date_idx').on(t.date),
    index('movements_person_date_idx').on(t.personId, t.date),
    index('movements_by_person_idx').on(t.byPersonId),
    check('movements_amount_positive', sql`${t.amount} > 0`),
    check('movements_by_is_not_person', sql`${t.byPersonId} <> ${t.personId}`),
    cancelledTogether('movements_cancelled_together', t),
  ],
)

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const peopleRelations = relations(people, ({ one, many }) => ({
  receipts: many(receipts),
  movements: many(movements, { relationName: 'movement_person' }),
  carriedMovements: many(movements, { relationName: 'movement_by_person' }),
  createdBy: one(users, {
    fields: [people.createdById],
    references: [users.id],
    relationName: 'person_created_by',
  }),
}))

export const receiptsRelations = relations(receipts, ({ one, many }) => ({
  person: one(people, { fields: [receipts.personId], references: [people.id] }),
  files: many(receiptFiles),
  createdBy: one(users, {
    fields: [receipts.createdById],
    references: [users.id],
    relationName: 'receipt_created_by',
  }),
  updatedBy: one(users, {
    fields: [receipts.updatedById],
    references: [users.id],
    relationName: 'receipt_updated_by',
  }),
  cancelledBy: one(users, {
    fields: [receipts.cancelledById],
    references: [users.id],
    relationName: 'receipt_cancelled_by',
  }),
}))

export const movementsRelations = relations(movements, ({ one, many }) => ({
  person: one(people, {
    fields: [movements.personId],
    references: [people.id],
    relationName: 'movement_person',
  }),
  byPerson: one(people, {
    fields: [movements.byPersonId],
    references: [people.id],
    relationName: 'movement_by_person',
  }),
  files: many(movementFiles),
  createdBy: one(users, {
    fields: [movements.createdById],
    references: [users.id],
    relationName: 'movement_created_by',
  }),
  updatedBy: one(users, {
    fields: [movements.updatedById],
    references: [users.id],
    relationName: 'movement_updated_by',
  }),
  cancelledBy: one(users, {
    fields: [movements.cancelledById],
    references: [users.id],
    relationName: 'movement_cancelled_by',
  }),
}))

export type Person = typeof people.$inferSelect
export type NewPerson = typeof people.$inferInsert
export type Receipt = typeof receipts.$inferSelect
export type NewReceipt = typeof receipts.$inferInsert
export type Movement = typeof movements.$inferSelect
export type NewMovement = typeof movements.$inferInsert
