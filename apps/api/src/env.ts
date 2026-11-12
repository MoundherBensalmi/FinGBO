import { z } from 'zod'

const commaList = z
  .string()
  .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().startsWith('postgres', 'must be a postgres:// URL'),
  /** Signs the login tokens. Anyone who knows it can forge a token, so keep it secret. */
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
  /** Web app addresses allowed to call the API, comma-separated. */
  WEB_ORIGINS: commaList.pipe(z.array(z.url()).min(1, 'at least one origin is required')),
  /** "cloudflare" reads the real client IP from CF-Connecting-IP (only behind Cloudflare Tunnel). */
  TRUST_PROXY: z.enum(['none', 'cloudflare']).default('none'),
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment variables (see apps/api/.env.example):')
  console.error(z.prettifyError(parsed.error))
  process.exit(1)
}

export const env = parsed.data
export const isProduction = env.NODE_ENV === 'production'
