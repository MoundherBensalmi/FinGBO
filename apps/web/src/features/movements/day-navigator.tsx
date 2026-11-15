import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DatePicker } from '@/components/date-picker'
import { Button } from '@/components/ui/button'
import { todayIso } from '@/lib/dates'

type DayNavigatorProps = {
  date: string
  onChange: (date: string) => void
  /** Moves by n days from the latest date, so quick repeated clicks all count. */
  onShift: (days: number) => void
}

/** ‹ [date picker] › and a shortcut back to today. */
export function DayNavigator({ date, onChange, onShift }: DayNavigatorProps) {
  const isToday = date === todayIso()

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button variant="outline" size="icon" aria-label="Jour précédent" onClick={() => onShift(-1)}>
        <ChevronLeft />
      </Button>
      <DatePicker value={date} onChange={onChange} aria-label="Choisir une date" className="w-36" />
      <Button variant="outline" size="icon" aria-label="Jour suivant" onClick={() => onShift(1)}>
        <ChevronRight />
      </Button>
      {!isToday && (
        <Button variant="ghost" onClick={() => onChange(todayIso())}>
          Aujourd'hui
        </Button>
      )}
    </div>
  )
}
