import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { clearToken } from './lib/auth-token'
import { queryClient, setUnauthorizedHandler, trpc } from './lib/trpc'
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

  // The session was revoked or the user disabled while the app was open:
  // forget the token and go back to the login page, then return here after logging in.
  setUnauthorizedHandler(() => {
    clearToken()
    queryClient.removeQueries()
    const { pathname, href } = router.state.location
    if (pathname !== '/login') {
      void router.navigate({ to: '/login', search: { redirect: href } })
    }
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
