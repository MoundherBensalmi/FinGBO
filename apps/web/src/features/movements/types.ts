import type { RouterOutputs } from '@/lib/trpc'

export type DayData = RouterOutputs['movements']['day']
export type DayEntry = DayData['entries'][number]
export type PersonOption = RouterOutputs['people']['list'][number]
export type CategoryOption = RouterOutputs['categories']['list'][number]
