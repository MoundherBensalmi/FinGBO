import { z } from 'zod'
import { idSchema } from './common'

/** Optional text: trimmed, and empty becomes null. Accepts a missing value. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} trop long (${max} caractères max.)`)
    .nullish()
    .transform((v) => v || null)

export const personCreateSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire').max(120, 'Nom trop long (120 caractères max.)'),
  phone: optionalText(40, 'Téléphone'),
  address: optionalText(200, 'Adresse'),
  occupation: optionalText(80, 'Activité'),
  note: optionalText(1000, 'Note'),
  /** Pre-selected category when this person is chosen in a form. */
  defaultCategoryId: idSchema.nullish().transform((v) => v ?? null),
})
export type PersonCreateInput = z.input<typeof personCreateSchema>

export const personUpdateSchema = personCreateSchema.extend({ id: idSchema })
export type PersonUpdateInput = z.input<typeof personUpdateSchema>

export const personIdSchema = z.object({ id: idSchema })
