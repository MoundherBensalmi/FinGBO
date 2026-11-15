import { z } from 'zod'

/** admin: everything, including users. viewer: read-only access to the caisse data. */
export const USER_ROLES = ['admin', 'viewer'] as const
export type UserRole = (typeof USER_ROLES)[number]

/**
 * Device details the browser can read with navigator.userAgentData
 * (Chrome, Edge, Samsung Internet). Safari and Firefox send nothing here.
 */
export const deviceHintsSchema = z.object({
  model: z.string().max(100).optional(),
  platform: z.string().max(50).optional(),
  platformVersion: z.string().max(50).optional(),
  mobile: z.boolean().optional(),
})
export type DeviceHints = z.infer<typeof deviceHintsSchema>

export const loginInputSchema = z.object({
  username: z.string().trim().min(1, "Le nom d'utilisateur est obligatoire").max(64),
  password: z.string().min(1, 'Le mot de passe est obligatoire').max(256),
  device: deviceHintsSchema.optional(),
})
export type LoginInput = z.infer<typeof loginInputSchema>
