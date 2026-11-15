import type { RouterOutputs } from '@/lib/trpc'

export type ReceiptsData = RouterOutputs['receipts']['list']
export type ReceiptEntry = ReceiptsData['entries'][number]
