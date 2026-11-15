import { z } from 'zod'
import { idSchema } from './common'

export const personCreateSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire').max(120, 'Nom trop long (120 caractères max.)'),
  /** Pre-selected category when this person is chosen in a form. */
  defaultCategoryId: idSchema.nullable().default(null),
})
export type PersonCreateInput = z.input<typeof personCreateSchema>
