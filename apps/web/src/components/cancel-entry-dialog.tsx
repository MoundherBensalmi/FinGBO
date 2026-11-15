import { Loader2 } from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { FormField, errorProps } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/errors'

type CancelEntryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  /** Sends the cancellation; rejects with an error to show in the dialog. */
  onConfirm: (reason: string) => Promise<unknown>
}

/** Asks for the reason before cancelling a movement or a receipt (the entry stays visible). */
export function CancelEntryDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm }: CancelEntryDialogProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = reason.trim()
    if (!trimmed) {
      setError("Indiquez la raison de l'annulation")
      return
    }
    setError(undefined)
    setPending(true)
    try {
      await onConfirm(trimmed)
      setReason('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form id="cancel-form" onSubmit={handleSubmit} noValidate>
          <FormField label="Raison" htmlFor="cancel-reason" error={error}>
            <Textarea
              id="cancel-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex. saisi deux fois"
              autoFocus
              {...errorProps('cancel-reason', error)}
            />
          </FormField>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Retour
          </Button>
          <Button type="submit" form="cancel-form" variant="destructive" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
