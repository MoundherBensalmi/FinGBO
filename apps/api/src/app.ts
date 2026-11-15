import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { env } from './env'
import { filesRoutes } from './modules/files/files.routes'
import { createContext } from './trpc/context'
import { appRouter } from './trpc/router'

export const app = new Hono()

app.use(logger())
// cross-origin: the web app (another address) shows attachment images from /files.
app.use(secureHeaders({ crossOriginResourcePolicy: 'cross-origin' }))

// The web app is served from another address, so only its origin(s) may call the API.
app.use(
  cors({
    origin: env.WEB_ORIGINS,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  }),
)

app.get('/health', (c) => c.json({ ok: true }))

app.route('/files', filesRoutes)

app.all('/trpc/*', (c) =>
  fetchRequestHandler({
    endpoint: '/trpc',
    req: c.req.raw,
    router: appRouter,
    createContext: () => createContext(c),
    onError({ path, error }) {
      if (error.code === 'INTERNAL_SERVER_ERROR') {
        console.error(`tRPC error in ${path ?? 'unknown procedure'}:`, error)
      }
    },
  }),
)

app.notFound((c) => c.json({ error: 'Not found' }, 404))
