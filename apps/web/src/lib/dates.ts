import { addDays, format, parseISO } from 'date-fns'
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

/** "13/11/2026 à 14:05" */
export const formatDateTime = (date: Date): string => format(date, "dd/MM/yyyy 'à' HH:mm")
