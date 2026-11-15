import { queryClient, trpc } from './trpc'

/**
 * After any change to the caisse, receipts or people, refresh everything that
 * depends on them (day view, receipts lists, balances, person pages).
 */
export function invalidateLedger(): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries(trpc.movements.pathFilter()),
    queryClient.invalidateQueries(trpc.receipts.pathFilter()),
    queryClient.invalidateQueries(trpc.people.pathFilter()),
  ]).then(() => undefined)
}
