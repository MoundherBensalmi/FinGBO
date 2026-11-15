import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

/** A person's name that opens their page; doesn't trigger the row it sits in. */
export function PersonLink({ id, name, className }: { id: number; name: string; className?: string }) {
  return (
    <Link
      to="/people/$personId"
      params={{ personId: String(id) }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className={cn('hover:underline', className)}
    >
      {name}
    </Link>
  )
}
