import type { RouterOutputs } from '@/lib/trpc'

export type PersonBalance = RouterOutputs['people']['balances'][number]
export type PersonAccount = RouterOutputs['people']['account']
export type StatementLine = PersonAccount['statement'][number]

/** Balance = receipts - payments: above 0 you owe them, below 0 they owe you (e.g. an advance). */
export function describeBalance(balance: number): { label: string; tone: 'out' | 'in' | null } {
  if (balance > 0) return { label: 'Vous devez', tone: 'out' }
  if (balance < 0) return { label: 'Vous doit', tone: 'in' }
  return { label: 'Soldé', tone: null }
}
