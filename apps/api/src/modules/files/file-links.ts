import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '../../env'

/**
 * Attachments are opened with short-lived signed links (/files/movement/12?exp=...&sig=...),
 * so <img> tags and "open in a new tab" work without sending the login token,
 * and the storage server itself never has to be reachable from outside.
 */
export type FileKind = 'movement' | 'receipt'

const LINK_TTL_SECONDS = 60 * 60

// A key derived from the JWT secret, used only for file links.
const key = createHash('sha256').update(`fingbo-file-links:${env.JWT_SECRET}`).digest()

const signature = (kind: FileKind, id: number, exp: number) =>
  createHmac('sha256', key).update(`${kind}:${id}:${exp}`).digest('base64url')

/** Path relative to the API, e.g. "/files/movement/12?exp=1794600000&sig=..." */
export function signedFilePath(kind: FileKind, id: number): string {
  const exp = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS
  return `/files/${kind}/${id}?exp=${exp}&sig=${signature(kind, id, exp)}`
}

export function isValidFileLink(kind: FileKind, id: number, exp: string | undefined, sig: string | undefined): boolean {
  const expiry = Number(exp)
  if (!sig || !Number.isInteger(expiry) || expiry < Date.now() / 1000) return false
  const expected = Buffer.from(signature(kind, id, expiry))
  const given = Buffer.from(sig)
  return expected.length === given.length && timingSafeEqual(expected, given)
}
