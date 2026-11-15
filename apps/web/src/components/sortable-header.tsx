import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

// Click a column name to sort the table by it: 1st click ascending, 2nd descending,
// 3rd back to the table's own order. Rows with no value always go last.

export type SortValue = string | number | boolean | Date | null | undefined
export type SortDirection = 'asc' | 'desc'
export type SortColumns<T, K extends string> = Record<K, (row: T) => SortValue>

export type SortState<K extends string> = {
  key: K | null
  direction: SortDirection
  toggle: (key: K) => void
}

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })

function compareValues(a: SortValue, b: SortValue): number {
  if (a instanceof Date) a = a.getTime()
  if (b instanceof Date) b = b.getTime()
  if (typeof a === 'string' && typeof b === 'string') return collator.compare(a, b)
  if (typeof a === 'boolean') a = Number(a)
  if (typeof b === 'boolean') b = Number(b)
  return (a as number) < (b as number) ? -1 : (a as number) > (b as number) ? 1 : 0
}

const isEmpty = (v: SortValue) => v === null || v === undefined || v === ''

/** The rows sorted by the clicked column (the original order when none is), and the sort state for the headers. */
export function useSort<T, K extends string>(rows: T[], columns: SortColumns<T, K>) {
  const [{ key, direction }, setState] = useState<{ key: K | null; direction: SortDirection }>({
    key: null,
    direction: 'asc',
  })

  // From the previous state, so quick successive clicks each count.
  const toggle = (next: K) =>
    setState((prev) => {
      if (prev.key !== next) return { key: next, direction: 'asc' }
      if (prev.direction === 'asc') return { key: next, direction: 'desc' }
      return { key: null, direction: 'asc' }
    })

  const sorted = useMemo(() => {
    if (!key) return rows
    const value = columns[key]
    const sign = direction === 'asc' ? 1 : -1
    // Array sort is stable: equal rows keep the table's own order.
    return [...rows].sort((ra, rb) => {
      const a = value(ra)
      const b = value(rb)
      if (isEmpty(a) || isEmpty(b)) return isEmpty(a) === isEmpty(b) ? 0 : isEmpty(a) ? 1 : -1
      return sign * compareValues(a, b)
    })
    // `columns` is usually a new object on every render; the key picks the function.
  }, [rows, key, direction])

  const sort: SortState<K> = { key, direction, toggle }
  return { sorted, sort }
}

type SortableHeaderProps<K extends string> = {
  sort: SortState<K>
  column: K
  children: ReactNode
  /** Right-aligned for amounts. */
  align?: 'left' | 'right'
  className?: string
}

/** A table header cell whose name sorts the table when clicked. */
export function SortableHeader<K extends string>({ sort, column, children, align = 'left', className }: SortableHeaderProps<K>) {
  const active = sort.key === column
  const Icon = !active ? ChevronsUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown
  return (
    <th
      className={cn('py-2 font-medium', align === 'right' && 'text-right', className)}
      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => sort.toggle(column)}
        className={cn(
          'hover:text-foreground focus-visible:ring-ring/50 -mx-1 inline-flex items-center gap-1 rounded px-1 uppercase outline-none focus-visible:ring-2',
          align === 'right' && 'flex-row-reverse',
          active && 'text-foreground',
        )}
        title="Trier"
      >
        {children}
        <Icon className={cn('size-3.5 shrink-0', !active && 'opacity-40')} />
      </button>
    </th>
  )
}
