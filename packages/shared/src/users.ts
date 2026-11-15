import { z } from 'zod'
import { USER_ROLES } from './auth'
import { idSchema } from './common'

/** Same rule as the command-line tool (apps/api password.ts). */
export const MIN_PASSWORD_LENGTH = 8

export const usernameSchema = z
  .string()
  .trim()
  .min(1, "Le nom d'utilisateur est obligatoire")
  .max(64, "Nom d'utilisateur trop long (64 caractères max.)")
  .regex(/^[\p{L}\p{N}._-]+$/u, "Lettres, chiffres, point, tiret ou tiret bas uniquement (pas d'espace)")

const fullNameSchema = z
  .string()
  .trim()
  .max(120, 'Nom complet trop long (120 caractères max.)')
  .nullish()
  .transform((v) => v || null)

const roleSchema = z.enum(USER_ROLES, { error: 'Rôle invalide' })

const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Au moins ${MIN_PASSWORD_LENGTH} caractères`)
  .max(256, 'Mot de passe trop long (256 caractères max.)')

/** The password is typed twice; a mismatch is reported on `passwordConfirm`. */
const passwordsMatch = {
  check: (v: { password: string; passwordConfirm: string }) => v.password === v.passwordConfirm,
  params: { message: 'Les deux mots de passe ne correspondent pas', path: ['passwordConfirm'] },
}

export const userCreateSchema = z
  .object({
    username: usernameSchema,
    fullName: fullNameSchema,
    role: roleSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine(passwordsMatch.check, passwordsMatch.params)
export type UserCreateInput = z.input<typeof userCreateSchema>

export const userUpdateSchema = z.object({
  id: idSchema,
  fullName: fullNameSchema,
  role: roleSchema,
})
export type UserUpdateInput = z.input<typeof userUpdateSchema>

export const userPasswordResetSchema = z
  .object({
    id: idSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine(passwordsMatch.check, passwordsMatch.params)
export type UserPasswordResetInput = z.input<typeof userPasswordResetSchema>

export const userIdSchema = z.object({ id: idSchema })

export const userSetDisabledSchema = z.object({ id: idSchema, disabled: z.boolean() })

export const sessionIdSchema = z.object({ sessionId: z.uuid({ error: 'Session invalide' }) })
