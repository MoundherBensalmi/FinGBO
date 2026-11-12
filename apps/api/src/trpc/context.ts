import type { Context as HonoContext } from 'hono'
import { db } from '../db'
import { getClientInfo } from '../lib/client-info'
import { authenticate } from '../modules/auth/auth.service'

/** Built once per request and passed to every procedure. */
export async function createContext(c: HonoContext) {
  const client = getClientInfo(c)
  const auth = await authenticate(db, c.req.header('authorization'), client)
  return { db, client, auth }
}

export type Context = Awaited<ReturnType<typeof createContext>>
