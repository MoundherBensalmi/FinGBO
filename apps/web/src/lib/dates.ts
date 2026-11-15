import { addDays, addMonths, endOfMonth, format, formatDistanceToNowStrict, parseISO, startOfMonth } from 'date-fns'
import { fr } from 'date-fns/locale'

// Business days are plain "YYYY-MM-DD" strings in local time (no timezone shifts).

export const toIsoDate = (date: Date): string => format(date, 'yyyy-MM-dd')
export const todayIso = (): string => toIsoDate(new Date())
export const fromIsoDate = (iso: string): Date => parseISO(iso)
export const shiftIsoDate = (iso: string, days: number): string => toIsoDate(addDays(parseISO(iso), days))

/** "jeudi 13 novembre 2026" */
export const formatDayLong = (iso: string): string =>
  format(parseISO(iso), 'EEEE d MMMM yyyy', { locale: fr })

/** "13/11/2026" */
export const formatDayShort = (iso: string): string => format(parseISO(iso), 'dd/MM/yyyy')

/** "14:05" */
export const formatTime = (date: Date): string => format(date, 'HH:mm')

// Times of day are "HH:MM" or "HH:MM:SS" strings in local time, like the business days.

/** The time it is now, "14:05". */
export const currentTime = (): string => formatTime(new Date())

/** "14:05:30" -> "14:05" */
export const formatClock = (time: string): string => time.slice(0, 5)

/**
 * What the user typed as a time, as "HH:MM": "9:30", "930" and "0930" give "09:30", "14" gives "14:00".
 * Returns null when it is not a time of day.
 */
export function normalizeTime(text: string): string | null {
  const typed = text.trim()
  const parts = /^(\d{1,2}):(\d{0,2})$/.exec(typed) ?? /^(\d{1,2}?)(\d{2})?$/.exec(typed)
  if (!parts?.[1]) return null
  const hours = Number(parts[1])
  const minutes = Number(parts[2] ?? 0)
  if (hours > 23 || minutes > 59) return null
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

// Months are "YYYY-MM" strings.

export const currentMonth = (): string => format(new Date(), 'yyyy-MM')
export const shiftMonth = (month: string, by: number): string => format(addMonths(parseISO(`${month}-01`), by), 'yyyy-MM')

/** First and last day of a month, e.g. "2031-03" -> { from: "2031-03-01", to: "2031-03-31" } */
export const monthRange = (month: string) => {
  const first = parseISO(`${month}-01`)
  return { from: toIsoDate(startOfMonth(first)), to: toIsoDate(endOfMonth(first)) }
}

/** "mars 2031" */
export const formatMonth = (month: string): string => format(parseISO(`${month}-01`), 'MMMM yyyy', { locale: fr })

/** "13/11/2026 à 14:05" */
export const formatDateTime = (date: Date): string => format(date, "dd/MM/yyyy 'à' HH:mm")

/** "il y a 5 minutes", "il y a 2 jours" */
export const formatAgo = (date: Date): string => formatDistanceToNowStrict(date, { locale: fr, addSuffix: true })
