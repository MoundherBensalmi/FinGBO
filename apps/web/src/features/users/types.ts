import type { RouterOutputs } from '@/lib/trpc'
import { queryClient, trpc } from '@/lib/trpc'

export type UserRow = RouterOutputs['users']['list'][number]
export type UserSession = RouterOutputs['users']['sessions']['sessions'][number]

export const roleLabel = (role: UserRow['role']) => (role === 'admin' ? 'Administrateur' : 'Lecteur')

/** "Ali B." or the username when there is no full name. */
export const displayName = (u: { username: string; fullName: string | null }) => u.fullName ?? u.username

/** Refreshes the users list, the sessions and the header (the current user's name or role may have changed). */
export function invalidateUsers(): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries(trpc.users.pathFilter()),
    queryClient.invalidateQueries(trpc.auth.me.queryFilter()),
  ]).then(() => undefined)
}
