import { z } from 'zod'

/** Database id (positive whole number). */
export const idSchema = z.number().int().positive()

/** A calendar day as "YYYY-MM-DD" (no time, no timezone). */
export const isoDateSchema = z.iso.date({ error: 'Date invalide' })
export type IsoDate = z.infer<typeof isoDateSchema>
