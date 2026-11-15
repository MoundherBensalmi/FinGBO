import type { IsoDate } from '@fingbo/shared/common'
import type { MovementCancelInput, MovementInput, MovementUpdateInput } from '@fingbo/shared/movements'
import { TRPCError } from '@trpc/server'
import { and, asc, eq, isNull, lt, sql } from 'drizzle-orm'
import type { DbOrTx } from '../../db'
import { movements } from '../../db/schema'
import { isForeignKeyViolation } from '../../lib/pg-errors'
import type { AuthUser } from '../auth/auth.service'
import { assertCategoryActive } from '../categories/categories.service'
import { toFileView } from '../files/files.service'

/** Input after validation (note trimmed, empty note turned into null). */
type ValidMovement = Omit<MovementInput, 'note'> & { note: string | null }

const signedAmount = sql<string>`coalesce(sum(case when ${movements.direction} = 'in' then ${movements.amount} else -${movements.amount} end), 0)`

const nameOnly = { columns: { id: true, name: true } } as const
const userName = { columns: { id: true, username: true, fullName: true } } as const

/** Related data loaded with each movement (also used by the person statement). */
export const movementWith = {
  person: nameOnly,
  byPerson: nameOnly,
  category: nameOnly,
  createdBy: userName,
  updatedBy: userName,
  cancelledBy: userName,
  files: {
    columns: { id: true, originalName: true, mimeType: true },
    orderBy: (f, { asc: byAsc }) => [byAsc(f.id)],
  },
} as const satisfies NonNullable<Parameters<DbOrTx['query']['movements']['findMany']>[0]>['with']

/** Replaces the raw file rows with links the browser can open. */
export const withMovementFileLinks = <T extends { files: { id: number; originalName: string; mimeType: string | null }[] }>(
  row: T,
) => ({ ...row, files: row.files.map(toFileView('movement')) })

/**
 * Everything the caisse page shows for one day: the balance carried from the
 * previous days, each entry with the balance after it, and the day's totals.
 * Cancelled entries are listed (to keep the trace) but don't count.
 */
export async function getDay(db: DbOrTx, date: IsoDate) {
  const [opening] = await db
    .select({ value: signedAmount })
    .from(movements)
    .where(and(lt(movements.date, date), isNull(movements.cancelledAt)))

  const rows = await db.query.movements.findMany({
    where: eq(movements.date, date),
    orderBy: [asc(movements.createdAt), asc(movements.id)],
    with: movementWith,
  })

  const openingBalance = Number(opening?.value ?? 0)
  let balance = openingBalance
  let totalIn = 0
  let totalOut = 0

  const entries = rows.map((raw) => {
    const row = withMovementFileLinks(raw)
    if (row.cancelledAt) return { ...row, balanceAfter: null }
    if (row.direction === 'in') {
      balance += row.amount
      totalIn += row.amount
    } else {
      balance -= row.amount
      totalOut += row.amount
    }
    return { ...row, balanceAfter: balance }
  })

  return { date, openingBalance, totalIn, totalOut, closingBalance: balance, entries }
}

function rethrowReferenceError(err: unknown): never {
  if (isForeignKeyViolation(err)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Personne ou catégorie introuvable' })
  }
  throw err
}

const toRow = (v: ValidMovement) => ({
  date: v.date,
  direction: v.direction,
  amount: v.amount,
  personId: v.personId,
  byPersonId: v.byPersonId,
  categoryId: v.categoryId,
  note: v.note,
})

export async function createMovement(db: DbOrTx, actor: AuthUser, input: ValidMovement) {
  await assertCategoryActive(db, input.categoryId)
  try {
    const [row] = await db
      .insert(movements)
      .values({ ...toRow(input), createdById: actor.id, updatedById: actor.id })
      .returning({ id: movements.id })
    return row!
  } catch (err) {
    rethrowReferenceError(err)
  }
}

async function findOpenMovement(db: DbOrTx, id: number) {
  const [row] = await db
    .select({ id: movements.id, categoryId: movements.categoryId, cancelledAt: movements.cancelledAt })
    .from(movements)
    .where(eq(movements.id, id))
    .limit(1)
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Entrée introuvable' })
  if (row.cancelledAt) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cette entrée est annulée et ne peut plus être modifiée' })
  }
  return row
}

export async function updateMovement(
  db: DbOrTx,
  actor: AuthUser,
  input: Omit<MovementUpdateInput, 'note'> & { note: string | null },
) {
  const current = await findOpenMovement(db, input.id)
  // Keeping an archived category is fine; switching to one is not.
  if (input.categoryId !== current.categoryId) await assertCategoryActive(db, input.categoryId)

  try {
    await db
      .update(movements)
      .set({ ...toRow(input), updatedById: actor.id })
      .where(and(eq(movements.id, input.id), isNull(movements.cancelledAt)))
    return { id: input.id }
  } catch (err) {
    rethrowReferenceError(err)
  }
}

/** Cancelled entries stay in the journal (struck through) but no longer count. */
export async function cancelMovement(db: DbOrTx, actor: AuthUser, input: MovementCancelInput) {
  await findOpenMovement(db, input.id)
  await db
    .update(movements)
    .set({
      cancelledAt: new Date(),
      cancelledById: actor.id,
      cancelReason: input.reason,
      updatedById: actor.id,
    })
    .where(and(eq(movements.id, input.id), isNull(movements.cancelledAt)))
  return { id: input.id }
}
