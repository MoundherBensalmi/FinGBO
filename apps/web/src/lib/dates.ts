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
