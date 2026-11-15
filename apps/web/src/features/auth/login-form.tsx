import { loginInputSchema } from '@fingbo/shared/auth'
import { useMutation } from '@tanstack/react-query'
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { z } from 'zod'
import { FormField, errorProps } from '@/components/form-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { setToken } from '@/lib/auth-token'
import { errorMessage, serverFieldErrors } from '@/lib/errors'
import { queryClient, trpc } from '@/lib/trpc'
import { getDeviceHints } from './device-hints'

type FieldErrors = { username?: string | undefined; password?: string | undefined }

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const login = useMutation(
    trpc.auth.login.mutationOptions({
      onSuccess: ({ token, user }) => {
        setToken(token)
        queryClient.setQueryData(trpc.auth.me.queryKey(), user)
        onSuccess()
      },
      onError: (error) => {
        const fields = serverFieldErrors(error)
        setFieldErrors({ username: fields.username?.[0], password: fields.password?.[0] })
      },
    }),
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (login.isPending) return

    const parsed = loginInputSchema.safeParse({ username, password })
    if (!parsed.success) {
      const fields = z.flattenError(parsed.error).fieldErrors
      setFieldErrors({ username: fields.username?.[0], password: fields.password?.[0] })
      return
    }

    setFieldErrors({})
    login.mutate({ ...parsed.data, device: await getDeviceHints() })
  }

  // Field problems are shown under the fields; anything else (wrong password,
  // too many attempts, server unreachable) in the box above the button.
  const formError =
    login.isError && !fieldErrors.username && !fieldErrors.password ? errorMessage(login.error) : null

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <FormField label="Nom d'utilisateur" htmlFor="username" error={fieldErrors.username}>
        <Input
          id="username"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          disabled={login.isPending}
          className="h-10"
          {...errorProps('username', fieldErrors.username)}
        />
      </FormField>

      <FormField label="Mot de passe" htmlFor="password" error={fieldErrors.password}>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={login.isPending}
            className="h-10 pr-10"
            {...errorProps('password', fieldErrors.password)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowPassword((v) => !v)}
            className="text-muted-foreground absolute top-1 right-1"
            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            aria-pressed={showPassword}
            aria-controls="password"
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </Button>
        </div>
      </FormField>

      {formError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" size="lg" disabled={login.isPending} className="mt-1 w-full">
        {login.isPending && <Loader2 className="animate-spin" />}
        {login.isPending ? 'Connexion…' : 'Se connecter'}
      </Button>
    </form>
  )
}
