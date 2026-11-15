/**
 * Imports one year of the old CAISSE desktop app into FinGBO.
 *
 *   1. Export the old database to JSON (see export-old-caisse.ps1):
 *        powershell -ExecutionPolicy Bypass -File src/scripts/export-old-caisse.ps1 -AppDir <old app> -OutDir <folder>
 *   2. Look at what would be imported, then write it:
 *        pnpm --filter @fingbo/api import:caisse --dir <folder> --year 2026 --username moundher
 *        pnpm --filter @fingbo/api import:caisse --dir <folder> --year 2026 --username moundher --apply
 *
 * Everything happens in one transaction; without --apply it is rolled back at the end.
 *
 *   - The old expense types and people used that year become categories and people
 *     (a category or person that already exists with the same name is reused).
 *   - Every old entry becomes a movement on its day, at its original time:
 *     "entrée" -> in, "sortie" -> out, an entry with both -> one of each.
 *     The old app could not save an entry at 0, so a trace was typed as 1 DA in and
 *     1 DA out; it becomes one movement at 0.
 *   - The caisse balance left by the earlier years becomes one opening entry on 1 January.
 *   - The old app had no receipts, so everyone who was paid would look like they owe money.
 *     Each of them gets one initial receipt on 1 January, equal to everything paid to them
 *     that year, which brings their balance to 0.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { type Centimes, MAX_CENTIMES, formatDA } from '@fingbo/shared/money'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { type Tx, client, db } from '../db'
import { type NewMovement, type NewReceipt, categories, movements, people, receipts, users } from '../db/schema'
import { listBalances } from '../modules/people/people.service'

/** The old app saved local Algerian time, which is UTC+1 all year. */
const OLD_APP_UTC_OFFSET = '+01:00'
/** How the old app's users recorded a trace: 1 DA in and 1 DA out on the same entry. */
const TRACE_CENTIMES = 100
const OPENING_CATEGORY = 'Caisse'
const INSERT_CHUNK = 500

const argsSchema = z.object({
  dir: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  username: z.string().trim().min(1),
  apply: z.boolean().default(false),
})

const amountText = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/)
  .nullable()
  .transform((v) => v ?? '0')
const optionalText = z
  .string()
  .nullable()
  .transform((v) => v?.trim() || null)

const entrySchema = z.object({
  ID: z.number().int(),
  DateDepense: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/),
  IdPersonne: z.number().int(),
  IdType: z.number().int(),
  SommeEntree: amountText,
  SommeSortie: amountText,
  Observation: optionalText,
})
const oldPersonSchema = z.object({
  ID: z.number().int(),
  Nom: z.string().trim().min(1),
  Telephone: optionalText,
  Adresse: optionalText,
  Observation: optionalText,
})
const oldTypeSchema = z.object({ ID: z.number().int(), Designation: z.string().trim() })

type Entry = z.infer<typeof entrySchema>

function load<T>(dir: string, file: string, schema: z.ZodType<T>): T[] {
  const text = readFileSync(join(dir, file), 'utf8').replace(/^﻿/, '')
  return z.array(schema).parse(JSON.parse(text))
}

/** "1250.5" -> 125050, without floating-point maths. */
function toCentimes(text: string): number {
  const [dinars = '0', decimals = ''] = text.split('.')
  if (/[1-9]/.test(decimals.slice(2))) throw new Error(`The amount ${text} has more than 2 decimals.`)
  const value = Number(dinars) * 100 + Number(decimals.slice(0, 2).padEnd(2, '0'))
  if (!Number.isSafeInteger(value) || value > MAX_CENTIMES) throw new Error(`The amount ${text} is too large.`)
  return value
}

const da = (amount: number) => formatDA(amount as Centimes)
const key = (name: string) => name.trim().toLowerCase()
const dayOf = (entry: Entry) => entry.DateDepense.slice(0, 10)

/** The value seen most often; when two are level, the one seen last wins. */
function mostUsed(values: number[]): number | null {
  const counts = new Map<number, number>()
  let best: number | null = null
  for (const value of values) {
    const count = (counts.get(value) ?? 0) + 1
    counts.set(value, count)
    if (best === null || count >= (counts.get(best) ?? 0)) best = value
  }
  return best
}

async function caisseBalance(tx: Tx): Promise<number> {
  const [row] = await tx
    .select({
      value: sql<string>`coalesce(sum(case when ${movements.direction} = 'in' then ${movements.amount} else -${movements.amount} end), 0)`,
    })
    .from(movements)
    .where(isNull(movements.cancelledAt))
  return Number(row?.value ?? 0)
}

/** Thrown at the end of a run without --apply, so the transaction is rolled back. */
class DryRun extends Error {}

async function main() {
  const { values } = parseArgs({
    options: {
      dir: { type: 'string' },
      year: { type: 'string' },
      username: { type: 'string' },
      apply: { type: 'boolean' },
    },
  })
  const parsed = argsSchema.safeParse(values)
  if (!parsed.success) {
    console.error(z.prettifyError(parsed.error))
    console.error('\nUsage: import:caisse --dir <export folder> --year <year> --username <user> [--apply]')
    process.exitCode = 1
    return
  }
  const { dir, year, username, apply } = parsed.data

  const allEntries = load(dir, 'Depense.json', entrySchema).sort(
    (a, b) => a.DateDepense.localeCompare(b.DateDepense) || a.ID - b.ID,
  )
  const oldPeople = new Map(load(dir, 'Personne.json', oldPersonSchema).map((p) => [p.ID, p]))
  const oldTypes = new Map(load(dir, 'TypeDepense.json', oldTypeSchema).map((t) => [t.ID, t]))

  const yearStart = `${year}-01-01`
  const yearStartTime = new Date(`${yearStart}T00:00:00${OLD_APP_UTC_OFFSET}`)
  const entries = allEntries.filter((e) => e.DateDepense.startsWith(`${year}-`))
  if (entries.length === 0) throw new Error(`The export has no entry in ${year}.`)

  /** What the earlier years left in the caisse. */
  const carried = allEntries
    .filter((e) => dayOf(e) < yearStart)
    .reduce((sum, e) => sum + toCentimes(e.SommeEntree) - toCentimes(e.SommeSortie), 0)

  const initialCategory = `Reprise ${year}`
  const lines: string[] = []

  await db.transaction(async (tx) => {
    const [actor] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(sql`lower(${users.username})`, username.toLowerCase()), isNull(users.disabledAt)))
      .limit(1)
    if (!actor) throw new Error(`No active user named "${username}".`)
    const tracking = { createdById: actor.id, updatedById: actor.id }

    const balanceBefore = await caisseBalance(tx)

    // --- Categories -------------------------------------------------------
    const categoryByName = new Map(
      (await tx.select({ id: categories.id, name: categories.name }).from(categories)).map((c) => [key(c.name), c.id]),
    )
    if (categoryByName.has(key(initialCategory))) {
      throw new Error(`The category "${initialCategory}" already exists: ${year} was already imported.`)
    }
    let categoriesCreated = 0
    const categoryId = async (name: string): Promise<number> => {
      const existing = categoryByName.get(key(name))
      if (existing !== undefined) return existing
      const [row] = await tx.insert(categories).values({ name, ...tracking }).returning({ id: categories.id })
      categoryByName.set(key(name), row!.id)
      categoriesCreated++
      return row!.id
    }

    const categoryOfType = new Map<number, number>()
    for (const typeId of new Set(entries.map((e) => e.IdType))) {
      const name = oldTypes.get(typeId)?.Designation
      if (!name) throw new Error(`Old expense type ${typeId} has no name.`)
      categoryOfType.set(typeId, await categoryId(name))
    }

    // --- People -----------------------------------------------------------
    const existingPeople = new Map<string, number[]>()
    for (const p of await tx.select({ id: people.id, name: people.name }).from(people)) {
      existingPeople.set(key(p.name), [...(existingPeople.get(key(p.name)) ?? []), p.id])
    }

    const personOfOld = new Map<number, number>()
    const usedNames = new Map<string, number>()
    let peopleCreated = 0
    for (const oldId of new Set(entries.map((e) => e.IdPersonne))) {
      const old = oldPeople.get(oldId)
      if (!old) throw new Error(`Old person ${oldId} is missing from Personne.json.`)
      const name = key(old.Nom)
      if (usedNames.has(name)) throw new Error(`Two old people are named "${old.Nom}".`)
      usedNames.set(name, oldId)

      const matches = existingPeople.get(name) ?? []
      if (matches.length > 1) throw new Error(`Several people are already named "${old.Nom}" in FinGBO.`)
      if (matches[0] !== undefined) {
        personOfOld.set(oldId, matches[0])
        continue
      }

      const usualType = mostUsed(entries.filter((e) => e.IdPersonne === oldId).map((e) => e.IdType))
      const [row] = await tx
        .insert(people)
        .values({
          name: old.Nom,
          phone: old.Telephone,
          address: old.Adresse,
          note: old.Observation,
          defaultCategoryId: usualType === null ? null : (categoryOfType.get(usualType) ?? null),
          ...tracking,
        })
        .returning({ id: people.id })
      personOfOld.set(oldId, row!.id)
      peopleCreated++
    }

    // --- Movements --------------------------------------------------------
    const movementRows: NewMovement[] = []
    const paid = new Map<number, number>()
    let totalIn = 0
    let totalOut = 0
    let traces = 0

    if (carried !== 0) {
      movementRows.push({
        date: yearStart,
        time: '00:00:00',
        direction: carried > 0 ? 'in' : 'out',
        amount: Math.abs(carried),
        personId: null,
        categoryId: await categoryId(OPENING_CATEGORY),
        note: `Report du solde de l'ancienne caisse au 31/12/${year - 1}`,
        createdAt: yearStartTime,
        ...tracking,
      })
    }

    for (const entry of entries) {
      const personId = personOfOld.get(entry.IdPersonne)!
      const amountIn = toCentimes(entry.SommeEntree)
      const amountOut = toCentimes(entry.SommeSortie)
      const base = {
        date: dayOf(entry),
        time: entry.DateDepense.slice(11),
        personId,
        categoryId: categoryOfType.get(entry.IdType)!,
        note: entry.Observation,
        createdAt: new Date(`${entry.DateDepense}${OLD_APP_UTC_OFFSET}`),
        ...tracking,
      }

      const isTrace = amountIn === amountOut && (amountIn === TRACE_CENTIMES || amountIn === 0)
      if (isTrace) {
        // A movement at 0 must say what it is.
        movementRows.push({ ...base, direction: 'in', amount: 0, note: base.note ?? "Trace reprise de l'ancienne caisse" })
        traces++
        continue
      }
      if (amountIn > 0) {
        movementRows.push({ ...base, direction: 'in', amount: amountIn })
        totalIn += amountIn
      }
      if (amountOut > 0) {
        movementRows.push({ ...base, direction: 'out', amount: amountOut })
        totalOut += amountOut
        paid.set(personId, (paid.get(personId) ?? 0) + amountOut)
      }
    }

    for (let i = 0; i < movementRows.length; i += INSERT_CHUNK) {
      await tx.insert(movements).values(movementRows.slice(i, i + INSERT_CHUNK))
    }

    // --- Initial receipts: one per person who was paid, equal to what they were paid ---
    const initialCategoryId = await categoryId(initialCategory)
    const receiptRows: NewReceipt[] = [...paid].map(([personId, amount]) => {
      if (amount > MAX_CENTIMES) throw new Error(`The payments to person ${personId} add up to too much for one receipt.`)
      return {
        date: yearStart,
        personId,
        amount,
        categoryId: initialCategoryId,
        note: `Reçu initial : total des paiements de ${year} repris de l'ancienne caisse (solde ramené à 0)`,
        // Midnight on 1 January, so it comes before that day's payments in the person's account.
        createdAt: yearStartTime,
        ...tracking,
      }
    })
    for (let i = 0; i < receiptRows.length; i += INSERT_CHUNK) {
      await tx.insert(receipts).values(receiptRows.slice(i, i + INSERT_CHUNK))
    }

    // --- Checks, with the same balance calculation the app shows ----------
    const imported = new Set(personOfOld.values())
    const balances = (await listBalances(tx)).filter((p) => imported.has(p.id))
    const notZero = balances.filter((p) => p.balance !== 0)
    const balanceAfter = await caisseBalance(tx)
    const oldCaisse = carried + totalIn - totalOut

    lines.push(
      `Old entries of ${year}: ${entries.length} (${dayOf(entries[0]!)} to ${dayOf(entries.at(-1)!)})`,
      `Categories: ${categoryOfType.size} used, ${categoriesCreated} created (with "${initialCategory}")`,
      `People: ${personOfOld.size} used, ${peopleCreated} created, ${personOfOld.size - peopleCreated} already there`,
      `Movements: ${movementRows.length} (in ${da(totalIn)}, out ${da(totalOut)}, ${traces} traces at 0)`,
      `Opening balance carried from before ${year}: ${da(carried)}`,
      `Initial receipts: ${receiptRows.length}, total ${da(totalOut)}`,
      '',
      'Paid in the year = initial receipt:',
      ...balances
        .filter((p) => paid.has(p.id))
        .sort((a, b) => (paid.get(b.id) ?? 0) - (paid.get(a.id) ?? 0))
        .map((p) => `  ${p.name.padEnd(34)} ${da(paid.get(p.id) ?? 0).padStart(20)}   balance ${da(p.balance)}`),
      '',
      `Imported people whose balance is not 0: ${notZero.length === 0 ? 'none' : notZero.map((p) => `${p.name} (${da(p.balance)})`).join(', ')}`,
      `Caisse in the old app at the end of the import: ${da(oldCaisse)}`,
      `Caisse in FinGBO: ${da(balanceAfter)} = ${da(oldCaisse)} imported + ${da(balanceBefore)} from entries that were already there`,
    )

    if (balanceAfter !== oldCaisse + balanceBefore) throw new Error('The caisse balance does not add up; nothing was written.')
    if (!apply) throw new DryRun()
  }).catch((err: unknown) => {
    if (!(err instanceof DryRun)) throw err
  })

  console.log(lines.join('\n'))
  console.log(apply ? '\nImported.' : '\nNothing was written. Run again with --apply to import.')
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => client.end({ timeout: 5 }))
