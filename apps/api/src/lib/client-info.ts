import { isIP } from 'node:net'
import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'
import { env } from '../env'

export type ClientInfo = {
  /** Real client IP, or null if it can't be determined. */
  ip: string | null
  userAgent: string | null
}

export function getClientInfo(c: Context): ClientInfo {
  let ip: string | undefined

  // Behind Cloudflare Tunnel every request comes from 127.0.0.1; the real address
  // is in this header. Only trusted when configured, otherwise anyone could fake it.
  if (env.TRUST_PROXY === 'cloudflare') ip = c.req.header('cf-connecting-ip')
  // Same behind a reverse proxy (Traefik in Dokploy), which sets X-Real-IP.
  else if (env.TRUST_PROXY === 'proxy') ip = c.req.header('x-real-ip')

  if (!ip) {
    try {
      ip = getConnInfo(c).remote.address
    } catch {
      ip = undefined
    }
  }

  return {
    ip: ip && isIP(ip) ? ip : null,
    userAgent: c.req.header('user-agent')?.slice(0, 512) ?? null,
  }
}
