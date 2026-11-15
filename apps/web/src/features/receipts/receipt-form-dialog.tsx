import { parseDA } from '@fingbo/shared/money'
import { receiptInputSchema } from '@fingbo/shared/receipts'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Ban, Loader2 } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { CancelEntryDialog } from '@/components/cancel-entry-dialog'
import { DatePicker } from '@/components/date-picker'
import { EntityCombobox } from '@/components/entity-combobox'
import { FormField, errorProps } from '@/components/form-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AttachmentsEditor } from '@/features/files/attachments-editor'
import { useQuickCreate } from '@/features/movements/use-quick-create'
import { formatDateTime, formatDayShort } from '@/lib/dates'
import { errorMessage, serverFieldErrors } from '@/lib/errors'
import { uploadFiles } from '@/lib/files'
import { invalidateLedger } from '@/lib/invalidate'
import { amountToInput, formatAmount } from '@/lib/money'
import { trpc } from '@/lib/trpc'
import type { ReceiptEntry } from './types'

export type ReceiptDialogState =
  | { mode: 'create'; date: string; personId?: number; categoryId?: number | null }
  | { mode: 'edit'; entry: ReceiptEntry }

type Errors = Partial<Record<'date' | 'amount' | 'personId' | 'categoryId' | 'note' | 'form', string>>

export function ReceiptFormDialog({ state, onClose }: { state: ReceiptDialogState | null; onClose: () => void }) {
  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        {state && (
          <ReceiptForm
            key={state.mode === 'edit' ? `edit-${state.entry.id}` : `new-${state.date}-${state.personId ?? ''}`}
            state={state}
            onDone={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ReceiptForm({ state, onDone }: { state: ReceiptDialogState; onDone: () => void }) {
  const editing = state.mode === 'edit' ? state.entry : null
  const preset = state.mode === 'create' ? state : null

  const [date, setDate] = useState(editing?.date ?? preset?.date ?? '')
  const [amountText, setAmountText] = useState(editing ? amountToInput(editing.amount) : '')
  const [personId, setPersonId] = useState<number | null>(editing?.personId ?? preset?.personId ?? null)
  const [categoryId, setCategoryId] = useState<number | null>(editing?.categoryId ?? preset?.categoryId ?? null)
  const [categoryTouched, setCategoryTouched] = useState(editing !== null)
  const [note, setNote] = useState(editing?.note ?? '')
  const [errors, setErrors] = useState<Errors>({})
  const [cancelOpen, setCancelOpen] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)

  const people = useQuery(trpc.people.list.queryOptions())
  const categories = useQuery(trpc.categories.list.queryOptions())
  const { createPerson, createCategory } = useQuickCreate()

  const personItems = useMemo(
    () => (people.data ?? []).map((p) => ({ id: p.id, name: p.name, hint: p.occupation })),
    [people.data],
  )
  const categoryItems = useMemo(
    () =>
      (categories.data ?? [])
        .filter((c) => !c.archivedAt || c.id === editing?.categoryId)
        .map((c) => ({ id: c.id, name: c.name, hint: c.archivedAt ? 'archivée' : null })),
    [categories.data, editing?.categoryId],
  )

  function choosePerson(id: number | null) {
    setPersonId(id)
    if (!categoryTouched && id !== null) {
      const fallback = people.data?.find((p) => p.id === id)?.defaultCategoryId
      const active = categories.data?.some((c) => c.id === fallback && !c.archivedAt)
      if (fallback && active) setCategoryId(fallback)
    }
  }

  const onFailed = (error: unknown) => {
    const fields = serverFieldErrors(error)
    const fieldErrors: Errors = {}
    for (const key of ['date', 'amount', 'personId', 'categoryId', 'note'] as const) {
      if (fields[key]?.[0]) fieldErrors[key] = fields[key][0]
    }
    setErrors(Object.keys(fieldErrors).length ? fieldErrors : { form: errorMessage(error) })
  }

  const create = useMutation(trpc.receipts.create.mutationOptions({ onError: onFailed }))
  const update = useMutation(trpc.receipts.update.mutationOptions({ onError: onFailed }))
  const cancel = useMutation(trpc.receipts.cancel.mutationOptions())
  const saving = create.isPending || update.isPending || uploading

  async function onSaved(receiptId: number, savedDate: string) {
    let filesFailed: string | null = null
    if (pendingFiles.length > 0) {
      setUploading(true)
      try {
        await uploadFiles('receipt', receiptId, pendingFiles)
      } catch (err) {
        filesFailed = err instanceof Error ? err.message : "L'envoi des fichiers a échoué"
      } finally {
        setUploading(false)
      }
    }
    void invalidateLedger()
    const originalDate = editing?.date ?? preset?.date
    toast.success(
      editing ? 'Reçu modifié' : 'Reçu enregistré',
      savedDate !== originalDate ? { description: `Daté du ${formatDayShort(savedDate)}` } : undefined,
    )
    if (filesFailed) {
      toast.error('Les pièces jointes n’ont pas été envoyées', {
        description: `${filesFailed}. Ouvrez le reçu pour réessayer.`,
        duration: 10_000,
      })
    }
    onDone()
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    const amount = amountText.trim() === '' ? null : parseDA(amountText)
    const amountError =
      amountText.trim() === '' ? 'Le montant est obligatoire' : amount === null ? 'Montant invalide (ex. 1 250,50)' : undefined

    const parsed = receiptInputSchema.safeParse({
      date,
      personId,
      amount: amount ?? -1,
      categoryId,
      note: note.trim() || null,
    })
    if (amountError || !parsed.success) {
      const fields = parsed.success ? {} : z.flattenError(parsed.error).fieldErrors
      setErrors({
        date: fields.date?.[0],
        amount: amountError ?? fields.amount?.[0],
        personId: fields.personId?.[0],
        categoryId: fields.categoryId?.[0],
        note: fields.note?.[0],
      })
      return
    }

    setErrors({})
    const done = (res: { id: number }) => void onSaved(res.id, parsed.data.date)
    if (editing) update.mutate({ ...parsed.data, id: editing.id }, { onSuccess: done })
    else create.mutate(parsed.data, { onSuccess: done })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? 'Modifier le reçu' : 'Nouveau reçu'}</DialogTitle>
        <DialogDescription>
          {editing
            ? `Saisi par ${editing.createdBy.fullName ?? editing.createdBy.username} le ${formatDateTime(editing.createdAt)}`
            : 'Un achat chez une personne : il s’ajoute à ce que vous lui devez.'}
        </DialogDescription>
      </DialogHeader>

      <form id="receipt-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <FormField label="Acheté chez" htmlFor="receipt-person" error={errors.personId}>
          <EntityCombobox
            id="receipt-person"
            items={personItems}
            value={personId}
            onChange={choosePerson}
            placeholder="Choisir la personne…"
            onCreate={createPerson}
            invalid={Boolean(errors.personId)}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Montant" htmlFor="receipt-amount" error={errors.amount}>
            <div className="relative">
              <Input
                id="receipt-amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                className="h-10 pr-10 text-right text-base font-semibold tabular-nums"
                {...errorProps('receipt-amount', errors.amount)}
              />
              <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
                DA
              </span>
            </div>
          </FormField>
          <FormField label="Date" htmlFor="receipt-date" error={errors.date}>
            <DatePicker id="receipt-date" value={date} onChange={setDate} className="h-10 w-full" />
          </FormField>
        </div>

        <FormField label="Catégorie" htmlFor="receipt-category" error={errors.categoryId}>
          <EntityCombobox
            id="receipt-category"
            items={categoryItems}
            value={categoryId}
            onChange={(id) => {
              setCategoryId(id)
              setCategoryTouched(true)
            }}
            placeholder="Choisir…"
            onCreate={createCategory}
            createLabel={(name) => `Créer la catégorie « ${name} »`}
            invalid={Boolean(errors.categoryId)}
          />
        </FormField>

        <FormField label="Observation" htmlFor="receipt-note" error={errors.note}>
          <Textarea
            id="receipt-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex. bon n° 4521, 20 sacs"
            {...errorProps('receipt-note', errors.note)}
          />
        </FormField>

        <AttachmentsEditor
          kind="receipt"
          saved={editing?.files ?? []}
          pending={pendingFiles}
          onPendingChange={setPendingFiles}
          disabled={saving}
        />

        {errors.form && (
          <Alert variant="destructive">
            <AlertDescription>{errors.form}</AlertDescription>
          </Alert>
        )}
      </form>

      <DialogFooter className="gap-2 sm:justify-between">
        {editing ? (
          <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setCancelOpen(true)}>
            <Ban />
            Annuler ce reçu
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onDone}>
            Fermer
          </Button>
          <Button type="submit" form="receipt-form" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {uploading ? 'Envoi des fichiers…' : 'Enregistrer'}
          </Button>
        </div>
      </DialogFooter>

      {editing && (
        <CancelEntryDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          title="Annuler ce reçu ?"
          description={`Reçu de ${formatAmount(editing.amount)} — ${editing.person.name}. Il restera visible, barré, mais ne comptera plus dans ce que vous devez. Cette action est définitive.`}
          confirmLabel="Annuler le reçu"
          onConfirm={async (reason) => {
            await cancel.mutateAsync({ id: editing.id, reason })
            void invalidateLedger()
            toast.success('Reçu annulé')
            setCancelOpen(false)
            onDone()
          }}
        />
      )}
    </>
  )
}
