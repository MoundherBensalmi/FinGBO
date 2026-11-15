import { personCreateSchema } from '@fingbo/shared/people'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
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
import { useQuickCreate } from '@/features/movements/use-quick-create'
import { errorMessage, serverFieldErrors } from '@/lib/errors'
import { invalidateLedger } from '@/lib/invalidate'
import { trpc } from '@/lib/trpc'

export type PersonFormValues = {
  id: number
  name: string
  phone: string | null
  address: string | null
  occupation: string | null
  note: string | null
  defaultCategoryId: number | null
}

export type PersonDialogState = { mode: 'create' } | { mode: 'edit'; person: PersonFormValues }

type Field = 'name' | 'phone' | 'address' | 'occupation' | 'note' | 'defaultCategoryId'
type Errors = Partial<Record<Field | 'form', string>>

type PersonFormDialogProps = {
  state: PersonDialogState | null
  onClose: () => void
  /** Called with the new person's id after creation (e.g. to open their page). */
  onCreated?: (id: number) => void
}

export function PersonFormDialog({ state, onClose, onCreated }: PersonFormDialogProps) {
  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        {state && (
          <PersonForm
            key={state.mode === 'edit' ? `edit-${state.person.id}` : 'new'}
            state={state}
            onDone={onClose}
            onCreated={onCreated}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PersonForm({
  state,
  onDone,
  onCreated,
}: {
  state: PersonDialogState
  onDone: () => void
  onCreated?: ((id: number) => void) | undefined
}) {
  const editing = state.mode === 'edit' ? state.person : null
  const [values, setValues] = useState({
    name: editing?.name ?? '',
    phone: editing?.phone ?? '',
    address: editing?.address ?? '',
    occupation: editing?.occupation ?? '',
    note: editing?.note ?? '',
  })
  const [defaultCategoryId, setDefaultCategoryId] = useState<number | null>(editing?.defaultCategoryId ?? null)
  const [errors, setErrors] = useState<Errors>({})

  const categories = useQuery(trpc.categories.list.queryOptions())
  const { createCategory } = useQuickCreate()
  const categoryItems = useMemo(
    () =>
      (categories.data ?? [])
        .filter((c) => !c.archivedAt || c.id === editing?.defaultCategoryId)
        .map((c) => ({ id: c.id, name: c.name })),
    [categories.data, editing?.defaultCategoryId],
  )

  const onFailed = (error: unknown) => {
    const fields = serverFieldErrors(error)
    const fieldErrors: Errors = {}
    for (const key of ['name', 'phone', 'address', 'occupation', 'note', 'defaultCategoryId'] as const) {
      if (fields[key]?.[0]) fieldErrors[key] = fields[key][0]
    }
    setErrors(Object.keys(fieldErrors).length ? fieldErrors : { form: errorMessage(error) })
  }
  const create = useMutation(trpc.people.create.mutationOptions({ onError: onFailed }))
  const update = useMutation(trpc.people.update.mutationOptions({ onError: onFailed }))
  const saving = create.isPending || update.isPending

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const parsed = personCreateSchema.safeParse({ ...values, defaultCategoryId })
    if (!parsed.success) {
      const f = z.flattenError(parsed.error).fieldErrors
      setErrors({
        name: f.name?.[0],
        phone: f.phone?.[0],
        address: f.address?.[0],
        occupation: f.occupation?.[0],
        note: f.note?.[0],
      })
      return
    }
    setErrors({})
    const saved = (p: { id: number; name: string }) => {
      void invalidateLedger()
      toast.success(editing ? 'Modifications enregistrées' : `« ${p.name} » ajouté(e)`)
      onDone()
      if (!editing) onCreated?.(p.id)
    }
    if (editing) update.mutate({ ...parsed.data, id: editing.id }, { onSuccess: saved })
    else create.mutate(parsed.data, { onSuccess: saved })
  }

  const text = (field: keyof typeof values) => ({
    id: `person-${field}`,
    value: values[field],
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [field]: e.target.value })),
    ...errorProps(`person-${field}`, errors[field]),
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? 'Modifier la personne' : 'Nouvelle personne'}</DialogTitle>
        <DialogDescription>Fournisseur, patron, employé… toute personne avec qui l’argent circule.</DialogDescription>
      </DialogHeader>

      <form id="person-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <FormField label="Nom" htmlFor="person-name" error={errors.name}>
          <Input {...text('name')} autoFocus={!editing} autoComplete="off" />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Activité" htmlFor="person-occupation" error={errors.occupation} hint="Ex. sacs plastique, chauffeur">
            <Input {...text('occupation')} autoComplete="off" />
          </FormField>
          <FormField label="Téléphone" htmlFor="person-phone" error={errors.phone}>
            <Input {...text('phone')} type="tel" inputMode="tel" autoComplete="off" />
          </FormField>
        </div>
        <FormField label="Adresse" htmlFor="person-address" error={errors.address}>
          <Input {...text('address')} autoComplete="off" />
        </FormField>
        <FormField
          label="Catégorie par défaut"
          htmlFor="person-category"
          error={errors.defaultCategoryId}
          hint="Pré-remplie dans les reçus et mouvements de cette personne."
        >
          <EntityCombobox
            id="person-category"
            items={categoryItems}
            value={defaultCategoryId}
            onChange={setDefaultCategoryId}
            placeholder="Aucune"
            noneLabel="Aucune"
            onCreate={createCategory}
            createLabel={(name) => `Créer la catégorie « ${name} »`}
          />
        </FormField>
        <FormField label="Note" htmlFor="person-note" error={errors.note}>
          <Textarea {...text('note')} rows={2} />
        </FormField>
        {errors.form && (
          <Alert variant="destructive">
            <AlertDescription>{errors.form}</AlertDescription>
          </Alert>
        )}
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Fermer
        </Button>
        <Button type="submit" form="person-form" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          Enregistrer
        </Button>
      </DialogFooter>
    </>
  )
}
