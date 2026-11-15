import { Ban } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { PersonLink } from '@/components/person-link'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AttachmentsBadge } from '@/features/files/attachments-badge'
import { formatDateTime, formatDayShort } from '@/lib/dates'
import { formatAmount } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { ReceiptEntry } from './types'

type ReceiptsListProps = {
  entries: ReceiptEntry[]
  total: number
  /** Admins can open a receipt to edit or cancel it. */
  onOpen?: ((entry: ReceiptEntry) => void) | undefined
  /** Hide the person column (on a person's own page). */
  hidePerson?: boolean
}

const userLabel = (u: { username: string; fullName: string | null } | null) => u?.fullName ?? u?.username ?? '?'

function Badges({ entry }: { entry: ReceiptEntry }) {
  return (
    <>
      {entry.cancelledAt && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className="gap-1" tabIndex={0}>
              <Ban className="size-3" />
              Annulé
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            Annulé par {userLabel(entry.cancelledBy)} le {formatDateTime(entry.cancelledAt)}
            <br />
            Raison : {entry.cancelReason}
          </TooltipContent>
        </Tooltip>
      )}
      <AttachmentsBadge files={entry.files} />
    </>
  )
}

function rowActions(entry: ReceiptEntry, onOpen: ReceiptsListProps['onOpen']) {
  if (!onOpen || entry.cancelledAt) return {}
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': `Modifier le reçu de ${entry.person.name}`,
    onClick: () => onOpen(entry),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onOpen(entry)
      }
    },
  }
}

export function ReceiptsList({ entries, total, onOpen, hidePerson }: ReceiptsListProps) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground px-4 py-10 text-center text-sm">Aucun reçu pour cette période.</p>
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs uppercase">
              <th className="px-4 py-2 font-medium">Date</th>
              {!hidePerson && <th className="px-2 py-2 font-medium">Acheté chez</th>}
              <th className="px-2 py-2 font-medium">Catégorie</th>
              <th className="px-2 py-2 font-medium">Observation</th>
              <th className="px-4 py-2 text-right font-medium">Montant</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const cancelled = Boolean(entry.cancelledAt)
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
                  <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{formatDayShort(entry.date)}</td>
                  {!hidePerson && (
                    <td className="px-2 py-2.5 font-medium">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <PersonLink id={entry.person.id} name={entry.person.name} className={cn(cancelled && 'line-through')} />
                        <Badges entry={entry} />
                      </div>
                    </td>
                  )}
                  <td className="px-2 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {entry.category.name}
                      {hidePerson && <Badges entry={entry} />}
                    </div>
                  </td>
                  <td className="max-w-72 px-2 py-2.5">
                    <span className="line-clamp-2 break-words">{entry.note ?? ''}</span>
                  </td>
                  <td className={cn('px-4 py-2.5 text-right font-medium whitespace-nowrap tabular-nums', cancelled && 'line-through')}>
                    {formatAmount(entry.amount)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td className="px-4 py-2.5" colSpan={hidePerson ? 3 : 4}>
                Total
              </td>
              <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">{formatAmount(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <ul className="divide-y md:hidden">
        {entries.map((entry) => {
          const cancelled = Boolean(entry.cancelledAt)
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
                  {hidePerson ? (
                    <span className={cn(cancelled && 'line-through')}>{entry.category.name}</span>
                  ) : (
                    <PersonLink id={entry.person.id} name={entry.person.name} className={cn('truncate', cancelled && 'line-through')} />
                  )}
                  <Badges entry={entry} />
                </div>
                <span className={cn('shrink-0 font-semibold whitespace-nowrap tabular-nums', cancelled && 'line-through')}>
                  {formatAmount(entry.amount)}
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                {formatDayShort(entry.date)}
                {!hidePerson && ` · ${entry.category.name}`}
              </p>
              {entry.note && <p className="text-sm break-words">{entry.note}</p>}
            </li>
          )
        })}
      </ul>
    </>
  )
}
