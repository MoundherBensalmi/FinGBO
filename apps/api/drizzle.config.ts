import { defineConfig } from 'drizzle-kit'

try {
  process.loadEnvFile()
} catch {
  // no .env file; rely on the environment
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
})
