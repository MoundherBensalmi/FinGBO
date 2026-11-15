import { z } from 'zod'

/** Database id (positive whole number). */
export const idSchema = z.number().int().positive()

/** A calendar day as "YYYY-MM-DD" (no time, no timezone). */
export const isoDateSchema = z.iso.date({ error: 'Date invalide' })
export type IsoDate = z.infer<typeof isoDateSchema>

/** A time of day as "HH:MM" or "HH:MM:SS" (24 hours, local time, no timezone). */
export const timeOfDaySchema = z
  .string({ error: 'Heure invalide' })
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Heure invalide (ex. 14:30)')
