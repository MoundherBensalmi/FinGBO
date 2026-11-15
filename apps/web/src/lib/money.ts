import { type Centimes, formatDA } from '@fingbo/shared/money'

/** Amounts from the API are centimes; this shows them as "1 250,50 DA". */
export const formatAmount = (centimes: number): string => formatDA(centimes as Centimes)

/** Centimes -> text for an input field ("1250,50"), without the currency. */
export const amountToInput = (centimes: number): string =>
  (centimes / 100).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })
