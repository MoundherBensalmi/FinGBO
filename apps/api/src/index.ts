import { serve } from '@hono/node-server'
import { app } from './app'
import { client } from './db'
import { env } from './env'

const server = serve({ fetch: app.fetch, hostname: env.HOST, port: env.PORT }, (info) => {
  console.log(`API running on http://${info.address}:${info.port}`)
})

function shutdown() {
  server.close()
  void client.end({ timeout: 5 }).finally(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
