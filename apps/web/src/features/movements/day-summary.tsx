import { formatAmount } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { DayData } from './types'

/** Previous balance, money in, money out and the balance at the end of the day. */
export function DaySummary({ day }: { day: DayData }) {
  const tiles = [
    { label: 'Solde précédent', value: formatAmount(day.openingBalance), tone: day.openingBalance < 0 ? 'out' : null },
    { label: 'Entrées', value: `+ ${formatAmount(day.totalIn)}`, tone: 'in' },
    { label: 'Sorties', value: `− ${formatAmount(day.totalOut)}`, tone: 'out' },
    {
      label: 'Solde du jour',
      value: formatAmount(day.closingBalance),
      tone: day.closingBalance < 0 ? 'out' : null,
      strong: true,
    },
  ] as const

  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((t) => (
        <div
          key={t.label}
          className={cn('bg-card rounded-xl border p-4', 'strong' in t && 'border-foreground/20 shadow-sm')}
        >
          <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{t.label}</dt>
          <dd
            className={cn(
              'mt-1 text-lg font-semibold tabular-nums sm:text-xl',
              t.tone === 'in' && 'text-money-in',
              t.tone === 'out' && 'text-money-out',
            )}
          >
            {t.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
