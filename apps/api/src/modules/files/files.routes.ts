import { TRPCError } from '@trpc/server'
import { getHTTPStatusCodeFromError } from '@trpc/server/http'
import { type Context, Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { db } from '../../db'
import { getClientInfo } from '../../lib/client-info'
import { getObject } from '../../lib/storage'
import { authenticate } from '../auth/auth.service'
import { type FileKind, isValidFileLink } from './file-links'
import { FILE_KINDS, MAX_FILES_PER_UPLOAD, MAX_FILE_BYTES, attachFiles, findFile } from './files.service'

/**
 * Plain HTTP routes for files (tRPC only carries JSON). :kind is "movement" or "receipt".
 *   POST /files/:kind/:parentId          multipart "files" -> attach (admins, Bearer token)
 *   GET  /files/:kind/:fileId?exp&sig    -> the file itself (signed link from the API)
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

const parseKind = (value: string | undefined): FileKind | null =>
  (FILE_KINDS as readonly string[]).includes(value ?? '') ? (value as FileKind) : null

filesRoutes.post(
  '/:kind/:parentId',
  bodyLimit({
    maxSize: MAX_FILES_PER_UPLOAD * MAX_FILE_BYTES + 1024 * 1024,
    onError: (c) => c.json({ error: 'Envoi trop volumineux' }, 413),
  }),
  async (c) => {
    try {
      const kind = parseKind(c.req.param('kind'))
      if (!kind) return c.json({ error: 'Not found' }, 404)

      const auth = await authenticate(db, c.req.header('authorization'), getClientInfo(c))
      if (!auth) return c.json({ error: 'Veuillez vous connecter' }, 401)
      if (auth.user.role !== 'admin') return c.json({ error: 'Réservé aux administrateurs' }, 403)

      const parentId = parseId(c.req.param('parentId'))
      if (!parentId) return c.json({ error: 'Entrée invalide' }, 400)

      const body = await c.req.parseBody({ all: true })
      const field = body['files']
      const files = (Array.isArray(field) ? field : [field]).filter((f): f is File => f instanceof File)

      const saved = await attachFiles(db, auth.user, kind, parentId, files)
      return c.json({ files: saved }, 201)
    } catch (err) {
      return errorResponse(c, err)
    }
  },
)

filesRoutes.get('/:kind/:fileId', async (c) => {
  try {
    const kind = parseKind(c.req.param('kind'))
    const fileId = parseId(c.req.param('fileId'))
    if (!kind || !fileId || !isValidFileLink(kind, fileId, c.req.query('exp'), c.req.query('sig'))) {
      return c.json({ error: 'Lien expiré ou invalide' }, 403)
    }

    const file = await findFile(db, kind, fileId)
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
