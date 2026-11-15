import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronRight, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SortableHeader, useSort } from '@/components/sortable-header'
import { Input } from '@/components/ui/input'
import type { RouterOutputs } from '@/lib/trpc'
import { daysSince, formatDayShort } from '@/lib/dates'
import { formatAmount } from '@/lib/money'
import { cn } from '@/lib/utils'

type Debt = RouterOutputs['people']['debts']['people'][number]
type OpenReceipt = Debt['openReceipts'][number]

/** What you still owe each person, from their receipts not yet paid. */
export const Route = createFileRoute('/_app/debts')({
  loader: ({ context: { queryClient, trpc } }) => queryClient.ensureQueryData(trpc.people.debts.queryOptions()),
  component: DebtsPage,
})

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** "aujourd'hui", "1 jour", "45 jours" */
function ageLabel(iso: string) {
  const days = daysSince(iso)
  if (days <= 0) return 'aujourd’hui'
  return days === 1 ? '1 jour' : `${days} jours`
}

function SummaryCard({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('bg-card rounded-xl border p-4', className)}>
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums sm:text-xl">{value}</dd>
    </div>
  )
}

function OpenReceipts({ receipts }: { receipts: OpenReceipt[] }) {
  const { sorted, sort } = useSort(receipts, {
    date: (r) => r.date,
    age: (r) => daysSince(r.date),
    category: (r) => r.category.name,
    note: (r) => r.note,
    amount: (r) => r.amount,
    remaining: (r) => r.remaining,
  })
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs uppercase">
              <SortableHeader sort={sort} column="date" className="px-4">Date</SortableHeader>
              <SortableHeader sort={sort} column="age" className="px-2">Depuis</SortableHeader>
              <SortableHeader sort={sort} column="category" className="px-2">Catégorie</SortableHeader>
              <SortableHeader sort={sort} column="note" className="px-2">Observation</SortableHeader>
              <SortableHeader sort={sort} column="amount" align="right" className="px-2">Montant</SortableHeader>
              <SortableHeader sort={sort} column="remaining" align="right" className="px-4">Reste à payer</SortableHeader>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-2 whitespace-nowrap tabular-nums">{formatDayShort(r.date)}</td>
                <td className="text-muted-foreground px-2 py-2 whitespace-nowrap">{ageLabel(r.date)}</td>
                <td className="px-2 py-2">{r.category.name}</td>
                <td className="max-w-72 px-2 py-2">
                  <span className="line-clamp-2 break-words">{r.note ?? ''}</span>
                </td>
                <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">{formatAmount(r.amount)}</td>
                <td className="text-money-out px-4 py-2 text-right font-medium whitespace-nowrap tabular-nums">
                  {formatAmount(r.remaining)}
                  {r.remaining < r.amount && <p className="text-muted-foreground text-xs font-normal">en partie payé</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y md:hidden">
        {sorted.map((r) => (
          <li key={r.id} className="flex flex-col gap-0.5 px-4 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <span className="font-medium">{r.category.name}</span>
              <span className="text-money-out shrink-0 font-semibold whitespace-nowrap tabular-nums">{formatAmount(r.remaining)}</span>
            </div>
            <p className="text-muted-foreground text-xs">
              {formatDayShort(r.date)} · {ageLabel(r.date)}
              {r.remaining < r.amount && ` · en partie payé (reçu de ${formatAmount(r.amount)})`}
            </p>
            {r.note && <p className="text-sm break-words">{r.note}</p>}
          </li>
        ))}
      </ul>
    </>
  )
}

function DebtCard({ debt }: { debt: Debt }) {
  const count = debt.openReceipts.length
  return (
    <details className="bg-card group rounded-xl border">
      <summary className="hover:bg-muted/60 flex cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-90" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{debt.name}</p>
          <p className="text-muted-foreground truncate text-xs">
            {[
              debt.occupation,
              `${count} reçu${count > 1 ? 's' : ''} non payé${count > 1 ? 's' : ''}`,
              debt.oldestOpenDate && `depuis le ${formatDayShort(debt.oldestOpenDate)} (${ageLabel(debt.oldestOpenDate)})`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-money-out font-semibold whitespace-nowrap tabular-nums">{formatAmount(debt.balance)}</p>
          <p className="text-muted-foreground hidden text-xs whitespace-nowrap sm:block">
            reçus {formatAmount(debt.receiptsTotal)} − payé {formatAmount(debt.paidTotal)}
          </p>
        </div>
      </summary>
      <div className="border-t">
        <OpenReceipts receipts={debt.openReceipts} />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">
            {debt.phone ? `Tél. ${debt.phone}` : 'Les paiements couvrent d’abord les reçus les plus anciens.'}
          </span>
          <Link to="/people/$personId" params={{ personId: String(debt.id) }} className="font-medium hover:underline">
            Voir le compte →
          </Link>
        </div>
      </div>
    </details>
  )
}

function DebtsPage() {
  const { trpc } = Route.useRouteContext()
  const { data } = useSuspenseQuery(trpc.people.debts.queryOptions())
  const [query, setQuery] = useState('')

  const shown = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return data.people
    return data.people.filter((p) => normalize(`${p.name} ${p.occupation ?? ''} ${p.phone ?? ''}`).includes(q))
  }, [data.people, query])

  const openCount = data.people.reduce((s, p) => s + p.openReceipts.length, 0)
  const oldest = data.people
    .map((p) => p.oldestOpenDate)
    .filter((d): d is string => Boolean(d))
    .sort()[0]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dettes</h1>
        <p className="text-muted-foreground text-sm">
          Ce que vous devez encore, d’après les reçus. Les paiements couvrent d’abord les reçus les plus anciens.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="bg-card border-foreground/20 col-span-2 rounded-xl border p-4 shadow-sm md:col-span-1">
          <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Vous devez (total)</dt>
          <dd className="text-money-out mt-1 text-lg font-semibold tabular-nums sm:text-xl">{formatAmount(data.total)}</dd>
        </div>
        <SummaryCard label="Personnes" value={String(data.people.length)} />
        <SummaryCard label="Reçus non payés" value={String(openCount)} />
        <SummaryCard
          label="Plus ancien"
          value={oldest ? formatDayShort(oldest) : '—'}
          className="col-span-2 md:col-span-1"
        />
      </dl>

      {data.people.length === 0 ? (
        <p className="bg-card text-muted-foreground rounded-xl border px-4 py-10 text-center text-sm">
          Vous ne devez rien à personne : tous les reçus sont payés.
        </p>
      ) : (
        <>
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              type="search"
              placeholder="Rechercher un nom, une activité, un téléphone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-card pl-9"
              aria-label="Rechercher une personne"
            />
          </div>
          {shown.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">Aucune personne ne correspond.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {shown.map((debt) => (
                <DebtCard key={debt.id} debt={debt} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
