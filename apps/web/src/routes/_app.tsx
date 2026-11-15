import { useSuspenseQuery } from '@tanstack/react-query'
import {
  type ErrorComponentProps,
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { AlertCircle, Loader2, LogOut, Wallet } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { loadCurrentUser } from '@/features/auth/session'
import { useLogout } from '@/features/auth/use-logout'
import { errorMessage } from '@/lib/errors'

/** Every page inside this layout requires a logged-in user. */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const user = await loadCurrentUser(context)
    if (!user) throw redirect({ to: '/login', search: { redirect: location.href } })
    return { user }
  },
  component: AppLayout,
  errorComponent: AppError,
})

function AppLayout() {
  const { trpc } = Route.useRouteContext()
  const { data: user } = useSuspenseQuery(trpc.auth.me.queryOptions())
  const logout = useLogout()

  return (
    <div className="bg-muted/40 min-h-dvh">
      <header className="bg-background sticky top-0 z-30 border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" search={{}} className="flex items-center gap-2 font-bold">
            <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
              <Wallet className="size-4" />
            </span>
            FinGBO
          </Link>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="min-w-0 text-right leading-tight">
              <p className="truncate text-sm font-medium">{user.fullName ?? user.username}</p>
              <p className="text-muted-foreground text-xs">
                {user.role === 'admin' ? 'Administrateur' : 'Lecteur'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
              aria-label="Se déconnecter"
            >
              {logout.isPending ? <Loader2 className="animate-spin" /> : <LogOut />}
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        <Outlet />
      </main>
    </div>
  )
}

/** Shown when the API can't be reached while checking the login. */
function AppError({ error }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <main className="bg-muted/40 flex min-h-dvh items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{errorMessage(error)}</AlertDescription>
        </Alert>
        <Button onClick={() => void router.invalidate()}>Réessayer</Button>
      </div>
    </main>
  )
}
