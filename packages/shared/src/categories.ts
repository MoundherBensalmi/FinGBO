import { z } from 'zod'

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire').max(80, 'Nom trop long (80 caractères max.)'),
})
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>
