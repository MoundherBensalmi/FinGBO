import { Ban } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AttachmentsBadge } from '@/features/files/attachments-badge'
import { formatDateTime, formatDayShort } from '@/lib/dates'
import { formatAmount } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { StatementLine } from './balance'

type PersonStatementProps = {
  lines: StatementLine[]
  /** Admins can open a line to edit or cancel the receipt or movement. */
  onOpen?: ((line: StatementLine) => void) | undefined
}

const userLabel = (u: { username: string; fullName: string | null } | null) => u?.fullName ?? u?.username ?? '?'

/** What a line is, in the user's words. */
function operation(line: StatementLine): { label: string; tone: 'in' | 'out' | null } {
  if (line.type === 'receipt') return { label: 'Reçu (achat)', tone: null }
  return line.entry.direction === 'out' ? { label: 'Paiement', tone: 'out' } : { label: 'Entrée (reçu de lui)', tone: 'in' }
}

function Badges({ line }: { line: StatementLine }) {
  const e = line.entry
  return (
    <>
      {e.cancelledAt && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className="gap-1" tabIndex={0}>
              <Ban className="size-3" />
              Annulé
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            Annulé par {userLabel(e.cancelledBy)} le {formatDateTime(e.cancelledAt)}
            <br />
            Raison : {e.cancelReason}
          </TooltipContent>
        </Tooltip>
      )}
      {!e.cancelledAt && line.type === 'movement' && e.amount === 0 && (
        <Badge variant="outline" className="border-warning text-warning">
          Trace · 0 DA
        </Badge>
      )}
      <AttachmentsBadge files={e.files} />
    </>
  )
}

function rowActions(line: StatementLine, onOpen: PersonStatementProps['onOpen']) {
  if (!onOpen || line.entry.cancelledAt) return {}
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': `Modifier : ${operation(line).label} du ${formatDayShort(line.entry.date)}`,
    onClick: () => onOpen(line),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onOpen(line)
      }
    },
  }
}

/** Receipts and money movements with this person, newest first, with the balance after each. */
export function PersonStatement({ lines, onOpen }: PersonStatementProps) {
  if (lines.length === 0) {
    return <p className="text-muted-foreground px-4 py-10 text-center text-sm">Aucune opération avec cette personne.</p>
  }
  const newestFirst = [...lines].reverse()

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs uppercase">
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-2 py-2 font-medium">Opération</th>
              <th className="px-2 py-2 font-medium">Catégorie</th>
              <th className="px-2 py-2 font-medium">Observation</th>
              <th className="px-2 py-2 text-right font-medium">Achat</th>
              <th className="px-2 py-2 text-right font-medium">Payé</th>
              <th className="px-2 py-2 text-right font-medium">Reçu</th>
              <th className="px-4 py-2 text-right font-medium">Solde dû</th>
            </tr>
          </thead>
          <tbody>
            {newestFirst.map((line) => {
              const e = line.entry
              const cancelled = Boolean(e.cancelledAt)
              const op = operation(line)
              const amount = formatAmount(e.amount)
              const column = line.type === 'receipt' ? 'receipt' : line.entry.direction
              return (
                <tr
                  key={`${line.type}-${e.id}`}
                  {...rowActions(line, onOpen)}
                  className={cn(
                    'border-b last:border-0',
                    cancelled && 'text-muted-foreground bg-muted/40',
                    onOpen && !cancelled && 'hover:bg-muted/60 focus-visible:bg-muted/60 cursor-pointer outline-none',
                  )}
                >
                  <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{formatDayShort(e.date)}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={cn('font-medium', cancelled && 'line-through')}>{op.label}</span>
                      <Badges line={line} />
                    </div>
                    {line.type === 'movement' && line.entry.byPerson && (
                      <p className="text-muted-foreground text-xs">par {line.entry.byPerson.name}</p>
                    )}
                  </td>
                  <td className="px-2 py-2.5">{e.category.name}</td>
                  <td className="max-w-64 px-2 py-2.5">
                    <span className="line-clamp-2 break-words">{e.note ?? ''}</span>
                  </td>
                  <td className={cn('px-2 py-2.5 text-right whitespace-nowrap tabular-nums', cancelled && 'line-through')}>
                    {column === 'receipt' ? amount : ''}
                  </td>
                  <td className={cn('px-2 py-2.5 text-right whitespace-nowrap tabular-nums', !cancelled && 'text-money-out', cancelled && 'line-through')}>
                    {column === 'out' ? amount : ''}
                  </td>
                  <td className={cn('px-2 py-2.5 text-right whitespace-nowrap tabular-nums', !cancelled && 'text-money-in', cancelled && 'line-through')}>
                    {column === 'in' ? amount : ''}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap tabular-nums">
                    {line.balanceAfter === null ? '—' : formatAmount(line.balanceAfter)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y md:hidden">
        {newestFirst.map((line) => {
          const e = line.entry
          const cancelled = Boolean(e.cancelledAt)
          const op = operation(line)
          const sign = line.type === 'receipt' ? '+' : line.entry.direction === 'out' ? '−' : ''
          return (
            <li
              key={`${line.type}-${e.id}`}
              {...rowActions(line, onOpen)}
              className={cn(
                'flex flex-col gap-1 px-4 py-3',
                cancelled && 'bg-muted/40 text-muted-foreground',
                onOpen && !cancelled && 'active:bg-muted/60 cursor-pointer outline-none focus-visible:bg-muted/60',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 font-medium">
                  <span className={cn(cancelled && 'line-through')}>{op.label}</span>
                  <Badges line={line} />
                </div>
                <span
                  className={cn(
                    'shrink-0 font-semibold whitespace-nowrap tabular-nums',
                    !cancelled && op.tone === 'out' && 'text-money-out',
                    !cancelled && op.tone === 'in' && 'text-money-in',
                    cancelled && 'line-through',
                  )}
                >
                  {sign} {formatAmount(e.amount)}
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                {formatDayShort(e.date)} · {e.category.name}
                {line.type === 'movement' && line.entry.byPerson && ` · par ${line.entry.byPerson.name}`}
              </p>
              {e.note && <p className="text-sm break-words">{e.note}</p>}
              {line.balanceAfter !== null && (
                <p className="text-muted-foreground self-end text-xs tabular-nums">Solde dû : {formatAmount(line.balanceAfter)}</p>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
