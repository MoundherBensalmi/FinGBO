import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import ReactDOM from 'react-dom/client'
import { queryClient } from './lib/trpc'
import { getRouter } from './router'

// Follow the system light/dark setting (shadcn's dark styles use the .dark class).
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
const applyTheme = () => document.documentElement.classList.toggle('dark', darkQuery.matches)
applyTheme()
darkQuery.addEventListener('change', applyTheme)

const router = getRouter()

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}
