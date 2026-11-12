/**
 * Money is always handled as a whole number of centimes (1 DA = 100 centimes).
 * Convert only at the edges: parseDA() for what the user types,
 * formatDA() for what the user sees.
 */
export type Centimes = number & { readonly __brand: 'Centimes' }

/** Largest amount accepted for one entry: 1,000,000,000 DA. */
export const MAX_CENTIMES = 1_000_000_000_00 as Centimes

const daFormat = new Intl.NumberFormat('fr-DZ', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** 125050 -> "1 250,50 DA" */
export function formatDA(amount: Centimes): string {
  return `${daFormat.format(amount / 100)} DA`
}

/**
 * Parses what the user typed into centimes, without floating-point maths.
 * Accepts "1250", "1250,5", "1 250.50". Returns null when the text is not a valid amount.
 */
export function parseDA(input: string): Centimes | null {
  const clean = input.replace(/[\s  ]/g, '').replace(',', '.')
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(clean)
  if (!match) return null
  const [, dinars = '0', cents = ''] = match
  const value = Number(dinars) * 100 + Number(cents.padEnd(2, '0'))
  return Number.isSafeInteger(value) && value <= MAX_CENTIMES ? (value as Centimes) : null
}

/** Adds amounts exactly (they are integers). */
export function sumCentimes(amounts: readonly Centimes[]): Centimes {
  return amounts.reduce<number>((total, a) => total + a, 0) as Centimes
}
