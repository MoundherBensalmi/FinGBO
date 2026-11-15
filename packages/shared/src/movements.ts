import { z } from 'zod'
import { idSchema, isoDateSchema, timeOfDaySchema } from './common'
import { MAX_CENTIMES } from './money'

export const MOVEMENT_DIRECTIONS = ['in', 'out'] as const
export type MovementDirection = (typeof MOVEMENT_DIRECTIONS)[number]

const movementFields = z.object({
  date: isoDateSchema,
  /** Time of day on that date; it orders the day's journal. */
  time: timeOfDaySchema,
  direction: z.enum(MOVEMENT_DIRECTIONS),
  /** Centimes. 0 is allowed to keep a trace (the note must then explain it). */
  amount: z
    .number({ error: 'Montant invalide' })
    .int('Montant invalide')
    .min(0, 'Le montant ne peut pas être négatif')
    .max(MAX_CENTIMES, 'Montant trop élevé'),
  /** in: who the money came from. out: who was paid. null: one-off expense. */
  personId: idSchema.nullable(),
  /** Who carried the money (optional). */
  byPersonId: idSchema.nullable(),
  categoryId: z.number({ error: 'Choisissez une catégorie' }).int().positive(),
  note: z.string().trim().max(1000, 'Note trop longue (1000 caractères max.)').nullable(),
})

type MovementFields = z.infer<typeof movementFields>

/** Same rules as the database checks, with messages for the form. */
function movementRules(v: MovementFields, ctx: z.RefinementCtx) {
  const hasNote = Boolean(v.note)
  if (v.amount === 0 && !hasNote) {
    ctx.addIssue({ code: 'custom', path: ['note'], message: 'Montant à 0 : expliquez-le dans la note' })
  } else if (v.personId === null && !hasNote) {
    ctx.addIssue({ code: 'custom', path: ['note'], message: 'Sans personne, la note est obligatoire' })
  }
  if (v.byPersonId !== null && v.byPersonId === v.personId) {
    ctx.addIssue({
      code: 'custom',
      path: ['byPersonId'],
      message: '« Par » ne peut pas être la même personne',
    })
  }
}

const emptyNoteToNull = <T extends { note: string | null }>(v: T): T => ({ ...v, note: v.note || null })

export const movementInputSchema = movementFields.superRefine(movementRules).transform(emptyNoteToNull)
export type MovementInput = z.input<typeof movementInputSchema>

export const movementUpdateSchema = movementFields
  .extend({ id: idSchema })
  .superRefine(movementRules)
  .transform(emptyNoteToNull)
export type MovementUpdateInput = z.input<typeof movementUpdateSchema>

export const movementCancelSchema = z.object({
  id: idSchema,
  reason: z.string().trim().min(1, "Indiquez la raison de l'annulation").max(500, 'Raison trop longue'),
})
export type MovementCancelInput = z.input<typeof movementCancelSchema>

export const movementDaySchema = z.object({ date: isoDateSchema })
