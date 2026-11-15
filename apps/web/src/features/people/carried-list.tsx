import { PersonLink } from '@/components/person-link'
import { Badge } from '@/components/ui/badge'
import { formatDayShort } from '@/lib/dates'
import { formatAmount } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { PersonAccount } from './balance'

/** Movements this person carried ("par"): money they took to someone, or brought back. */
export function CarriedList({ entries }: { entries: PersonAccount['carried'] }) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground px-4 py-10 text-center text-sm">Cette personne n’a porté aucun argent.</p>
  }
  return (
    <ul className="divide-y">
      {entries.map((e) => {
        const cancelled = Boolean(e.cancelledAt)
        const isOut = e.direction === 'out'
        return (
          <li key={e.id} className={cn('flex flex-col gap-1 px-4 py-3', cancelled && 'bg-muted/40 text-muted-foreground')}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm">
                <span className="font-medium">{isOut ? 'A porté à' : 'A rapporté de'}</span>
                {e.person ? (
                  <PersonLink id={e.person.id} name={e.person.name} className="font-medium" />
                ) : (
                  <span className="text-muted-foreground italic">dépense ponctuelle</span>
                )}
                {cancelled && <Badge variant="destructive">Annulé</Badge>}
              </div>
              <span
                className={cn(
                  'shrink-0 font-semibold whitespace-nowrap tabular-nums',
                  !cancelled && (isOut ? 'text-money-out' : 'text-money-in'),
                  cancelled && 'line-through',
                )}
              >
                {isOut ? '−' : '+'} {formatAmount(e.amount)}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              {formatDayShort(e.date)} · {e.category.name}
            </p>
            {e.note && <p className="text-sm break-words">{e.note}</p>}
          </li>
        )
      })}
    </ul>
  )
}
