import { z } from 'zod'
import { idSchema, isoDateSchema } from './common'
import { MAX_CENTIMES } from './money'

/** A receipt: something bought from a person; it adds to what you owe them. */
const receiptFields = z.object({
  date: isoDateSchema,
  personId: z.number({ error: 'Choisissez la personne' }).int().positive(),
  /** Centimes, always above 0 (only movements may be 0). */
  amount: z
    .number({ error: 'Montant invalide' })
    .int('Montant invalide')
    .positive('Le montant doit être supérieur à 0')
    .max(MAX_CENTIMES, 'Montant trop élevé'),
  categoryId: z.number({ error: 'Choisissez une catégorie' }).int().positive(),
  note: z
    .string()
    .trim()
    .max(1000, 'Note trop longue (1000 caractères max.)')
    .nullable()
    .transform((v) => v || null),
})

export const receiptInputSchema = receiptFields
export type ReceiptInput = z.input<typeof receiptInputSchema>

export const receiptUpdateSchema = receiptFields.extend({ id: idSchema })
export type ReceiptUpdateInput = z.input<typeof receiptUpdateSchema>

export const receiptCancelSchema = z.object({
  id: idSchema,
  reason: z.string().trim().min(1, "Indiquez la raison de l'annulation").max(500, 'Raison trop longue'),
})
export type ReceiptCancelInput = z.input<typeof receiptCancelSchema>

/** Receipts between two days (inclusive), at most about a year. */
export const receiptListSchema = z
  .object({ from: isoDateSchema, to: isoDateSchema, personId: idSchema.optional() })
  .refine((v) => v.from <= v.to, { message: 'Période invalide', path: ['to'] })
  .refine((v) => Date.parse(v.to) - Date.parse(v.from) <= 400 * 86_400_000, {
    message: 'Période trop longue (un an max.)',
    path: ['to'],
  })
