import type { AppRouter } from '@fingbo/api/router'
import { QueryClient } from '@tanstack/react-query'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import superjson from 'superjson'
import { getToken } from './auth-token'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000 },
  },
})

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${import.meta.env.VITE_API_URL}/trpc`,
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
