import { useSuspenseQuery } from '@tanstack/react-query'
import {
  type ErrorComponentProps,
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { AlertCircle, Loader2, LogOut, ReceiptText, ShieldUser, Users, Wallet } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { loadCurrentUser } from '@/features/auth/session'
import { useLogout } from '@/features/auth/use-logout'
import { errorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'

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
          <div className="flex items-center gap-6">
            <Link to="/" search={{}} className="flex items-center gap-2 font-bold">
              <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
                <Wallet className="size-4" />
              </span>
              FinGBO
            </Link>
            <AppNav isAdmin={user.role === 'admin'} className="hidden md:flex" />
          </div>

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
        {/* Phone: the sections as tabs under the header */}
        <AppNav isAdmin={user.role === 'admin'} className="flex border-t px-2 md:hidden" />
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        <Outlet />
      </main>
    </div>
  )
}

const sections = [
  { to: '/', label: 'Caisse', icon: Wallet, exact: true },
  { to: '/receipts', label: 'Reçus', icon: ReceiptText, exact: false },
  { to: '/people', label: 'Personnes', icon: Users, exact: false },
  { to: '/admin/users', label: 'Utilisateurs', icon: ShieldUser, exact: false, adminOnly: true },
] as const

function AppNav({ isAdmin, className }: { isAdmin: boolean; className?: string }) {
  return (
    <nav aria-label="Sections" className={cn('gap-1', className)}>
      {sections.filter((s) => isAdmin || !('adminOnly' in s)).map(({ to, label, icon: Icon, exact }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact, includeSearch: false }}
          className="text-muted-foreground hover:text-foreground flex flex-1 items-center justify-center gap-1.5 border-b-2 border-transparent px-2 py-2.5 text-sm font-medium md:flex-none md:rounded-md md:border-0 md:px-3 md:py-1.5"
          activeProps={{ className: 'text-foreground! border-foreground! md:bg-muted' }}
        >
          {/* Phones under 400px: no room for 4 icons and labels in one row */}
          <Icon className="size-4 max-[400px]:hidden md:block" />
          {label}
        </Link>
      ))}
    </nav>
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
