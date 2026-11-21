/**
 * Applies the pending SQL migrations in apps/api/drizzle. Used by the Docker image before the
 * API starts (drizzle-kit is a dev tool and isn't installed there). Safe to run on every start:
 * migrations already applied are skipped.
 *
 *   node dist/migrate.mjs        (needs DATABASE_URL)
 */
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url?.startsWith('postgres')) {
  console.error('DATABASE_URL must be a postgres:// URL')
  process.exit(1)
}

// dist/migrate.mjs -> ../drizzle
const migrationsFolder = process.env.MIGRATIONS_DIR ?? join(import.meta.dirname, '..', 'drizzle')

const client = postgres(url, { max: 1, onnotice: () => {} })
try {
  await migrate(drizzle(client), { migrationsFolder })
  console.log('Database migrations applied')
} catch (error) {
  console.error('Migration failed:', error)
  process.exitCode = 1
} finally {
  await client.end({ timeout: 5 })
}
