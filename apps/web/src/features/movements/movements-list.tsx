import { Ban } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { PersonLink } from '@/components/person-link'
import { SortableHeader, useSort } from '@/components/sortable-header'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatClock, formatDateTime } from '@/lib/dates'
import { formatAmount } from '@/lib/money'
import { cn } from '@/lib/utils'
import { AttachmentsBadge } from '@/features/files/attachments-badge'
import type { DayData, DayEntry } from './types'

type MovementsListProps = {
  day: DayData
  /** Admins can open an entry to edit or cancel it. */
  onOpen?: ((entry: DayEntry) => void) | undefined
}

const userLabel = (u: { username: string; fullName: string | null } | null) => u?.fullName ?? u?.username ?? '?'

function PersonLabel({ entry }: { entry: DayEntry }) {
  if (entry.person) return <PersonLink id={entry.person.id} name={entry.person.name} />
  return <span className="text-muted-foreground italic">{entry.direction === 'out' ? 'Dépense ponctuelle' : 'Sans personne'}</span>
}

function StatusBadges({ entry }: { entry: DayEntry }) {
  return (
    <>
      {entry.cancelledAt && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className="gap-1" tabIndex={0}>
              <Ban className="size-3" />
              Annulée
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            Annulée par {userLabel(entry.cancelledBy)} le {formatDateTime(entry.cancelledAt)}
            <br />
            Raison : {entry.cancelReason}
          </TooltipContent>
        </Tooltip>
      )}
      {!entry.cancelledAt && entry.amount === 0 && (
        <Badge variant="outline" className="border-warning text-warning">
          Trace · 0 DA
        </Badge>
      )}
      <AttachmentsBadge files={entry.files} />
    </>
  )
}

/** Opening by click, Enter or Space, for rows that act as buttons. */
function rowActions(entry: DayEntry, onOpen: MovementsListProps['onOpen']) {
  if (!onOpen || entry.cancelledAt) return {}
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': `Modifier : ${entry.person?.name ?? entry.note ?? 'entrée'}`,
    onClick: () => onOpen(entry),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onOpen(entry)
      }
    },
  }
}

const personName = (e: DayEntry) => e.person?.name ?? (e.direction === 'out' ? 'Dépense ponctuelle' : 'Sans personne')

export function MovementsList({ day, onOpen }: MovementsListProps) {
  const { sorted, sort } = useSort(day.entries, {
    time: (e) => e.time,
    person: personName,
    by: (e) => e.byPerson?.name,
    category: (e) => e.category.name,
    note: (e) => e.note,
    in: (e) => (e.direction === 'in' ? e.amount : null),
    out: (e) => (e.direction === 'out' ? e.amount : null),
    balance: (e) => e.balanceAfter,
  })

  if (day.entries.length === 0) {
    return <p className="text-muted-foreground px-4 py-10 text-center text-sm">Aucun mouvement ce jour-là.</p>
  }

  return (
    <>
      {/* Desktop: table like the old journal */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs uppercase">
              <SortableHeader sort={sort} column="time" className="px-4">Heure</SortableHeader>
              <SortableHeader sort={sort} column="person" className="px-2">Personne</SortableHeader>
              <SortableHeader sort={sort} column="by" className="px-2">Par</SortableHeader>
              <SortableHeader sort={sort} column="category" className="px-2">Catégorie</SortableHeader>
              <SortableHeader sort={sort} column="note" className="px-2">Observation</SortableHeader>
              <SortableHeader sort={sort} column="in" align="right" className="px-2">Entrée</SortableHeader>
              <SortableHeader sort={sort} column="out" align="right" className="px-2">Sortie</SortableHeader>
              <SortableHeader sort={sort} column="balance" align="right" className="px-4">Solde</SortableHeader>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry) => {
              const cancelled = Boolean(entry.cancelledAt)
              const amount = formatAmount(entry.amount)
              return (
                <tr
                  key={entry.id}
                  {...rowActions(entry, onOpen)}
                  className={cn(
                    'border-b last:border-0',
                    cancelled && 'text-muted-foreground bg-muted/40',
                    onOpen && !cancelled && 'hover:bg-muted/60 focus-visible:bg-muted/60 cursor-pointer outline-none',
                  )}
                >
                  <td className="px-4 py-2.5 tabular-nums">{formatClock(entry.time)}</td>
                  <td className="px-2 py-2.5 font-medium">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={cn(cancelled && 'line-through')}>
                        <PersonLabel entry={entry} />
                      </span>
                      <StatusBadges entry={entry} />
                    </div>
                  </td>
                  <td className="px-2 py-2.5">{entry.byPerson?.name ?? '—'}</td>
                  <td className="px-2 py-2.5">{entry.category.name}</td>
                  <td className="max-w-64 px-2 py-2.5">
                    <span className="line-clamp-2 break-words">{entry.note ?? ''}</span>
                  </td>
                  <td className={cn('px-2 py-2.5 text-right whitespace-nowrap tabular-nums', !cancelled && 'text-money-in', cancelled && 'line-through')}>
                    {entry.direction === 'in' ? amount : ''}
                  </td>
                  <td className={cn('px-2 py-2.5 text-right whitespace-nowrap tabular-nums', !cancelled && 'text-money-out', cancelled && 'line-through')}>
                    {entry.direction === 'out' ? amount : ''}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap tabular-nums">
                    {entry.balanceAfter === null ? '—' : formatAmount(entry.balanceAfter)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td className="px-4 py-2.5" colSpan={5}>
                Totaux du jour
              </td>
              <td className="text-money-in px-2 py-2.5 text-right whitespace-nowrap tabular-nums">{formatAmount(day.totalIn)}</td>
              <td className="text-money-out px-2 py-2.5 text-right whitespace-nowrap tabular-nums">{formatAmount(day.totalOut)}</td>
              <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">{formatAmount(day.closingBalance)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Phone: one card per entry */}
      <ul className="divide-y md:hidden">
        {sorted.map((entry) => {
          const cancelled = Boolean(entry.cancelledAt)
          const sign = entry.direction === 'in' ? '+' : '−'
          return (
            <li
              key={entry.id}
              {...rowActions(entry, onOpen)}
              className={cn(
                'flex flex-col gap-1 px-4 py-3',
                cancelled && 'bg-muted/40 text-muted-foreground',
                onOpen && !cancelled && 'active:bg-muted/60 cursor-pointer outline-none focus-visible:bg-muted/60',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 font-medium">
                  <span className={cn('truncate', cancelled && 'line-through')}>
                    <PersonLabel entry={entry} />
                  </span>
                  <StatusBadges entry={entry} />
                </div>
                <span
                  className={cn(
                    'shrink-0 font-semibold whitespace-nowrap tabular-nums',
                    !cancelled && (entry.direction === 'in' ? 'text-money-in' : 'text-money-out'),
                    cancelled && 'line-through',
                  )}
                >
                  {sign} {formatAmount(entry.amount)}
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                {formatClock(entry.time)} · {entry.category.name}
                {entry.byPerson && ` · par ${entry.byPerson.name}`}
              </p>
              {entry.note && <p className="text-sm break-words">{entry.note}</p>}
              {entry.balanceAfter !== null && (
                <p className="text-muted-foreground self-end text-xs tabular-nums">Solde : {formatAmount(entry.balanceAfter)}</p>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
