import { useMutation } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { clearToken } from '../../lib/auth-token'
import { queryClient, trpc } from '../../lib/trpc'

/** Revokes the session on the API, then forgets it locally (even if the API call failed). */
export function useLogout() {
  const router = useRouter()

  return useMutation(
    trpc.auth.logout.mutationOptions({
      onSettled: async () => {
        clearToken()
        queryClient.removeQueries()
        await router.navigate({ to: '/login' })
      },
    }),
  )
}
