import type { PersonUpdateInput } from '@fingbo/shared/people'
import { TRPCError } from '@trpc/server'
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import type { DbOrTx } from '../../db'
import { movements, people, receipts } from '../../db/schema'
import type { AuthUser } from '../auth/auth.service'
import { assertCategoryActive } from '../categories/categories.service'
import { movementWith, withMovementFileLinks } from '../movements/movements.service'
import { receiptWith, withReceiptFileLinks } from '../receipts/receipts.service'

// A person's balance (what you owe them) = their receipts - the money paid out to them.
// Money received from them ("in") never creates a debt; it is only shown as a total.

const pickerColumns = {
  id: people.id,
  name: people.name,
  occupation: people.occupation,
  defaultCategoryId: people.defaultCategoryId,
}

/** Everyone, for the pickers in the forms. */
export async function listPeople(db: DbOrTx) {
  return db.select(pickerColumns).from(people).orderBy(sql`lower(${people.name})`)
}

const num = (value: unknown) => Number(value ?? 0)

/** Everyone with their totals, for the people page. */
export async function listBalances(db: DbOrTx) {
  const r = db
    .select({
      personId: receipts.personId,
      total: sql<string>`sum(${receipts.amount})`.as('receipts_total'),
      last: sql<string>`max(${receipts.date})`.as('receipts_last'),
    })
    .from(receipts)
    .where(isNull(receipts.cancelledAt))
    .groupBy(receipts.personId)
    .as('r')

  const m = db
    .select({
      personId: movements.personId,
      paid: sql<string>`coalesce(sum(${movements.amount}) filter (where ${movements.direction} = 'out'), 0)`.as('paid'),
      received: sql<string>`coalesce(sum(${movements.amount}) filter (where ${movements.direction} = 'in'), 0)`.as('received'),
      last: sql<string>`max(${movements.date})`.as('movements_last'),
    })
    .from(movements)
    .where(and(isNull(movements.cancelledAt), isNotNull(movements.personId)))
    .groupBy(movements.personId)
    .as('m')

  const rows = await db
    .select({
      id: people.id,
      name: people.name,
      phone: people.phone,
      occupation: people.occupation,
      receiptsTotal: sql<string>`coalesce(${r.total}, 0)`,
      paidTotal: sql<string>`coalesce(${m.paid}, 0)`,
      receivedTotal: sql<string>`coalesce(${m.received}, 0)`,
      lastDate: sql<string | null>`greatest(${r.last}, ${m.last})`,
    })
    .from(people)
    .leftJoin(r, eq(r.personId, people.id))
    .leftJoin(m, eq(m.personId, people.id))
    .orderBy(sql`lower(${people.name})`)

  return rows.map((row) => {
    const receiptsTotal = num(row.receiptsTotal)
    const paidTotal = num(row.paidTotal)
    return {
      ...row,
      receiptsTotal,
      paidTotal,
      receivedTotal: num(row.receivedTotal),
      balance: receiptsTotal - paidTotal,
    }
  })
}

/**
 * What you still owe, from the receipts: everyone whose balance is above 0, with the
 * receipts not yet paid. Payments settle the oldest receipts first, so the open receipts
 * are the newest ones; the oldest of them may be partly paid (`remaining` < `amount`).
 */
export async function listDebts(db: DbOrTx) {
  const owed = (await listBalances(db)).filter((p) => p.balance > 0)
  if (owed.length === 0) return { total: 0, people: [] }

  const rows = await db.query.receipts.findMany({
    where: and(isNull(receipts.cancelledAt), inArray(receipts.personId, owed.map((p) => p.id))),
    orderBy: [asc(receipts.date), asc(receipts.createdAt), asc(receipts.id)],
    columns: { id: true, personId: true, date: true, amount: true, note: true },
    with: { category: { columns: { id: true, name: true } } },
  })

  const byPerson = new Map<number, typeof rows>()
  for (const row of rows) {
    const list = byPerson.get(row.personId)
    if (list) list.push(row)
    else byPerson.set(row.personId, [row])
  }

  const result = owed.map((p) => {
    let paidLeft = p.paidTotal
    const openReceipts = []
    for (const r of byPerson.get(p.id) ?? []) {
      const settled = Math.min(paidLeft, r.amount)
      paidLeft -= settled
      if (settled < r.amount) openReceipts.push({ ...r, remaining: r.amount - settled })
    }
    return {
      id: p.id,
      name: p.name,
      phone: p.phone,
      occupation: p.occupation,
      receiptsTotal: p.receiptsTotal,
      paidTotal: p.paidTotal,
      balance: p.balance,
      lastDate: p.lastDate,
      oldestOpenDate: openReceipts[0]?.date ?? null,
      openReceipts,
    }
  })

  result.sort((a, b) => b.balance - a.balance)
  return { total: result.reduce((s, p) => s + p.balance, 0), people: result }
}

async function findPerson(db: DbOrTx, id: number) {
  const person = await db.query.people.findFirst({
    where: eq(people.id, id),
    with: {
      defaultCategory: { columns: { id: true, name: true } },
      createdBy: { columns: { id: true, username: true, fullName: true } },
    },
  })
  if (!person) throw new TRPCError({ code: 'NOT_FOUND', message: 'Personne introuvable' })
  return person
}

/**
 * A person's page: their details, their account (receipts and payments in date
 * order with the running balance), money received from them, and what they carried.
 */
export async function getPersonAccount(db: DbOrTx, id: number) {
  const person = await findPerson(db, id)

  const [personReceipts, personMovements, carried] = await Promise.all([
    db.query.receipts.findMany({
      where: eq(receipts.personId, id),
      orderBy: [asc(receipts.date), asc(receipts.createdAt)],
      with: receiptWith,
    }),
    db.query.movements.findMany({
      where: eq(movements.personId, id),
      orderBy: [asc(movements.date), asc(movements.time), asc(movements.createdAt)],
      with: movementWith,
    }),
    db.query.movements.findMany({
      where: eq(movements.byPersonId, id),
      orderBy: [desc(movements.date), desc(movements.time), desc(movements.createdAt)],
      limit: 300,
      with: movementWith,
    }),
  ])

  type Line =
    | { type: 'receipt'; entry: ReturnType<typeof withReceiptFileLinks<(typeof personReceipts)[number]>> }
    | { type: 'movement'; entry: ReturnType<typeof withMovementFileLinks<(typeof personMovements)[number]>> }

  // Day by day. Within a day: the receipts first (they have no time), then the movements
  // in the order of their time. The sort is stable, so each list keeps the order it came in.
  const lines: Line[] = [
    ...personReceipts.map((r) => ({ type: 'receipt' as const, entry: withReceiptFileLinks(r) })),
    ...personMovements.map((m) => ({ type: 'movement' as const, entry: withMovementFileLinks(m) })),
  ].sort((a, b) => a.entry.date.localeCompare(b.entry.date))

  let balance = 0
  let receiptsTotal = 0
  let paidTotal = 0
  let receivedTotal = 0

  const statement = lines.map((line) => {
    if (line.entry.cancelledAt) return { ...line, balanceAfter: null }
    if (line.type === 'receipt') {
      balance += line.entry.amount
      receiptsTotal += line.entry.amount
    } else if (line.entry.direction === 'out') {
      balance -= line.entry.amount
      paidTotal += line.entry.amount
    } else {
      receivedTotal += line.entry.amount // informative only, not a debt
    }
    return { ...line, balanceAfter: balance }
  })

  return {
    person,
    totals: { receiptsTotal, paidTotal, receivedTotal, balance },
    statement,
    carried: carried.map(withMovementFileLinks),
  }
}

/** Person input after validation (empty texts already turned into null). */
type ValidPerson = {
  name: string
  phone: string | null
  address: string | null
  occupation: string | null
  note: string | null
  defaultCategoryId: number | null
}

const toRow = (v: ValidPerson) => ({
  name: v.name,
  phone: v.phone,
  address: v.address,
  occupation: v.occupation,
  note: v.note,
  defaultCategoryId: v.defaultCategoryId,
})

export async function createPerson(db: DbOrTx, actor: AuthUser, input: ValidPerson) {
  if (input.defaultCategoryId !== null) await assertCategoryActive(db, input.defaultCategoryId)
  const [row] = await db
    .insert(people)
    .values({ ...toRow(input), createdById: actor.id, updatedById: actor.id })
    .returning(pickerColumns)
  return row!
}

export async function updatePerson(db: DbOrTx, actor: AuthUser, input: ValidPerson & Pick<PersonUpdateInput, 'id'>) {
  const current = await findPerson(db, input.id)
  if (input.defaultCategoryId !== null && input.defaultCategoryId !== current.defaultCategoryId) {
    await assertCategoryActive(db, input.defaultCategoryId)
  }
  const [row] = await db
    .update(people)
    .set({ ...toRow(input), updatedById: actor.id })
    .where(eq(people.id, input.id))
    .returning(pickerColumns)
  return row!
}
