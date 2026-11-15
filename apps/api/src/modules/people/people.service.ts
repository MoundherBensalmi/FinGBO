import type { PersonCreateInput } from '@fingbo/shared/people'
import { sql } from 'drizzle-orm'
import type { DbOrTx } from '../../db'
import { people } from '../../db/schema'
import type { AuthUser } from '../auth/auth.service'
import { assertCategoryActive } from '../categories/categories.service'

const listColumns = {
  id: people.id,
  name: people.name,
  occupation: people.occupation,
  defaultCategoryId: people.defaultCategoryId,
}

/** Everyone, for the pickers in the forms. */
export async function listPeople(db: DbOrTx) {
  return db.select(listColumns).from(people).orderBy(sql`lower(${people.name})`)
}

export async function createPerson(db: DbOrTx, actor: AuthUser, input: PersonCreateInput) {
  const defaultCategoryId = input.defaultCategoryId ?? null
  if (defaultCategoryId !== null) await assertCategoryActive(db, defaultCategoryId)

  const [row] = await db
    .insert(people)
    .values({ name: input.name, defaultCategoryId, createdById: actor.id, updatedById: actor.id })
    .returning(listColumns)
  return row!
}
