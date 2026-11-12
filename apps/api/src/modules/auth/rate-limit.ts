import { TRPCError } from '@trpc/server'

/**
 * Failed-login limits, kept in memory (they reset when the API restarts).
 *   - 5 failures for one username from one IP
 *   - 20 failures from one IP across all usernames
 * Both windows last 15 minutes from the first failure.
 */
const WINDOW_MS = 15 * 60_000
const MAX_PER_ACCOUNT = 5
const MAX_PER_IP = 20

type Entry = { count: number; resetAt: number }
const failures = new Map<string, Entry>()

function keys(ip: string | null, username: string): [key: string, max: number][] {
  const who = ip ?? 'unknown'
  return [
    [`account:${who}:${username.toLowerCase()}`, MAX_PER_ACCOUNT],
    [`ip:${who}`, MAX_PER_IP],
  ]
}

export function assertLoginAllowed(ip: string | null, username: string): void {
  const now = Date.now()
  for (const [key, max] of keys(ip, username)) {
    const entry = failures.get(key)
    if (entry && entry.resetAt > now && entry.count >= max) {
      const minutes = Math.ceil((entry.resetAt - now) / 60_000)
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Too many failed attempts. Try again in ${minutes} min.`,
      })
    }
  }
}

export function recordLoginFailure(ip: string | null, username: string): void {
  const now = Date.now()
  if (failures.size > 10_000) {
    for (const [key, entry] of failures) if (entry.resetAt <= now) failures.delete(key)
  }
  for (const [key] of keys(ip, username)) {
    const entry = failures.get(key)
    if (!entry || entry.resetAt <= now) failures.set(key, { count: 1, resetAt: now + WINDOW_MS })
    else entry.count++
  }
}

export function clearLoginFailures(ip: string | null, username: string): void {
  const [account] = keys(ip, username)
  if (account) failures.delete(account[0])
}
