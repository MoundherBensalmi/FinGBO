import { formatDA, parseDA } from '@fingbo/shared/money'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const { trpc } = Route.useRouteContext()
  const health = useQuery(trpc.system.health.queryOptions())
  const sample = parseDA('1 250,50')

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">FinGBO</h1>
      <p className="mt-4 text-lg">
        Caisse, receipts and payments. Sample amount: {sample === null ? '—' : formatDA(sample)}
      </p>
      <p className="mt-2" data-testid="api-status">
        API:{' '}
        {health.isPending
          ? 'checking…'
          : health.isError
            ? `unreachable (${health.error.message})`
            : `connected, server time ${health.data.serverTime.toLocaleString()}`}
      </p>
    </div>
  )
}
