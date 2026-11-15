import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SortableHeader, useSort } from '@/components/sortable-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { type PersonBalance, describeBalance } from '@/features/people/balance'
import { type PersonDialogState, PersonFormDialog } from '@/features/people/person-form-dialog'
import { formatDayShort } from '@/lib/dates'
import { formatAmount } from '@/lib/money'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/people/')({
  loader: ({ context: { queryClient, trpc } }) => queryClient.ensureQueryData(trpc.people.balances.queryOptions()),
  component: PeoplePage,
})

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

function BalanceCell({ balance, className }: { balance: number; className?: string }) {
  const { label, tone } = describeBalance(balance)
  return (
    <span className={cn('whitespace-nowrap tabular-nums', tone === 'out' && 'text-money-out', tone === 'in' && 'text-money-in', className)}>
      {balance === 0 ? <span className="text-muted-foreground">{label}</span> : formatAmount(Math.abs(balance))}
    </span>
  )
}

function PeoplePage() {
  const { trpc } = Route.useRouteContext()
  const navigate = useNavigate()
  const { data: user } = useSuspenseQuery(trpc.auth.me.queryOptions())
  const { data: people } = useSuspenseQuery(trpc.people.balances.queryOptions())
  const canEdit = user.role === 'admin'

  const [query, setQuery] = useState('')
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [dialog, setDialog] = useState<PersonDialogState | null>(null)

  const shown = useMemo(() => {
    const q = normalize(query.trim())
    return people.filter(
      (p) =>
        (!onlyOpen || p.balance !== 0) &&
        (!q || normalize(`${p.name} ${p.occupation ?? ''} ${p.phone ?? ''}`).includes(q)),
    )
  }, [people, query, onlyOpen])

  const { sorted, sort } = useSort(shown, {
    name: (p) => p.name,
    phone: (p) => p.phone,
    receipts: (p) => p.receiptsTotal,
    paid: (p) => p.paidTotal,
    balance: (p) => p.balance,
    received: (p) => p.receivedTotal || null,
    last: (p) => p.lastDate,
  })

  const owedByYou = people.reduce((s, p) => s + Math.max(p.balance, 0), 0)
  const owedToYou = people.reduce((s, p) => s + Math.max(-p.balance, 0), 0)
  const open = (p: PersonBalance) => void navigate({ to: '/people/$personId', params: { personId: String(p.id) } })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Personnes</h1>
          <p className="text-muted-foreground text-sm">Ce que vous devez à chacun : reçus moins paiements.</p>
        </div>
        {canEdit && (
          <Button variant="outline" onClick={() => setDialog({ mode: 'create' })}>
            <Plus />
            Nouvelle personne
          </Button>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="bg-card border-foreground/20 rounded-xl border p-4 shadow-sm">
          <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Vous devez (total)</dt>
          <dd className="text-money-out mt-1 text-lg font-semibold tabular-nums sm:text-xl">{formatAmount(owedByYou)}</dd>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">On vous doit</dt>
          <dd className="text-money-in mt-1 text-lg font-semibold tabular-nums sm:text-xl">{formatAmount(owedToYou)}</dd>
        </div>
        <div className="bg-card col-span-2 rounded-xl border p-4 md:col-span-1">
          <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Personnes</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums sm:text-xl">{people.length}</dd>
        </div>
      </dl>

      <section className="bg-card rounded-xl border" aria-label="Liste des personnes">
        <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              type="search"
              placeholder="Rechercher un nom, une activité, un téléphone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              aria-label="Rechercher une personne"
            />
          </div>
          <label className="flex items-center gap-2 text-sm whitespace-nowrap">
            <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="size-4" />
            Avec un solde seulement
          </label>
        </div>

        {shown.length === 0 ? (
          <p className="text-muted-foreground px-4 py-10 text-center text-sm">
            {people.length === 0 ? 'Aucune personne pour le moment.' : 'Aucune personne ne correspond.'}
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                    <SortableHeader sort={sort} column="name" className="px-4">Nom</SortableHeader>
                    <SortableHeader sort={sort} column="phone" className="px-2">Téléphone</SortableHeader>
                    <SortableHeader sort={sort} column="receipts" align="right" className="px-2">Achats</SortableHeader>
                    <SortableHeader sort={sort} column="paid" align="right" className="px-2">Payé</SortableHeader>
                    <SortableHeader sort={sort} column="balance" align="right" className="px-2">Solde</SortableHeader>
                    <SortableHeader sort={sort} column="received" align="right" className="px-2">Reçu de lui</SortableHeader>
                    <SortableHeader sort={sort} column="last" align="right" className="px-4">Dernière opération</SortableHeader>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/60 border-b last:border-0">
                      <td className="px-4 py-2.5">
                        <Link to="/people/$personId" params={{ personId: String(p.id) }} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                        {p.occupation && <p className="text-muted-foreground text-xs">{p.occupation}</p>}
                      </td>
                      <td className="px-2 py-2.5 whitespace-nowrap">{p.phone ?? ''}</td>
                      <td className="px-2 py-2.5 text-right whitespace-nowrap tabular-nums">{formatAmount(p.receiptsTotal)}</td>
                      <td className="px-2 py-2.5 text-right whitespace-nowrap tabular-nums">{formatAmount(p.paidTotal)}</td>
                      <td className="px-2 py-2.5 text-right font-semibold">
                        <BalanceCell balance={p.balance} />
                        {p.balance < 0 && <p className="text-muted-foreground text-xs font-normal">vous doit</p>}
                      </td>
                      <td className="px-2 py-2.5 text-right whitespace-nowrap tabular-nums">
                        {p.receivedTotal ? formatAmount(p.receivedTotal) : ''}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">
                        {p.lastDate ? formatDayShort(p.lastDate) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y md:hidden">
              {sorted.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => open(p)} className="active:bg-muted/60 flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {[p.occupation, p.lastDate && `dernière opération ${formatDayShort(p.lastDate)}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <BalanceCell balance={p.balance} className="font-semibold" />
                      {p.balance !== 0 && <p className="text-muted-foreground text-xs">{describeBalance(p.balance).label.toLowerCase()}</p>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <PersonFormDialog
        state={dialog}
        onClose={() => setDialog(null)}
        onCreated={(id) => void navigate({ to: '/people/$personId', params: { personId: String(id) } })}
      />
    </div>
  )
}
