import type { AppRouter } from '@fingbo/api/router'
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import type { inferRouterOutputs } from '@trpc/server'
import superjson from 'superjson'
import { API_URL } from './api-url'
import { getToken } from './auth-token'
import { isUnauthorized } from './errors'

/** Types of what each procedure returns, e.g. RouterOutputs['movements']['day']. */
export type RouterOutputs = inferRouterOutputs<AppRouter>

let unauthorizedHandler: (() => void) | undefined

/**
 * Called when any request fails because the token was revoked or is invalid
 * (registered in router.tsx, where the router is available).
 */
export function setUnauthorizedHandler(handler: () => void): void {
  unauthorizedHandler = handler
}

function handleError(error: unknown) {
  // Without a token this is just a failed login, not an expired session.
  if (isUnauthorized(error) && getToken()) unauthorizedHandler?.()
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleError }),
  mutationCache: new MutationCache({ onError: handleError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Don't retry requests the API refused; retry network hiccups twice.
      retry: (count, error) => !isUnauthorized(error) && count < 2,
    },
  },
})

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
      transformer: superjson,
      headers() {
        const token = getToken()
        return token ? { Authorization: `Bearer ${token}` } : {}
      },
    }),
  ],
})

/**
 * Typed query/mutation options for every procedure, e.g.
 *   useQuery(trpc.auth.me.queryOptions())
 *   queryClient.ensureQueryData(trpc.system.health.queryOptions())   // in route loaders
 */
export const trpc = createTRPCOptionsProxy<AppRouter>({ client: trpcClient, queryClient })
