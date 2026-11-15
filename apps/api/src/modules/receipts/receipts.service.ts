import type { ReceiptCancelInput, ReceiptInput, ReceiptUpdateInput } from '@fingbo/shared/receipts'
import { TRPCError } from '@trpc/server'
import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm'
import type { DbOrTx } from '../../db'
import { receipts } from '../../db/schema'
import { isForeignKeyViolation } from '../../lib/pg-errors'
import type { AuthUser } from '../auth/auth.service'
import { assertCategoryActive } from '../categories/categories.service'
import { toFileView } from '../files/files.service'

type ValidReceipt = Omit<ReceiptInput, 'note'> & { note: string | null }

const nameOnly = { columns: { id: true, name: true } } as const
const userName = { columns: { id: true, username: true, fullName: true } } as const

/** Related data loaded with each receipt (also used by the person statement). */
export const receiptWith = {
  person: nameOnly,
  category: nameOnly,
  createdBy: userName,
  updatedBy: userName,
  cancelledBy: userName,
  files: {
    columns: { id: true, originalName: true, mimeType: true },
    orderBy: (f, { asc: byAsc }) => [byAsc(f.id)],
  },
} as const satisfies NonNullable<Parameters<DbOrTx['query']['receipts']['findMany']>[0]>['with']

export const withReceiptFileLinks = <T extends { files: { id: number; originalName: string; mimeType: string | null }[] }>(
  row: T,
) => ({ ...row, files: row.files.map(toFileView('receipt')) })

/** Receipts between two days (inclusive), optionally for one person, with the total. */
export async function listReceipts(db: DbOrTx, input: { from: string; to: string; personId?: number | undefined }) {
  const rows = await db.query.receipts.findMany({
    where: and(
      gte(receipts.date, input.from),
      lte(receipts.date, input.to),
      input.personId ? eq(receipts.personId, input.personId) : undefined,
    ),
    orderBy: [asc(receipts.date), asc(receipts.createdAt), asc(receipts.id)],
    with: receiptWith,
  })
  const entries = rows.map(withReceiptFileLinks)
  const active = entries.filter((r) => !r.cancelledAt)
  return {
    from: input.from,
    to: input.to,
    total: active.reduce((sum, r) => sum + r.amount, 0),
    count: active.length,
    entries,
  }
}

function rethrowReferenceError(err: unknown): never {
  if (isForeignKeyViolation(err)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Personne ou catégorie introuvable' })
  }
  throw err
}

const toRow = (v: ValidReceipt) => ({
  date: v.date,
  personId: v.personId,
  amount: v.amount,
  categoryId: v.categoryId,
  note: v.note,
})

export async function createReceipt(db: DbOrTx, actor: AuthUser, input: ValidReceipt) {
  await assertCategoryActive(db, input.categoryId)
  try {
    const [row] = await db
      .insert(receipts)
      .values({ ...toRow(input), createdById: actor.id, updatedById: actor.id })
      .returning({ id: receipts.id })
    return row!
  } catch (err) {
    rethrowReferenceError(err)
  }
}

async function findOpenReceipt(db: DbOrTx, id: number) {
  const [row] = await db
    .select({ id: receipts.id, categoryId: receipts.categoryId, cancelledAt: receipts.cancelledAt })
    .from(receipts)
    .where(eq(receipts.id, id))
    .limit(1)
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Reçu introuvable' })
  if (row.cancelledAt) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ce reçu est annulé et ne peut plus être modifié' })
  }
  return row
}

export async function updateReceipt(
  db: DbOrTx,
  actor: AuthUser,
  input: Omit<ReceiptUpdateInput, 'note'> & { note: string | null },
) {
  const current = await findOpenReceipt(db, input.id)
  if (input.categoryId !== current.categoryId) await assertCategoryActive(db, input.categoryId)
  try {
    await db
      .update(receipts)
      .set({ ...toRow(input), updatedById: actor.id })
      .where(and(eq(receipts.id, input.id), isNull(receipts.cancelledAt)))
    return { id: input.id }
  } catch (err) {
    rethrowReferenceError(err)
  }
}

/** Cancelled receipts stay visible (struck through) but no longer count in what you owe. */
export async function cancelReceipt(db: DbOrTx, actor: AuthUser, input: ReceiptCancelInput) {
  await findOpenReceipt(db, input.id)
  await db
    .update(receipts)
    .set({ cancelledAt: new Date(), cancelledById: actor.id, cancelReason: input.reason, updatedById: actor.id })
    .where(and(eq(receipts.id, input.id), isNull(receipts.cancelledAt)))
  return { id: input.id }
}
