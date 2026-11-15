import type { RouterOutputs } from '@/lib/trpc'

export type DayData = RouterOutputs['movements']['day']
export type DayEntry = DayData['entries'][number]
/** A movement as the edit form needs it (from the caisse day or a person's statement). */
export type EditableMovement = Omit<DayEntry, 'balanceAfter'>
export type PersonOption = RouterOutputs['people']['list'][number]
export type CategoryOption = RouterOutputs['categories']['list'][number]
