import { clearToken, getToken } from '../../lib/auth-token'
import { isUnauthorized } from '../../lib/errors'
import type { RouterContext } from '../../router'

/**
 * The logged-in user, or null when there is no token or the API refused it.
 * Other errors (API unreachable) are thrown so the route can show them.
 */
export async function loadCurrentUser({ queryClient, trpc }: RouterContext) {
  if (!getToken()) return null
  try {
    return await queryClient.ensureQueryData(trpc.auth.me.queryOptions())
  } catch (error) {
    if (!isUnauthorized(error)) throw error
    clearToken()
    return null
  }
}

/** Only allows redirects to a page of this app (blocks "//evil.com" and full URLs). */
export function safeRedirect(target: string | undefined): string {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
    return '/'
  }
  return target.startsWith('/login') ? '/' : target
}
