import { useMutation, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { KeyRound, MonitorSmartphone, Pencil, Plus, UserCheck, UserX } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { SortableHeader, useSort } from '@/components/sortable-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PasswordResetDialog } from '@/features/users/password-reset-dialog'
import { type UserRow, displayName, invalidateUsers, roleLabel } from '@/features/users/types'
import { type UserDialogState, UserFormDialog } from '@/features/users/user-form-dialog'
import { UserSessionsDialog } from '@/features/users/user-sessions-dialog'
import { formatAgo, formatDateTime } from '@/lib/dates'

/** Users and their sessions. Admins only: viewers are sent back to the caisse. */
export const Route = createFileRoute('/_app/admin/users')({
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'admin') throw redirect({ to: '/', search: {} })
  },
  loader: ({ context: { queryClient, trpc } }) => queryClient.ensureQueryData(trpc.users.list.queryOptions()),
  component: UsersPage,
})

function RoleBadge({ role }: { role: UserRow['role'] }) {
  return <Badge variant={role === 'admin' ? 'default' : 'secondary'}>{roleLabel(role)}</Badge>
}

function StatusBadge({ user }: { user: UserRow }) {
  return user.disabledAt ? (
    <Badge variant="destructive">Désactivé</Badge>
  ) : (
    <Badge variant="outline" className="text-money-in border-money-in/40">
      Actif
    </Badge>
  )
}

const lastActivity = (u: UserRow) => (u.lastSeenAt ? formatAgo(u.lastSeenAt) : 'Jamais connecté')

const createdLine = (u: UserRow) =>
  `Créé le ${formatDateTime(u.createdAt)}${u.createdBy ? ` par ${displayName(u.createdBy)}` : ' (ligne de commande)'}`

const sessions = (n: number, state: 'ouverte' | 'fermée') => `${n} session${n > 1 ? 's' : ''} ${state}${n > 1 ? 's' : ''}`

function UsersPage() {
  const { trpc } = Route.useRouteContext()
  const { data: me } = useSuspenseQuery(trpc.auth.me.queryOptions())
  const { data: users } = useSuspenseQuery(trpc.users.list.queryOptions())

  const [form, setForm] = useState<UserDialogState | null>(null)
  const [passwordFor, setPasswordFor] = useState<UserRow | null>(null)
  const [sessionsFor, setSessionsFor] = useState<UserRow | null>(null)
  const [toggle, setToggle] = useState<UserRow | null>(null)
  const setDisabled = useMutation(trpc.users.setDisabled.mutationOptions())

  const { sorted, sort } = useSort(users, {
    user: (u) => displayName(u),
    role: (u) => roleLabel(u.role),
    status: (u) => (u.disabledAt ? 1 : 0),
    activity: (u) => u.lastSeenAt,
  })

  const activeAdmins = users.filter((u) => u.role === 'admin' && !u.disabledAt).length
  /** Why this user can't be disabled, if so (the API checks it too). */
  const cannotDisable = (u: UserRow) =>
    u.id === me.id
      ? 'Vous ne pouvez pas désactiver votre propre compte'
      : u.role === 'admin' && !u.disabledAt && activeAdmins <= 1
        ? 'Il doit rester au moins un administrateur actif'
        : null

  const actions = (u: UserRow) => {
    const blocked = !u.disabledAt ? cannotDisable(u) : null
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setSessionsFor(u)}>
          <MonitorSmartphone />
          Sessions
          {u.activeSessions > 0 && (
            <Badge variant="secondary" className="px-1.5">
              {u.activeSessions}
            </Badge>
          )}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => setForm({ mode: 'edit', user: u })} aria-label={`Modifier ${u.username}`} title="Modifier">
          <Pencil />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => setPasswordFor(u)} aria-label={`Mot de passe de ${u.username}`} title="Mot de passe">
          <KeyRound />
        </Button>
        {/* A disabled button gets no hover, so the reason is on a wrapper. */}
        <span title={blocked ?? undefined} className="inline-flex">
          <Button
            variant="ghost"
            size="icon-sm"
            className={u.disabledAt ? 'text-money-in' : 'text-destructive'}
            disabled={!!blocked}
            title={blocked ? undefined : u.disabledAt ? 'Réactiver' : 'Désactiver'}
            aria-label={`${u.disabledAt ? 'Réactiver' : 'Désactiver'} ${u.username}`}
            aria-description={blocked ?? undefined}
            onClick={() => setToggle(u)}
          >
            {u.disabledAt ? <UserCheck /> : <UserX />}
          </Button>
        </span>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Utilisateurs</h1>
          <p className="text-muted-foreground text-sm">Qui peut se connecter, avec quel rôle, et depuis quels appareils.</p>
        </div>
        <Button onClick={() => setForm({ mode: 'create' })}>
          <Plus />
          Nouvel utilisateur
        </Button>
      </div>

      <section className="bg-card rounded-xl border" aria-label="Liste des utilisateurs">
        {/* Desktop: table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                <SortableHeader sort={sort} column="user" className="px-4">Utilisateur</SortableHeader>
                <SortableHeader sort={sort} column="role" className="px-2">Rôle</SortableHeader>
                <SortableHeader sort={sort} column="status" className="px-2">Statut</SortableHeader>
                <SortableHeader sort={sort} column="activity" className="px-2">Dernière activité</SortableHeader>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">
                      {displayName(u)}
                      {u.id === me.id && <span className="text-muted-foreground font-normal"> (vous)</span>}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {u.fullName ? `${u.username} · ` : ''}
                      {createdLine(u)}
                    </p>
                  </td>
                  <td className="px-2 py-2.5">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-2 py-2.5">
                    <StatusBadge user={u} />
                  </td>
                  <td className="px-2 py-2.5">
                    <p className="whitespace-nowrap" title={u.lastSeenAt ? formatDateTime(u.lastSeenAt) : undefined}>
                      {lastActivity(u)}
                    </p>
                    <p className="text-muted-foreground text-xs whitespace-nowrap">{sessions(u.activeSessions, 'ouverte')}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">{actions(u)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Phone: cards */}
        <ul className="divide-y md:hidden">
          {sorted.map((u) => (
            <li key={u.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {displayName(u)}
                  {u.id === me.id && <span className="text-muted-foreground font-normal"> (vous)</span>}
                </p>
                {u.fullName && <p className="text-muted-foreground truncate text-xs">{u.username}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <RoleBadge role={u.role} />
                <StatusBadge user={u} />
                <span className="text-muted-foreground text-xs">
                  {lastActivity(u)} · {sessions(u.activeSessions, 'ouverte')}
                </span>
              </div>
              <p className="text-muted-foreground text-xs">{createdLine(u)}</p>
              <div className="flex flex-wrap items-center gap-1">{actions(u)}</div>
            </li>
          ))}
        </ul>
      </section>

      <UserFormDialog state={form} onClose={() => setForm(null)} currentUserId={me.id} />
      <PasswordResetDialog user={passwordFor} onClose={() => setPasswordFor(null)} currentUserId={me.id} />
      <UserSessionsDialog user={sessionsFor} onClose={() => setSessionsFor(null)} />
      <ConfirmDialog
        open={toggle !== null}
        onOpenChange={(o) => !o && setToggle(null)}
        destructive={!toggle?.disabledAt}
        title={toggle?.disabledAt ? `Réactiver « ${toggle.username} » ?` : `Désactiver « ${toggle?.username} » ?`}
        description={
          toggle?.disabledAt
            ? 'Il pourra de nouveau se connecter avec son mot de passe.'
            : 'Il ne pourra plus se connecter, et toutes ses sessions ouvertes seront déconnectées immédiatement. Ses données restent intactes.'
        }
        confirmLabel={toggle?.disabledAt ? 'Réactiver' : 'Désactiver'}
        onConfirm={async () => {
          if (!toggle) return
          const { user, revokedSessions } = await setDisabled.mutateAsync({ id: toggle.id, disabled: !toggle.disabledAt })
          void invalidateUsers()
          toast.success(
            user.disabledAt
              ? `« ${user.username} » désactivé${revokedSessions ? `, ${sessions(revokedSessions, 'fermée')}` : ''}`
              : `« ${user.username} » réactivé`,
          )
        }}
      />
    </div>
  )
}
