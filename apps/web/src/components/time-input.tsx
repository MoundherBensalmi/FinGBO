import type { ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { normalizeTime } from '@/lib/dates'
import { cn } from '@/lib/utils'

type TimeInputProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  /** "HH:MM" on 24 hours; may be incomplete while the user is typing. */
  value: string
  onChange: (value: string) => void
}

/**
 * A time of day typed on 24 hours: "1430" or "14:30", and "930" or "9:30" become "09:30"
 * when leaving the field. (The browser's own time field shows AM/PM in some languages.)
 */
export function TimeInput({ value, onChange, onBlur, className, ...props }: TimeInputProps) {
  function handleChange(text: string) {
    let next = text.replace(/[h.,\s]/gi, ':').replace(/[^\d:]/g, '').slice(0, 5)
    // Typing forward: after two digits that make a valid hour, the ":" comes by itself.
    if (next.length > value.length && /^([01]\d|2[0-3])$/.test(next)) next += ':'
    onChange(next)
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="HH:MM"
      maxLength={5}
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={(e) => {
        const normalized = normalizeTime(value)
        if (normalized && normalized !== value) onChange(normalized)
        onBlur?.(e)
      }}
      className={cn('tabular-nums', className)}
    />
  )
}
