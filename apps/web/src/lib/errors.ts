import type { AppRouter } from '@fingbo/api/router'
import { TRPCClientError } from '@trpc/client'

export function isTRPCError(error: unknown): error is TRPCClientError<AppRouter> {
  return error instanceof TRPCClientError
}

/** The API says the token is missing, invalid or revoked. */
export function isUnauthorized(error: unknown): boolean {
  return isTRPCError(error) && error.data?.code === 'UNAUTHORIZED'
}

/** A message that is safe and useful to show to the user. */
export function errorMessage(error: unknown): string {
  if (isTRPCError(error)) {
    // No `data` means the request never got an answer from the API.
    if (!error.data) return 'Serveur injoignable. Vérifiez votre connexion et réessayez.'
    if (error.data.code === 'INTERNAL_SERVER_ERROR') {
      return 'Erreur sur le serveur. Veuillez réessayer.'
    }
    return error.message
  }
  return 'Une erreur est survenue. Veuillez réessayer.'
}

/** Per-field validation messages returned by the API, if any. */
export function serverFieldErrors(error: unknown): Record<string, string[] | undefined> {
  return (isTRPCError(error) && error.data?.zodError?.fieldErrors) || {}
}
