import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { MonthNavigator } from '@/features/receipts/month-navigator'
import { type ReceiptDialogState, ReceiptFormDialog } from '@/features/receipts/receipt-form-dialog'
import { ReceiptsList } from '@/features/receipts/receipts-list'
import { currentMonth, formatMonth, monthRange, shiftMonth, todayIso } from '@/lib/dates'
import { formatAmount } from '@/lib/money'

/** All receipts of one month (this month by default, or ?month=YYYY-MM). */
export const Route = createFileRoute('/_app/receipts')({
  validateSearch: z.object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional().catch(undefined),
  }),
  loaderDeps: ({ search }) => ({ month: search.month ?? currentMonth() }),
  loader: async ({ context: { queryClient, trpc }, deps }) => {
    void queryClient.prefetchQuery(trpc.people.list.queryOptions())
    void queryClient.prefetchQuery(trpc.categories.list.queryOptions())
    await queryClient.ensureQueryData(trpc.receipts.list.queryOptions(monthRange(deps.month)))
  },
  component: ReceiptsPage,
})

function ReceiptsPage() {
  const { trpc } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const month = search.month ?? currentMonth()

  const { data: user } = useSuspenseQuery(trpc.auth.me.queryOptions())
  const { data } = useSuspenseQuery(trpc.receipts.list.queryOptions(monthRange(month)))
  const canEdit = user.role === 'admin'
  const [dialog, setDialog] = useState<ReceiptDialogState | null>(null)

  const toSearch = (m: string) => (m === currentMonth() ? {} : { month: m })
  const shift = (by: number) =>
    void navigate({ search: (prev) => toSearch(shiftMonth(prev.month ?? currentMonth(), by)) })

  // New receipts default to today when looking at this month, else to the 1st of the month shown.
  const newReceiptDate = month === currentMonth() ? todayIso() : monthRange(month).from

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reçus</h1>
          <p className="text-muted-foreground text-sm">Achats chez les personnes : ils s’ajoutent à ce que vous leur devez.</p>
        </div>
        <MonthNavigator month={month} onShift={shift} onToday={() => void navigate({ search: {} })} />
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl border p-4">
          <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase first-letter:uppercase">
            Total {formatMonth(month)}
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums sm:text-xl">{formatAmount(data.total)}</dd>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Nombre de reçus</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums sm:text-xl">{data.count}</dd>
        </div>
      </dl>

      <section className="bg-card rounded-xl border" aria-labelledby="receipts-title">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 id="receipts-title" className="font-semibold">
            Reçus du mois <span className="text-muted-foreground font-normal">({data.count})</span>
          </h2>
          {canEdit && (
            <Button variant="outline" onClick={() => setDialog({ mode: 'create', date: newReceiptDate })}>
              <Plus />
              Nouveau reçu
            </Button>
          )}
        </div>
        <ReceiptsList
          entries={data.entries}
          total={data.total}
          onOpen={canEdit ? (entry) => setDialog({ mode: 'edit', entry }) : undefined}
        />
      </section>

      <ReceiptFormDialog state={dialog} onClose={() => setDialog(null)} />
    </div>
  )
}
