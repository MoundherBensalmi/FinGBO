import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { ArrowLeft, MapPin, Minus, Pencil, Phone, Plus, Tag } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { type MovementDialogState, MovementFormDialog } from '@/features/movements/movement-form-dialog'
import { describeBalance } from '@/features/people/balance'
import { CarriedList } from '@/features/people/carried-list'
import { type PersonDialogState, PersonFormDialog } from '@/features/people/person-form-dialog'
import { PersonStatement } from '@/features/people/person-statement'
import { type ReceiptDialogState, ReceiptFormDialog } from '@/features/receipts/receipt-form-dialog'
import { isTRPCError } from '@/lib/errors'
import { todayIso } from '@/lib/dates'
import { formatAmount } from '@/lib/money'
import { cn } from '@/lib/utils'

const parseId = (value: string) => {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export const Route = createFileRoute('/_app/people/$personId')({
  loader: async ({ context: { queryClient, trpc }, params }) => {
    const id = parseId(params.personId)
    if (!id) throw notFound()
    void queryClient.prefetchQuery(trpc.people.list.queryOptions())
    void queryClient.prefetchQuery(trpc.categories.list.queryOptions())
    try {
      await queryClient.ensureQueryData(trpc.people.account.queryOptions({ id }))
    } catch (err) {
      if (isTRPCError(err) && err.data?.code === 'NOT_FOUND') throw notFound()
      throw err
    }
  },
  component: PersonPage,
  notFoundComponent: () => (
    <div className="flex flex-col items-start gap-3">
      <p>Cette personne n’existe pas.</p>
      <Button asChild variant="outline">
        <Link to="/people">Retour aux personnes</Link>
      </Button>
    </div>
  ),
})

function PersonPage() {
  const { trpc } = Route.useRouteContext()
  const id = parseId(Route.useParams().personId)!
  const { data: user } = useSuspenseQuery(trpc.auth.me.queryOptions())
  const { data } = useSuspenseQuery(trpc.people.account.queryOptions({ id }))
  const canEdit = user.role === 'admin'
  const { person, totals, statement, carried } = data
  const balance = describeBalance(totals.balance)

  const [tab, setTab] = useState<'account' | 'carried'>('account')
  const [personDialog, setPersonDialog] = useState<PersonDialogState | null>(null)
  const [receiptDialog, setReceiptDialog] = useState<ReceiptDialogState | null>(null)
  const [movementDialog, setMovementDialog] = useState<MovementDialogState | null>(null)

  const tiles = [
    { label: 'Achats (reçus)', value: formatAmount(totals.receiptsTotal), tone: null },
    { label: 'Payé', value: formatAmount(totals.paidTotal), tone: null },
    { label: balance.label, value: formatAmount(Math.abs(totals.balance)), tone: balance.tone, strong: true },
    { label: 'Reçu de lui', value: formatAmount(totals.receivedTotal), tone: null },
  ] as const

  return (
    <div className="flex flex-col gap-4">
      <Link to="/people" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm">
        <ArrowLeft className="size-4" />
        Personnes
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight break-words">{person.name}</h1>
          <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {person.occupation && <span>{person.occupation}</span>}
            {person.phone && (
              <a href={`tel:${person.phone.replace(/\s+/g, '')}`} className="hover:text-foreground inline-flex items-center gap-1">
                <Phone className="size-3.5" />
                {person.phone}
              </a>
            )}
            {person.address && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {person.address}
              </span>
            )}
            {person.defaultCategory && (
              <span className="inline-flex items-center gap-1">
                <Tag className="size-3.5" />
                {person.defaultCategory.name}
              </span>
            )}
          </div>
          {person.note && <p className="mt-2 text-sm break-words">{person.note}</p>}
        </div>

        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setReceiptDialog({ mode: 'create', date: todayIso(), personId: person.id, categoryId: person.defaultCategoryId })
              }
            >
              <Plus />
              Nouveau reçu
            </Button>
            <Button
              variant="outline"
              className="text-money-out"
              onClick={() =>
                setMovementDialog({
                  mode: 'create',
                  direction: 'out',
                  date: todayIso(),
                  personId: person.id,
                  categoryId: person.defaultCategoryId,
                })
              }
            >
              <Minus />
              Payer
            </Button>
            <Button variant="ghost" onClick={() => setPersonDialog({ mode: 'edit', person })} aria-label="Modifier la personne">
              <Pencil />
              <span className="sm:hidden lg:inline">Modifier</span>
            </Button>
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className={cn('bg-card rounded-xl border p-4', 'strong' in t && 'border-foreground/20 shadow-sm')}>
            <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{t.label}</dt>
            <dd
              className={cn(
                'mt-1 text-lg font-semibold tabular-nums sm:text-xl',
                t.tone === 'out' && 'text-money-out',
                t.tone === 'in' && 'text-money-in',
              )}
            >
              {t.value}
            </dd>
          </div>
        ))}
      </dl>

      <section className="bg-card rounded-xl border">
        <div role="tablist" aria-label="Vues" className="flex gap-1 border-b px-2">
          {(
            [
              ['account', `Compte (${statement.length})`],
              ['carried', `A porté (${carried.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                '-mb-px border-b-2 px-3 py-3 text-sm font-medium',
                tab === key ? 'border-foreground' : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div role="tabpanel">
          {tab === 'account' ? (
            <PersonStatement
              lines={statement}
              onOpen={
                canEdit
                  ? (line) =>
                      line.type === 'receipt'
                        ? setReceiptDialog({ mode: 'edit', entry: line.entry })
                        : setMovementDialog({ mode: 'edit', entry: line.entry })
                  : undefined
              }
            />
          ) : (
            <CarriedList entries={carried} />
          )}
        </div>
      </section>

      <PersonFormDialog state={personDialog} onClose={() => setPersonDialog(null)} />
      <ReceiptFormDialog state={receiptDialog} onClose={() => setReceiptDialog(null)} />
      <MovementFormDialog state={movementDialog} onClose={() => setMovementDialog(null)} />
    </div>
  )
}
