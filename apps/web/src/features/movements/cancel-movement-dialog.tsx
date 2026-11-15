import { movementCancelSchema } from '@fingbo/shared/movements'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
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
import { formatAmount } from '@/lib/money'
import { queryClient, trpc } from '@/lib/trpc'
import type { DayEntry } from './types'

type CancelMovementDialogProps = {
  entry: DayEntry
  open: boolean
  onOpenChange: (open: boolean) => void
  onCancelled: () => void
}

/** Cancelling keeps the entry visible (struck through) but removes it from the totals. */
export function CancelMovementDialog({ entry, open, onOpenChange, onCancelled }: CancelMovementDialogProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string>()

  const cancel = useMutation(
    trpc.movements.cancel.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.movements.day.pathFilter())
        toast.success('Mouvement annulé')
        onOpenChange(false)
        onCancelled()
      },
      onError: (e) => setError(errorMessage(e)),
    }),
  )

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = movementCancelSchema.safeParse({ id: entry.id, reason })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message)
      return
    }
    setError(undefined)
    cancel.mutate(parsed.data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Annuler ce mouvement ?</DialogTitle>
          <DialogDescription>
            {entry.direction === 'in' ? 'Entrée' : 'Sortie'} de {formatAmount(entry.amount)}
            {entry.person ? ` — ${entry.person.name}` : ''}. Il restera visible, barré, mais ne comptera plus dans la
            caisse. Cette action est définitive.
          </DialogDescription>
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
          <Button type="submit" form="cancel-form" variant="destructive" disabled={cancel.isPending}>
            {cancel.isPending && <Loader2 className="animate-spin" />}
            Annuler le mouvement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
