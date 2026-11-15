import { TRPCError } from '@trpc/server'
import { getHTTPStatusCodeFromError } from '@trpc/server/http'
import { type Context, Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { db } from '../../db'
import { getClientInfo } from '../../lib/client-info'
import { getObject } from '../../lib/storage'
import { authenticate } from '../auth/auth.service'
import { isValidFileLink } from './file-links'
import { MAX_FILES_PER_UPLOAD, MAX_FILE_BYTES, attachMovementFiles, findMovementFile } from './files.service'

/**
 * Plain HTTP routes for files (tRPC only carries JSON):
 *   POST /files/movement/:movementId   multipart "files" -> attach (admins, Bearer token)
 *   GET  /files/movement/:fileId?exp&sig -> the file itself (signed link from the API)
 */
export const filesRoutes = new Hono()

function errorResponse(c: Context, err: unknown) {
  if (err instanceof TRPCError) {
    return c.json({ error: err.message }, getHTTPStatusCodeFromError(err) as ContentfulStatusCode)
  }
  console.error('File route error:', err)
  return c.json({ error: 'Erreur interne du serveur' }, 500)
}

const parseId = (value: string | undefined) => {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

filesRoutes.post(
  '/movement/:movementId',
  bodyLimit({
    maxSize: MAX_FILES_PER_UPLOAD * MAX_FILE_BYTES + 1024 * 1024,
    onError: (c) => c.json({ error: 'Envoi trop volumineux' }, 413),
  }),
  async (c) => {
    try {
      const auth = await authenticate(db, c.req.header('authorization'), getClientInfo(c))
      if (!auth) return c.json({ error: 'Veuillez vous connecter' }, 401)
      if (auth.user.role !== 'admin') return c.json({ error: 'Réservé aux administrateurs' }, 403)

      const movementId = parseId(c.req.param('movementId'))
      if (!movementId) return c.json({ error: 'Mouvement invalide' }, 400)

      const body = await c.req.parseBody({ all: true })
      const field = body['files']
      const files = (Array.isArray(field) ? field : [field]).filter((f): f is File => f instanceof File)

      const saved = await attachMovementFiles(db, auth.user, movementId, files)
      return c.json({ files: saved }, 201)
    } catch (err) {
      return errorResponse(c, err)
    }
  },
)

filesRoutes.get('/movement/:fileId', async (c) => {
  try {
    const fileId = parseId(c.req.param('fileId'))
    if (!fileId || !isValidFileLink('movement', fileId, c.req.query('exp'), c.req.query('sig'))) {
      return c.json({ error: 'Lien expiré ou invalide' }, 403)
    }

    const file = await findMovementFile(db, fileId)
    const object = file && (await getObject(file.storageKey))
    if (!file || !object) return c.json({ error: 'Fichier introuvable' }, 404)

    const headers = new Headers({
      'Content-Type': file.mimeType ?? 'application/octet-stream',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      'Cache-Control': 'private, max-age=3600',
    })
    if (object.size !== undefined) headers.set('Content-Length', String(object.size))
    return new Response(object.body, { status: 200, headers })
  } catch (err) {
    return errorResponse(c, err)
  }
})
