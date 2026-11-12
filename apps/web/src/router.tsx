import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { queryClient, trpc } from './lib/trpc'
import { routeTree } from './routeTree.gen'

export type RouterContext = {
  queryClient: typeof queryClient
  trpc: typeof trpc
}

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    context: { queryClient, trpc } satisfies RouterContext,
    scrollRestoration: true,
    defaultPreload: 'intent',
    // TanStack Query caches the data, so the router doesn't need its own cache.
    defaultPreloadStaleTime: 0,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
