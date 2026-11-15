import { format } from 'date-fns'
import { fr as dateFnsFr } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { useState } from 'react'
import { fr } from 'react-day-picker/locale'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatDayShort, fromIsoDate, toIsoDate } from '@/lib/dates'
import { cn } from '@/lib/utils'

type DatePickerProps = {
  /** "YYYY-MM-DD" */
  value: string
  onChange: (value: string) => void
  id?: string
  className?: string
  'aria-label'?: string
}

/** A button showing the date (dd/mm/yyyy) that opens a French calendar. */
export function DatePicker({ value, onChange, id, className, 'aria-label': ariaLabel }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = fromIsoDate(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          aria-label={ariaLabel}
          className={cn('justify-start gap-2 font-normal tabular-nums', className)}
        >
          <CalendarIcon className="text-muted-foreground" />
          {formatDayShort(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={fr}
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          // The year dropdown only offers years in this range (default would stop at this year).
          startMonth={new Date(2015, 0)}
          endMonth={new Date(new Date().getFullYear() + 5, 11)}
          // shadcn formats the month list with the browser language; force French.
          formatters={{ formatMonthDropdown: (month) => format(month, 'LLL', { locale: dateFnsFr }) }}
          onSelect={(date) => {
            if (!date) return
            onChange(toIsoDate(date))
            setOpen(false)
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
