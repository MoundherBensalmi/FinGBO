import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../env'
import * as schema from './schema'

export const client = postgres(env.DATABASE_URL)
export const db = drizzle(client, { schema, casing: 'snake_case' })

export type Db = typeof db
/** A transaction handle, usable wherever a Db is expected for queries. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
export type DbOrTx = Db | Tx
