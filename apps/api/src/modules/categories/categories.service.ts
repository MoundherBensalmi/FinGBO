import type { CategoryCreateInput } from '@fingbo/shared/categories'
import { TRPCError } from '@trpc/server'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { DbOrTx } from '../../db'
import { categories } from '../../db/schema'
import { isUniqueViolation } from '../../lib/pg-errors'
import type { AuthUser } from '../auth/auth.service'

export async function listCategories(db: DbOrTx) {
  return db
    .select({ id: categories.id, name: categories.name, archivedAt: categories.archivedAt })
    .from(categories)
    .orderBy(sql`lower(${categories.name})`)
}

export async function createCategory(db: DbOrTx, actor: AuthUser, input: CategoryCreateInput) {
  try {
    const [row] = await db
      .insert(categories)
      .values({ name: input.name, createdById: actor.id, updatedById: actor.id })
      .returning({ id: categories.id, name: categories.name, archivedAt: categories.archivedAt })
    return row!
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new TRPCError({ code: 'CONFLICT', message: `La catégorie « ${input.name} » existe déjà` })
    }
    throw err
  }
}

/** New entries may only use a category that exists and is not archived. */
export async function assertCategoryActive(db: DbOrTx, categoryId: number): Promise<void> {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), isNull(categories.archivedAt)))
    .limit(1)
  if (!row) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Catégorie introuvable ou archivée' })
  }
}
