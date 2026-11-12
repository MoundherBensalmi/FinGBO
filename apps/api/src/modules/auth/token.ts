import { sign, verify } from 'hono/jwt'
import { z } from 'zod'
import { env } from '../../env'

const ALG = 'HS256'

export type TokenClaims = { userId: number; sessionId: string }

const payloadSchema = z.object({
  sub: z.string().regex(/^\d+$/).transform(Number),
  sid: z.uuid(),
})

/**
 * The token has no expiry on purpose. It stays valid only while its session row
 * is not revoked and the user is not disabled (checked on every request).
 */
export function signToken({ userId, sessionId }: TokenClaims): Promise<string> {
  return sign(
    { sub: String(userId), sid: sessionId, iat: Math.floor(Date.now() / 1000) },
    env.JWT_SECRET,
    ALG,
  )
}

/** Returns the claims of a correctly signed token, or null. */
export async function verifyToken(token: string): Promise<TokenClaims | null> {
  try {
    const payload = payloadSchema.parse(await verify(token, env.JWT_SECRET, ALG))
    return { userId: payload.sub, sessionId: payload.sid }
  } catch {
    return null
  }
}
