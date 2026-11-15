import type { MovementDirection } from '@fingbo/shared/movements'
import { movementInputSchema } from '@fingbo/shared/movements'
import { parseDA } from '@fingbo/shared/money'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Ban, Loader2 } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { CancelEntryDialog } from '@/components/cancel-entry-dialog'
import { DatePicker } from '@/components/date-picker'
import { EntityCombobox } from '@/components/entity-combobox'
import { FormField, errorProps } from '@/components/form-field'
import { TimeInput } from '@/components/time-input'
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
import { currentTime, formatClock, formatDateTime, formatDayShort, normalizeTime } from '@/lib/dates'
import { errorMessage, serverFieldErrors } from '@/lib/errors'
import { uploadFiles } from '@/lib/files'
import { invalidateLedger } from '@/lib/invalidate'
import { amountToInput, formatAmount } from '@/lib/money'
import { trpc } from '@/lib/trpc'
import { cn } from '@/lib/utils'
import type { EditableMovement } from './types'
import { useQuickCreate } from './use-quick-create'

export type MovementDialogState =
  | {
      mode: 'create'
      direction: MovementDirection
      date: string
      /** Pre-selected person (e.g. "Payer" from a person's page) and their category. */
      personId?: number
      categoryId?: number | null
    }
  | { mode: 'edit'; entry: EditableMovement }

type Errors = Partial<
  Record<'date' | 'time' | 'amount' | 'personId' | 'byPersonId' | 'categoryId' | 'note' | 'form', string>
>

type MovementFormDialogProps = {
  state: MovementDialogState | null
  onClose: () => void
}

export function MovementFormDialog({ state, onClose }: MovementFormDialogProps) {
  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        {/* Remount the form for each opening so it starts from fresh values. */}
        {state && (
          <MovementForm
            key={state.mode === 'edit' ? `edit-${state.entry.id}` : `new-${state.direction}-${state.date}-${state.personId ?? ''}`}
            state={state}
            onDone={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function MovementForm({ state, onDone }: { state: MovementDialogState; onDone: () => void }) {
  const editing = state.mode === 'edit' ? state.entry : null
  const preset = state.mode === 'create' ? state : null

  const [direction, setDirection] = useState<MovementDirection>(editing?.direction ?? preset?.direction ?? 'out')
  const [date, setDate] = useState(editing?.date ?? preset?.date ?? '')
  /** "HH:MM". A new entry starts at the time it is now. */
  const [time, setTime] = useState(editing ? formatClock(editing.time) : currentTime())
  const [amountText, setAmountText] = useState(editing ? amountToInput(editing.amount) : '')
  const [personId, setPersonId] = useState<number | null>(editing?.personId ?? preset?.personId ?? null)
  const [byPersonId, setByPersonId] = useState<number | null>(editing?.byPersonId ?? null)
  const [categoryId, setCategoryId] = useState<number | null>(editing?.categoryId ?? preset?.categoryId ?? null)
  /** Once the category is chosen by hand, picking a person no longer changes it. */
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
  // Archived categories are hidden, except the one this entry already uses.
  const categoryItems = useMemo(
    () =>
      (categories.data ?? [])
        .filter((c) => !c.archivedAt || c.id === editing?.categoryId)
        .map((c) => ({ id: c.id, name: c.name, hint: c.archivedAt ? 'archivée' : null })),
    [categories.data, editing?.categoryId],
  )

  const amount = amountText.trim() === '' ? null : parseDA(amountText)
  const isZero = amount === 0

  function choosePerson(id: number | null) {
    setPersonId(id)
    if (byPersonId !== null && byPersonId === id) setByPersonId(null)
    if (!categoryTouched && id !== null) {
      const fallback = people.data?.find((p) => p.id === id)?.defaultCategoryId
      const active = categories.data?.some((c) => c.id === fallback && !c.archivedAt)
      if (fallback && active) setCategoryId(fallback)
    }
  }

  const onSaved = async (movementId: number, savedDate: string) => {
    // The movement is saved; now send the chosen files (if any).
    let filesFailed: string | null = null
    if (pendingFiles.length > 0) {
      setUploading(true)
      try {
        await uploadFiles('movement', movementId, pendingFiles)
      } catch (err) {
        filesFailed = err instanceof Error ? err.message : "L'envoi des fichiers a échoué"
      } finally {
        setUploading(false)
      }
    }

    void invalidateLedger()
    const originalDate = editing?.date ?? preset?.date
    toast.success(
      editing ? 'Modification enregistrée' : direction === 'in' ? 'Entrée enregistrée' : 'Sortie enregistrée',
      savedDate !== originalDate ? { description: `Enregistrée le ${formatDayShort(savedDate)}` } : undefined,
    )
    if (filesFailed) {
      toast.error('Les pièces jointes n’ont pas été envoyées', {
        description: `${filesFailed}. Ouvrez le mouvement pour réessayer.`,
        duration: 10_000,
      })
    }
    onDone()
  }
  const onFailed = (error: unknown) => {
    const fields = serverFieldErrors(error)
    const fieldErrors: Errors = {}
    for (const key of ['date', 'time', 'amount', 'personId', 'byPersonId', 'categoryId', 'note'] as const) {
      if (fields[key]?.[0]) fieldErrors[key] = fields[key][0]
    }
    setErrors(Object.keys(fieldErrors).length ? fieldErrors : { form: errorMessage(error) })
  }

  const create = useMutation(trpc.movements.create.mutationOptions({ onError: onFailed }))
  const update = useMutation(trpc.movements.update.mutationOptions({ onError: onFailed }))
  const cancel = useMutation(trpc.movements.cancel.mutationOptions())
  const saving = create.isPending || update.isPending || uploading

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    const amountError =
      amountText.trim() === '' ? 'Le montant est obligatoire' : amount === null ? 'Montant invalide (ex. 1 250,50)' : undefined

    // An untouched time keeps its seconds, so entries typed in the same minute stay in order.
    const typedTime = normalizeTime(time) ?? time
    const savedTime = editing && typedTime === formatClock(editing.time) ? editing.time : typedTime
    const input = {
      date,
      time: savedTime,
      direction,
      amount: amount ?? -1,
      personId,
      byPersonId,
      categoryId,
      note: note.trim() || null,
    }
    const parsed = movementInputSchema.safeParse(input)
    if (amountError || !parsed.success) {
      const fields = parsed.success ? {} : z.flattenError(parsed.error).fieldErrors
      setErrors({
        date: fields.date?.[0],
        time: fields.time?.[0],
        amount: amountError ?? fields.amount?.[0],
        personId: fields.personId?.[0],
        byPersonId: fields.byPersonId?.[0],
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

  const isIn = direction === 'in'
  const noteRequired = isZero || personId === null

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {editing ? 'Modifier le mouvement' : isIn ? "Nouvelle entrée d'argent" : "Nouvelle sortie d'argent"}
        </DialogTitle>
        <DialogDescription>
          {editing
            ? `Saisi par ${editing.createdBy.fullName ?? editing.createdBy.username} le ${formatDateTime(editing.createdAt)}`
            : isIn
              ? "Argent reçu dans la caisse (par ex. du patron)."
              : 'Argent sorti de la caisse.'}
        </DialogDescription>
      </DialogHeader>

      <form id="movement-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {/* In / out */}
        <div role="radiogroup" aria-label="Sens" className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1">
          {(['in', 'out'] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={direction === d}
              onClick={() => setDirection(d)}
              className={cn(
                'flex h-9 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors',
                direction === d ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
                direction === d && (d === 'in' ? 'text-money-in' : 'text-money-out'),
              )}
            >
              {d === 'in' ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
              {d === 'in' ? 'Entrée' : 'Sortie'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-[minmax(0,1fr)_9.5rem_7rem]">
          <FormField label="Montant" htmlFor="amount" error={errors.amount} className="col-span-2 sm:col-span-1">
            <div className="relative">
              <Input
                id="amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                autoFocus={!editing}
                className="h-10 pr-10 text-right text-base font-semibold tabular-nums"
                {...errorProps('amount', errors.amount)}
              />
              <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
                DA
              </span>
            </div>
          </FormField>

          <FormField label="Date" htmlFor="date" error={errors.date}>
            <DatePicker id="date" value={date} onChange={setDate} className="h-10 w-full" />
          </FormField>

          <FormField label="Heure" htmlFor="time" error={errors.time}>
            <TimeInput id="time" value={time} onChange={setTime} className="h-10" {...errorProps('time', errors.time)} />
          </FormField>
        </div>

        {isZero && (
          <Alert className="border-warning bg-warning-bg text-foreground">
            <AlertTriangle className="text-warning" />
            <AlertDescription className="text-foreground">
              Montant à 0 : ce mouvement ne change pas la caisse, il garde seulement une trace. La note est obligatoire.
            </AlertDescription>
          </Alert>
        )}

        <FormField label={isIn ? 'Reçu de' : 'Payé à'} htmlFor="person" error={errors.personId}>
          <EntityCombobox
            id="person"
            items={personItems}
            value={personId}
            onChange={choosePerson}
            placeholder={isIn ? 'Choisir la personne…' : 'Choisir ou laisser vide…'}
            noneLabel={isIn ? 'Aucune personne' : 'Aucune (dépense ponctuelle)'}
            onCreate={createPerson}
            invalid={Boolean(errors.personId)}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Par (optionnel)" htmlFor="by-person" error={errors.byPersonId} hint="Qui a porté l'argent">
            <EntityCombobox
              id="by-person"
              items={personItems.filter((p) => p.id !== personId)}
              value={byPersonId}
              onChange={setByPersonId}
              placeholder="Personne"
              noneLabel="Personne"
              onCreate={createPerson}
              invalid={Boolean(errors.byPersonId)}
            />
          </FormField>

          <FormField label="Catégorie" htmlFor="category" error={errors.categoryId}>
            <EntityCombobox
              id="category"
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
              describedBy={errors.categoryId ? 'category-error' : undefined}
            />
          </FormField>
        </div>

        <FormField
          label={noteRequired ? 'Observation (obligatoire)' : 'Observation'}
          htmlFor="note"
          error={errors.note}
          hint={personId === null && !isZero && direction === 'out' ? 'Précisez ce qui a été acheté.' : undefined}
        >
          <Textarea
            id="note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isZero ? 'Ex. prêt de 100 000 DA, rendu le…' : 'Détails…'}
            {...errorProps('note', errors.note)}
          />
        </FormField>

        <AttachmentsEditor
          kind="movement"
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
            Annuler ce mouvement
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onDone}>
            Fermer
          </Button>
          <Button type="submit" form="movement-form" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {uploading ? 'Envoi des fichiers…' : 'Enregistrer'}
          </Button>
        </div>
      </DialogFooter>

      {editing && (
        <CancelEntryDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          title="Annuler ce mouvement ?"
          description={`${editing.direction === 'in' ? 'Entrée' : 'Sortie'} de ${formatAmount(editing.amount)}${
            editing.person ? ` — ${editing.person.name}` : ''
          }. Il restera visible, barré, mais ne comptera plus dans la caisse. Cette action est définitive.`}
          confirmLabel="Annuler le mouvement"
          onConfirm={async (reason) => {
            await cancel.mutateAsync({ id: editing.id, reason })
            void invalidateLedger()
            toast.success('Mouvement annulé')
            setCancelOpen(false)
            onDone()
          }}
        />
      )}
    </>
  )
}
