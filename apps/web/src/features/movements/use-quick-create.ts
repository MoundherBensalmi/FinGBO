import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/errors'
import { queryClient, trpc } from '@/lib/trpc'

/** Create a person or a category straight from a picker, and refresh the lists. */
export function useQuickCreate() {
  const person = useMutation(
    trpc.people.create.mutationOptions({
      onSuccess: (p) => {
        void queryClient.invalidateQueries(trpc.people.pathFilter())
        toast.success(`Personne « ${p.name} » ajoutée`)
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  )
  const category = useMutation(
    trpc.categories.create.mutationOptions({
      onSuccess: (c) => {
        void queryClient.invalidateQueries(trpc.categories.list.queryFilter())
        toast.success(`Catégorie « ${c.name} » ajoutée`)
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  )

  return {
    createPerson: async (name: string) => (await person.mutateAsync({ name })).id,
    createCategory: async (name: string) => (await category.mutateAsync({ name })).id,
  }
}
