import { MIN_PASSWORD_LENGTH, userPasswordResetSchema } from '@fingbo/shared/users'
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
import { errorMessage } from '@/lib/errors'
import { trpc } from '@/lib/trpc'
import { type UserRow, invalidateUsers } from './types'

type PasswordResetDialogProps = {
  user: UserRow | null
  onClose: () => void
  currentUserId: number
}

export function PasswordResetDialog({ user, onClose, currentUserId }: PasswordResetDialogProps) {
  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {user && <PasswordResetForm key={user.id} user={user} isSelf={user.id === currentUserId} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

type Errors = Partial<Record<'password' | 'passwordConfirm' | 'form', string>>

function PasswordResetForm({ user, isSelf, onDone }: { user: UserRow; isSelf: boolean; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const reset = useMutation(trpc.users.resetPassword.mutationOptions({ onError: (e) => setErrors({ form: errorMessage(e) }) }))

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (reset.isPending) return
    const parsed = userPasswordResetSchema.safeParse({ id: user.id, password, passwordConfirm })
    if (!parsed.success) {
      const f = z.flattenError(parsed.error).fieldErrors
      setErrors({ password: f.password?.[0], passwordConfirm: f.passwordConfirm?.[0] })
      return
    }
    setErrors({})
    reset.mutate(parsed.data, {
      onSuccess: ({ revokedSessions }) => {
        void invalidateUsers()
        toast.success(
          revokedSessions
            ? `Mot de passe changé, ${revokedSessions} session${revokedSessions > 1 ? 's' : ''} déconnectée${revokedSessions > 1 ? 's' : ''}`
            : 'Mot de passe changé',
        )
        onDone()
      },
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nouveau mot de passe pour « {user.username} »</DialogTitle>
        <DialogDescription>
          {isSelf
            ? 'Vos autres sessions seront déconnectées ; celle-ci reste ouverte.'
            : 'Toutes ses sessions ouvertes seront déconnectées. Il devra se reconnecter avec ce mot de passe.'}
        </DialogDescription>
      </DialogHeader>
      <form id="password-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <FormField label="Nouveau mot de passe" htmlFor="reset-password" error={errors.password} hint={`Au moins ${MIN_PASSWORD_LENGTH} caractères.`}>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            {...errorProps('reset-password', errors.password)}
          />
        </FormField>
        <FormField label="Confirmer le mot de passe" htmlFor="reset-passwordConfirm" error={errors.passwordConfirm}>
          <Input
            id="reset-passwordConfirm"
            type="password"
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            {...errorProps('reset-passwordConfirm', errors.passwordConfirm)}
          />
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
        <Button type="submit" form="password-form" disabled={reset.isPending}>
          {reset.isPending && <Loader2 className="animate-spin" />}
          Changer le mot de passe
        </Button>
      </DialogFooter>
    </>
  )
}
