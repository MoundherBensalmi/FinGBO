import { isoDateSchema } from '@fingbo/shared/common'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { DayNavigator } from '@/features/movements/day-navigator'
import { DaySummary } from '@/features/movements/day-summary'
import { type MovementDialogState, MovementFormDialog } from '@/features/movements/movement-form-dialog'
import { MovementsList } from '@/features/movements/movements-list'
import { formatDayLong, shiftIsoDate, todayIso } from '@/lib/dates'

/** The caisse: the movements of one day (today by default, or ?date=YYYY-MM-DD). */
export const Route = createFileRoute('/_app/')({
  validateSearch: z.object({ date: isoDateSchema.optional().catch(undefined) }),
  loaderDeps: ({ search }) => ({ date: search.date ?? todayIso() }),
  loader: async ({ context: { queryClient, trpc }, deps }) => {
    // Lists for the form are fetched in the background; the day is needed to render.
    void queryClient.prefetchQuery(trpc.people.list.queryOptions())
    void queryClient.prefetchQuery(trpc.categories.list.queryOptions())
    await queryClient.ensureQueryData(trpc.movements.day.queryOptions({ date: deps.date }))
  },
  component: CaissePage,
})

function CaissePage() {
  const { trpc } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const date = search.date ?? todayIso()

  const { data: user } = useSuspenseQuery(trpc.auth.me.queryOptions())
  const { data: day } = useSuspenseQuery(trpc.movements.day.queryOptions({ date }))
  const canEdit = user.role === 'admin'

  const [dialog, setDialog] = useState<MovementDialogState | null>(null)
  // Today has no ?date= in the URL, so the page always opens on the current day.
  const toSearch = (next: string) => (next === todayIso() ? {} : { date: next })
  const goTo = (next: string) => void navigate({ search: toSearch(next) })
  const shift = (days: number) =>
    void navigate({ search: (prev) => toSearch(shiftIsoDate(prev.date ?? todayIso(), days)) })
  const add = (direction: 'in' | 'out') => setDialog({ mode: 'create', direction, date })

  const activeCount = day.entries.filter((e) => !e.cancelledAt).length

  return (
    <div className={canEdit ? 'flex flex-col gap-4 pb-20 md:pb-0' : 'flex flex-col gap-4'}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Caisse</h1>
          <p className="text-muted-foreground text-sm first-letter:uppercase">{formatDayLong(date)}</p>
        </div>
        <DayNavigator date={date} onChange={goTo} onShift={shift} />
      </div>

      <DaySummary day={day} />

      <section className="bg-card rounded-xl border" aria-labelledby="movements-title">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 id="movements-title" className="font-semibold">
            Mouvements <span className="text-muted-foreground font-normal">({activeCount})</span>
          </h2>
          {canEdit && (
            <div className="hidden gap-2 md:flex">
              <Button variant="outline" className="text-money-in" onClick={() => add('in')}>
                <Plus />
                Entrée
              </Button>
              <Button variant="outline" className="text-money-out" onClick={() => add('out')}>
                <Minus />
                Sortie
              </Button>
            </div>
          )}
        </div>
        <MovementsList day={day} onOpen={canEdit ? (entry) => setDialog({ mode: 'edit', entry }) : undefined} />
      </section>

      {/* Phone: big buttons always within reach */}
      {canEdit && (
        <div className="bg-background/95 fixed inset-x-0 bottom-0 z-20 grid grid-cols-2 gap-3 border-t p-3 backdrop-blur md:hidden">
          <Button size="lg" variant="outline" className="text-money-in h-12" onClick={() => add('in')}>
            <Plus />
            Entrée
          </Button>
          <Button size="lg" variant="outline" className="text-money-out h-12" onClick={() => add('out')}>
            <Minus />
            Sortie
          </Button>
        </div>
      )}

      <MovementFormDialog state={dialog} onClose={() => setDialog(null)} />
    </div>
  )
}
