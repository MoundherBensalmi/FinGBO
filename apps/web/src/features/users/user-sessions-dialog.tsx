import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertCircle, Loader2, LogOut, MonitorSmartphone } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatAgo, formatDateTime } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import { trpc } from '@/lib/trpc'
import { cn } from '@/lib/utils'
import { type UserRow, type UserSession, displayName, invalidateUsers } from './types'

type UserSessionsDialogProps = {
  user: UserRow | null
  onClose: () => void
}

/** A user's sessions (logins): device, IPs, times, and buttons to revoke them. */
export function UserSessionsDialog({ user, onClose }: UserSessionsDialogProps) {
  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        {user && <SessionsPanel key={user.id} user={user} />}
      </DialogContent>
    </Dialog>
  )
}

type Confirm = { kind: 'all' } | { kind: 'one'; session: UserSession }

function SessionsPanel({ user }: { user: UserRow }) {
  const { data, isPending, error } = useQuery({
    ...trpc.users.sessions.queryOptions({ id: user.id }),
    // Always fresh when opened: a new login elsewhere must show up.
    staleTime: 0,
  })
  const [confirm, setConfirm] = useState<Confirm | null>(null)

  const afterRevoke = ({ revoked, current }: { revoked: number; current: boolean }) => {
    toast.success(
      revoked === 0
        ? 'Aucune session à révoquer'
        : revoked === 1
          ? 'Session révoquée'
          : `${revoked} sessions révoquées`,
    )
    // When the current session was revoked, this refresh fails with UNAUTHORIZED
    // and the app goes back to the login page.
    void invalidateUsers()
    if (current) toast.info('Votre session a été fermée')
  }

  const revokeOne = useMutation(trpc.users.revokeSession.mutationOptions())
  const revokeAll = useMutation(trpc.users.revokeAllSessions.mutationOptions())

  const sessions = data?.sessions ?? []
  const open = sessions.filter((s) => !s.revokedAt)
  const closed = sessions.filter((s) => s.revokedAt)

  return (
    <>
      <DialogHeader>
        <DialogTitle>Sessions de « {displayName(user)} »</DialogTitle>
        <DialogDescription>
          Chaque connexion ouvre une session. Révoquer une session déconnecte immédiatement cet appareil.
        </DialogDescription>
      </DialogHeader>

      {isPending ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm">
          <Loader2 className="size-4 animate-spin" /> Chargement…
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{errorMessage(error)}</AlertDescription>
        </Alert>
      ) : (
        <div className="flex min-w-0 flex-col gap-5">
          <section className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                Ouvertes <span className="text-muted-foreground font-normal">({open.length})</span>
              </h3>
              {open.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setConfirm({ kind: 'all' })}>
                  <LogOut />
                  Révoquer toutes
                </Button>
              )}
            </div>
            {open.length === 0 ? (
              <p className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-center text-sm">
                Aucune session ouverte.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {open.map((s) => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    userId={user.id}
                    revoking={revokeOne.isPending && revokeOne.variables?.sessionId === s.id}
                    onRevoke={() =>
                      s.current
                        ? setConfirm({ kind: 'one', session: s })
                        : revokeOne.mutate(
                            { sessionId: s.id },
                            { onSuccess: afterRevoke, onError: (e) => toast.error(errorMessage(e)) },
                          )
                    }
                  />
                ))}
              </ul>
            )}
          </section>

          {closed.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">
                Fermées <span className="text-muted-foreground font-normal">({closed.length})</span>
              </h3>
              <ul className="flex flex-col gap-2">
                {closed.map((s) => (
                  <SessionItem key={s.id} session={s} userId={user.id} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title={confirm?.kind === 'all' ? 'Révoquer toutes les sessions ?' : 'Fermer votre session ?'}
        description={
          confirm?.kind === 'all'
            ? open.some((s) => s.current)
              ? `Tous les appareils de « ${displayName(user)} » seront déconnectés, y compris celui-ci : vous devrez vous reconnecter.`
              : `Tous les appareils de « ${displayName(user)} » seront déconnectés immédiatement.`
            : 'C’est la session que vous utilisez en ce moment : vous serez déconnecté et devrez vous reconnecter.'
        }
        confirmLabel={confirm?.kind === 'all' ? 'Révoquer toutes' : 'Révoquer'}
        onConfirm={async () => {
          if (!confirm) return
          const result =
            confirm.kind === 'all'
              ? await revokeAll.mutateAsync({ id: user.id })
              : await revokeOne.mutateAsync({ sessionId: confirm.session.id })
          afterRevoke(result)
        }}
      />
    </>
  )
}

function SessionItem({
  session: s,
  userId,
  onRevoke,
  revoking,
}: {
  session: UserSession
  /** Owner of the session: they may have closed it themselves (logout or from this panel). */
  userId: number
  onRevoke?: () => void
  revoking?: boolean
}) {
  const sameIp = !s.lastIp || s.lastIp === s.ip
  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-start sm:justify-between',
        s.current && 'border-primary/50 bg-muted/50',
        s.revokedAt && 'opacity-75',
      )}
    >
      <div className="flex min-w-0 gap-3">
        <MonitorSmartphone className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium break-words">
            <span className="min-w-0 break-words" title={s.userAgent ?? undefined}>
              {s.device ?? 'Appareil inconnu'}
            </span>
            {s.current && <Badge>Cette session</Badge>}
          </p>
          <p className="text-muted-foreground text-xs break-words">
            IP {s.ip ?? '—'}
            {!sameIp && <> · dernière IP {s.lastIp}</>}
          </p>
          <p className="text-muted-foreground text-xs">
            Connexion le {formatDateTime(s.createdAt)} · vue {formatAgo(s.lastSeenAt)}
            <span className="sr-only"> ({formatDateTime(s.lastSeenAt)})</span>
          </p>
          {s.revokedAt && (
            <p className="text-xs">
              {s.revokedBy?.id === userId ? (
                <>Fermée par l’utilisateur le {formatDateTime(s.revokedAt)}</>
              ) : (
                <>
                  Révoquée le {formatDateTime(s.revokedAt)}
                  {s.revokedBy && <> par {displayName(s.revokedBy)}</>}
                </>
              )}
            </p>
          )}
        </div>
      </div>
      {onRevoke && (
        <Button variant="outline" size="sm" className="self-end sm:self-start" disabled={revoking} onClick={onRevoke}>
          {revoking ? <Loader2 className="animate-spin" /> : <LogOut />}
          Révoquer
        </Button>
      )}
    </li>
  )
}
