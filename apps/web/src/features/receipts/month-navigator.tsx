import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { currentMonth, formatMonth } from '@/lib/dates'

type MonthNavigatorProps = {
  month: string
  onShift: (by: number) => void
  onToday: () => void
}

/** ‹ mars 2031 › and a shortcut back to this month. */
export function MonthNavigator({ month, onShift, onToday }: MonthNavigatorProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button variant="outline" size="icon" aria-label="Mois précédent" onClick={() => onShift(-1)}>
        <ChevronLeft />
      </Button>
      <span className="bg-background min-w-36 rounded-md border px-3 py-1.5 text-center text-sm font-medium first-letter:uppercase">
        {formatMonth(month)}
      </span>
      <Button variant="outline" size="icon" aria-label="Mois suivant" onClick={() => onShift(1)}>
        <ChevronRight />
      </Button>
      {month !== currentMonth() && (
        <Button variant="ghost" onClick={onToday}>
          Ce mois-ci
        </Button>
      )}
    </div>
  )
}
