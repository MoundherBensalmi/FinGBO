import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { Wallet } from 'lucide-react'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginForm } from '@/features/auth/login-form'
import { loadCurrentUser, safeRedirect } from '@/features/auth/session'

export const Route = createFileRoute('/login')({
  // ?redirect=/... brings the user back to where they were after logging in.
  validateSearch: z.object({ redirect: z.string().optional().catch(undefined) }),
  beforeLoad: async ({ context, search }) => {
    // Already logged in: skip the form. If the API can't be reached, show the form anyway.
    const user = await loadCurrentUser(context).catch(() => null)
    if (user) throw redirect({ href: safeRedirect(search.redirect) })
  },
  component: LoginPage,
})

function LoginPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()

  return (
    <main className="bg-muted/40 flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
            <Wallet className="size-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">FinGBO</h1>
          <p className="text-muted-foreground text-sm">Caisse, reçus et paiements</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Connexion</CardTitle>
          </CardHeader>
          <CardContent>
            <LoginForm
              onSuccess={() => void navigate({ href: safeRedirect(search.redirect), replace: true })}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
