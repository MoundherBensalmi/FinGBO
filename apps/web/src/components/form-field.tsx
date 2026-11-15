import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type FormFieldProps = {
  label: ReactNode
  /** id of the control inside, so the label is linked to it. */
  htmlFor: string
  /** Validation message; give the control aria-describedby={`${htmlFor}-error`}. */
  error?: string | undefined
  hint?: ReactNode
  className?: string
  children: ReactNode
}

export function FormField({ label, htmlFor, error, hint, className, children }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-destructive text-sm">
          {error}
        </p>
      ) : (
        hint && <p className="text-muted-foreground text-xs">{hint}</p>
      )}
    </div>
  )
}

/** aria props for a control linked to a FormField error. */
export const errorProps = (id: string, error: string | undefined) =>
  error ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-error` } : {}
