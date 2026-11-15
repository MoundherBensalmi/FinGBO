import { relations, sql } from 'drizzle-orm'
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { users } from './auth'
import { cancellation, cancelledTogether, money, tracking } from './columns'
import { movementFiles, receiptFiles } from './files'

// ---------------------------------------------------------------------------
// Categories: what a receipt or movement is for (Carburant, Maintenance, Cantine...)
// Required on every receipt and movement. Archived instead of deleted, so old
// entries keep their category; archived ones are just hidden from the forms.
// ---------------------------------------------------------------------------

export const categories = pgTable(
  'categories',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    archivedAt: timestamp({ withTimezone: true }),
    ...tracking(),
  },
  (t) => [
    uniqueIndex('categories_name_unique').on(sql`lower(${t.name})`),
    check('categories_name_not_blank', sql`btrim(${t.name}) <> ''`),
  ],
)

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
    /** Pre-selected in the receipt and movement forms when this person is chosen. */
    defaultCategoryId: integer().references(() => categories.id, { onDelete: 'restrict' }),
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
    categoryId: integer()
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    note: text(),
    ...tracking(),
    ...cancellation(),
  },
  (t) => [
    index('receipts_person_date_idx').on(t.personId, t.date),
    index('receipts_date_idx').on(t.date),
    index('receipts_category_date_idx').on(t.categoryId, t.date),
    check('receipts_amount_positive', sql`${t.amount} > 0`),
    cancelledTogether('receipts_cancelled_together', t),
  ],
)

// ---------------------------------------------------------------------------
// Movements: money in and out of the caisse
//   in  -> person is who the money came from (usually the owner). Never a debt:
//          it is only shown on their page as "received from them".
//   out -> person is who was paid (reduces what you owe them).
//   no person -> a one-off expense that changes nobody's balance
//                (e.g. something bought once from an unknown seller); the note says what it was
//   by  -> optional person who carried the money
//   amount 0 -> allowed, to keep a trace (e.g. a loan given back); the note must explain it.
//
// A person's balance (what you owe them) = their receipts - their "out" movements.
// ---------------------------------------------------------------------------

export const movementDirection = pgEnum('movement_direction', ['in', 'out'])

export const movements = pgTable(
  'movements',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    date: date({ mode: 'string' }).notNull(),
    direction: movementDirection().notNull(),
    amount: money(),
    personId: integer().references(() => people.id, { onDelete: 'restrict' }),
    byPersonId: integer().references(() => people.id, { onDelete: 'restrict' }),
    categoryId: integer()
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    note: text(),
    ...tracking(),
    ...cancellation(),
  },
  (t) => [
    index('movements_date_idx').on(t.date),
    index('movements_category_date_idx').on(t.categoryId, t.date),
    index('movements_person_date_idx').on(t.personId, t.date),
    index('movements_by_person_idx').on(t.byPersonId),
    check('movements_amount_not_negative', sql`${t.amount} >= 0`),
    check(
      'movements_zero_amount_has_note',
      sql`${t.amount} <> 0 OR btrim(coalesce(${t.note}, '')) <> ''`,
    ),
    check('movements_by_is_not_person', sql`${t.byPersonId} <> ${t.personId}`),
    check(
      'movements_person_or_note',
      sql`${t.personId} IS NOT NULL OR btrim(coalesce(${t.note}, '')) <> ''`,
    ),
    cancelledTogether('movements_cancelled_together', t),
  ],
)

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const categoriesRelations = relations(categories, ({ many }) => ({
  receipts: many(receipts),
  movements: many(movements),
  people: many(people),
}))

export const peopleRelations = relations(people, ({ one, many }) => ({
  defaultCategory: one(categories, {
    fields: [people.defaultCategoryId],
    references: [categories.id],
  }),
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
  category: one(categories, { fields: [receipts.categoryId], references: [categories.id] }),
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
  category: one(categories, { fields: [movements.categoryId], references: [categories.id] }),
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

export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert
export type Person = typeof people.$inferSelect
export type NewPerson = typeof people.$inferInsert
export type Receipt = typeof receipts.$inferSelect
export type NewReceipt = typeof receipts.$inferInsert
export type Movement = typeof movements.$inferSelect
export type NewMovement = typeof movements.$inferInsert
