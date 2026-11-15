import { randomUUID } from 'node:crypto'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import type { DbOrTx } from '../../db'
import { movementFiles, movements } from '../../db/schema'
import { detectFileType } from '../../lib/file-type'
import { deleteObject, putObject } from '../../lib/storage'
import type { AuthUser } from '../auth/auth.service'
import { signedFilePath } from './file-links'

export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const MAX_FILES_PER_UPLOAD = 10

type FileRow = { id: number; originalName: string; mimeType: string | null }

/** What the web app receives for each attachment. */
export const toMovementFileView = (f: FileRow) => ({
  id: f.id,
  originalName: f.originalName,
  mimeType: f.mimeType,
  url: signedFilePath('movement', f.id),
})

const cleanName = (name: string, ext: string) => {
  const trimmed = name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 200)
  return trimmed || `fichier.${ext}`
}

const objectKey = (folder: string, ext: string) => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${folder}/${now.getFullYear()}/${month}/${randomUUID()}.${ext}`
}

/** Checks every file first, then stores them; nothing is saved if one file is refused. */
async function readAndCheck(files: File[]) {
  if (files.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Aucun fichier reçu' })
  if (files.length > MAX_FILES_PER_UPLOAD) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: `${MAX_FILES_PER_UPLOAD} fichiers maximum à la fois` })
  }
  return Promise.all(
    files.map(async (file) => {
      if (file.size === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: `« ${file.name} » est vide` })
      if (file.size > MAX_FILE_BYTES) {
        throw new TRPCError({ code: 'PAYLOAD_TOO_LARGE', message: `« ${file.name} » dépasse 10 Mo` })
      }
      const bytes = new Uint8Array(await file.arrayBuffer())
      const type = detectFileType(bytes)
      if (!type) {
        throw new TRPCError({
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: `« ${file.name} » : type non accepté (photos JPEG, PNG, WebP, HEIC ou PDF)`,
        })
      }
      return { bytes, type, name: cleanName(file.name, type.ext) }
    }),
  )
}

export async function attachMovementFiles(db: DbOrTx, actor: AuthUser, movementId: number, files: File[]) {
  const [movement] = await db
    .select({ id: movements.id, cancelledAt: movements.cancelledAt })
    .from(movements)
    .where(eq(movements.id, movementId))
    .limit(1)
  if (!movement) throw new TRPCError({ code: 'NOT_FOUND', message: 'Mouvement introuvable' })
  if (movement.cancelledAt) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ce mouvement est annulé' })
  }

  const checked = await readAndCheck(files)
  const saved: FileRow[] = []
  for (const file of checked) {
    const storageKey = objectKey('movements', file.type.ext)
    await putObject(storageKey, file.bytes, file.type.mime)
    try {
      const [row] = await db
        .insert(movementFiles)
        .values({ movementId, storageKey, originalName: file.name, mimeType: file.type.mime, createdById: actor.id })
        .returning({ id: movementFiles.id, originalName: movementFiles.originalName, mimeType: movementFiles.mimeType })
      saved.push(row!)
    } catch (err) {
      await deleteObject(storageKey).catch(() => undefined)
      throw err
    }
  }
  return saved.map(toMovementFileView)
}

export async function findMovementFile(db: DbOrTx, id: number) {
  const [row] = await db
    .select({ storageKey: movementFiles.storageKey, originalName: movementFiles.originalName, mimeType: movementFiles.mimeType })
    .from(movementFiles)
    .where(eq(movementFiles.id, id))
    .limit(1)
  return row ?? null
}

/** Removes a wrongly attached file from the movement and from storage. */
export async function deleteMovementFile(db: DbOrTx, id: number) {
  const [row] = await db
    .delete(movementFiles)
    .where(eq(movementFiles.id, id))
    .returning({ storageKey: movementFiles.storageKey })
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Fichier introuvable' })
  // If storage fails the row is already gone; the orphan object is harmless and logged.
  await deleteObject(row.storageKey).catch((err) => console.error('Could not delete object', row.storageKey, err))
  return { id }
}
