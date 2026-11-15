import type { UserRole } from '@fingbo/shared/auth'
import { MIN_PASSWORD_LENGTH, userCreateSchema, userUpdateSchema } from '@fingbo/shared/users'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
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
import { Label } from '@/components/ui/label'
import { errorMessage, isTRPCError, serverFieldErrors } from '@/lib/errors'
import { trpc } from '@/lib/trpc'
import { cn } from '@/lib/utils'
import { type UserRow, invalidateUsers, roleLabel } from './types'

export type UserDialogState = { mode: 'create' } | { mode: 'edit'; user: UserRow }

type Field = 'username' | 'fullName' | 'role' | 'password' | 'passwordConfirm'
type Errors = Partial<Record<Field | 'form', string>>
const FIELDS: Field[] = ['username', 'fullName', 'role', 'password', 'passwordConfirm']

/** Viewer first: it is the default and the safer choice. */
const ROLE_CHOICES: UserRole[] = ['viewer', 'admin']

const roleHints: Record<UserRole, string> = {
  viewer: 'Consulte la caisse, les reçus et les personnes, sans rien modifier.',
  admin: 'Fait tout, y compris gérer les utilisateurs et les sessions.',
}

type UserFormDialogProps = {
  state: UserDialogState | null
  onClose: () => void
  /** The logged-in admin: they can't change their own role. */
  currentUserId: number
}

export function UserFormDialog({ state, onClose, currentUserId }: UserFormDialogProps) {
  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        {state && (
          <UserForm
            key={state.mode === 'edit' ? `edit-${state.user.id}` : 'new'}
            state={state}
            onDone={onClose}
            currentUserId={currentUserId}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function UserForm({ state, onDone, currentUserId }: { state: UserDialogState; onDone: () => void; currentUserId: number }) {
  const editing = state.mode === 'edit' ? state.user : null
  const isSelf = editing?.id === currentUserId
  const [values, setValues] = useState({
    username: editing?.username ?? '',
    fullName: editing?.fullName ?? '',
    password: '',
    passwordConfirm: '',
  })
  const [role, setRole] = useState<UserRole>(editing?.role ?? 'viewer')
  const [errors, setErrors] = useState<Errors>({})

  const onFailed = (error: unknown) => {
    const fields = serverFieldErrors(error)
    const fieldErrors: Errors = {}
    for (const key of FIELDS) if (fields[key]?.[0]) fieldErrors[key] = fields[key][0]
    if (!Object.keys(fieldErrors).length) {
      // A taken username is a CONFLICT, shown under the field.
      if (isTRPCError(error) && error.data?.code === 'CONFLICT') fieldErrors.username = errorMessage(error)
      else fieldErrors.form = errorMessage(error)
    }
    setErrors(fieldErrors)
  }
  const create = useMutation(trpc.users.create.mutationOptions({ onError: onFailed }))
  const update = useMutation(trpc.users.update.mutationOptions({ onError: onFailed }))
  const saving = create.isPending || update.isPending

  const showErrors = (error: z.ZodError) => {
    const f = z.flattenError(error).fieldErrors as Partial<Record<Field, string[]>>
    const next: Errors = {}
    for (const key of FIELDS) if (f[key]?.[0]) next[key] = f[key][0]
    setErrors(next)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const saved = (name: string) => {
      void invalidateUsers()
      toast.success(editing ? 'Modifications enregistrées' : `Utilisateur « ${name} » créé`)
      onDone()
    }
    if (editing) {
      const parsed = userUpdateSchema.safeParse({ id: editing.id, fullName: values.fullName, role })
      if (!parsed.success) return showErrors(parsed.error)
      setErrors({})
      update.mutate(parsed.data, { onSuccess: (u) => saved(u.username) })
    } else {
      const parsed = userCreateSchema.safeParse({ ...values, role })
      if (!parsed.success) return showErrors(parsed.error)
      setErrors({})
      create.mutate(parsed.data, { onSuccess: (u) => saved(u.username) })
    }
  }

  const text = (field: keyof typeof values) => ({
    id: `user-${field}`,
    value: values[field],
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [field]: e.target.value })),
    ...errorProps(`user-${field}`, errors[field]),
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? `Modifier « ${editing.username} »` : 'Nouvel utilisateur'}</DialogTitle>
        <DialogDescription>
          {editing
            ? "Le nom d'utilisateur ne change pas. Pour le mot de passe, utilisez « Mot de passe »."
            : 'Il pourra se connecter tout de suite avec ce nom et ce mot de passe.'}
        </DialogDescription>
      </DialogHeader>

      <form id="user-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {!editing && (
          <FormField label="Nom d'utilisateur" htmlFor="user-username" error={errors.username} hint="Sert à se connecter. Sans espace.">
            <Input {...text('username')} autoFocus autoComplete="off" autoCapitalize="none" spellCheck={false} />
          </FormField>
        )}
        <FormField label="Nom complet" htmlFor="user-fullName" error={errors.fullName} hint="Facultatif. Affiché à la place du nom d'utilisateur.">
          <Input {...text('fullName')} autoFocus={!!editing} autoComplete="off" />
        </FormField>

        <fieldset className="flex flex-col gap-2" disabled={isSelf}>
          <legend className="mb-1.5 text-sm leading-none font-medium">Rôle</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ROLE_CHOICES.map((r) => (
              <Label
                key={r}
                className={cn(
                  'has-checked:border-primary has-checked:bg-muted flex cursor-pointer items-start gap-2 rounded-md border p-3 font-normal',
                  isSelf && 'cursor-not-allowed opacity-60',
                )}
              >
                <input
                  type="radio"
                  name="user-role"
                  value={r}
                  checked={role === r}
                  onChange={() => setRole(r)}
                  className="mt-0.5 size-4"
                />
                <span className="flex flex-col gap-1">
                  <span className="font-medium">{roleLabel(r)}</span>
                  <span className="text-muted-foreground text-xs">{roleHints[r]}</span>
                </span>
              </Label>
            ))}
          </div>
          {isSelf && <p className="text-muted-foreground text-xs">Vous ne pouvez pas changer votre propre rôle.</p>}
          {errors.role && <p className="text-destructive text-sm">{errors.role}</p>}
        </fieldset>

        {!editing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Mot de passe" htmlFor="user-password" error={errors.password} hint={`Au moins ${MIN_PASSWORD_LENGTH} caractères.`}>
              <Input {...text('password')} type="password" autoComplete="new-password" />
            </FormField>
            <FormField label="Confirmer le mot de passe" htmlFor="user-passwordConfirm" error={errors.passwordConfirm}>
              <Input {...text('passwordConfirm')} type="password" autoComplete="new-password" />
            </FormField>
          </div>
        )}

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
        <Button type="submit" form="user-form" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          {editing ? 'Enregistrer' : 'Créer'}
        </Button>
      </DialogFooter>
    </>
  )
}
