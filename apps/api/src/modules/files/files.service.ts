import { randomUUID } from 'node:crypto'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import type { DbOrTx } from '../../db'
import { movementFiles, movements, receiptFiles, receipts } from '../../db/schema'
import { type DetectedType, detectFileType } from '../../lib/file-type'
import { deleteObject, putObject } from '../../lib/storage'
import type { AuthUser } from '../auth/auth.service'
import { type FileKind, signedFilePath } from './file-links'

export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const MAX_FILES_PER_UPLOAD = 10
export const FILE_KINDS = ['movement', 'receipt'] as const satisfies readonly FileKind[]

type FileRow = { id: number; originalName: string; mimeType: string | null }
type StoredFile = { storageKey: string; originalName: string; mimeType: string | null }

/** What the web app receives for each attachment. */
export const toFileView = (kind: FileKind) => (f: FileRow) => ({
  id: f.id,
  originalName: f.originalName,
  mimeType: f.mimeType,
  url: signedFilePath(kind, f.id),
})

const cleanName = (name: string, ext: string) => {
  const trimmed = name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 200)
  return trimmed || `fichier.${ext}`
}

const objectKey = (kind: FileKind, ext: string) => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${kind}s/${now.getFullYear()}/${month}/${randomUUID()}.${ext}`
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

// --- per kind: the parent entry and its files table --------------------------

async function assertParentOpen(db: DbOrTx, kind: FileKind, parentId: number) {
  const table = kind === 'movement' ? movements : receipts
  const [parent] = await db
    .select({ cancelledAt: table.cancelledAt })
    .from(table)
    .where(eq(table.id, parentId))
    .limit(1)
  const label = kind === 'movement' ? 'Mouvement' : 'Reçu'
  if (!parent) throw new TRPCError({ code: 'NOT_FOUND', message: `${label} introuvable` })
  if (parent.cancelledAt) throw new TRPCError({ code: 'BAD_REQUEST', message: `Ce ${label.toLowerCase()} est annulé` })
}

async function insertFileRow(
  db: DbOrTx,
  kind: FileKind,
  parentId: number,
  file: { storageKey: string; originalName: string; mimeType: string; createdById: number },
): Promise<FileRow> {
  if (kind === 'movement') {
    const [row] = await db
      .insert(movementFiles)
      .values({ movementId: parentId, ...file })
      .returning({ id: movementFiles.id, originalName: movementFiles.originalName, mimeType: movementFiles.mimeType })
    return row!
  }
  const [row] = await db
    .insert(receiptFiles)
    .values({ receiptId: parentId, ...file })
    .returning({ id: receiptFiles.id, originalName: receiptFiles.originalName, mimeType: receiptFiles.mimeType })
  return row!
}

export async function findFile(db: DbOrTx, kind: FileKind, id: number): Promise<StoredFile | null> {
  const table = kind === 'movement' ? movementFiles : receiptFiles
  const [row] = await db
    .select({ storageKey: table.storageKey, originalName: table.originalName, mimeType: table.mimeType })
    .from(table)
    .where(eq(table.id, id))
    .limit(1)
  return row ?? null
}

// --- public operations -------------------------------------------------------

export async function attachFiles(db: DbOrTx, actor: AuthUser, kind: FileKind, parentId: number, files: File[]) {
  await assertParentOpen(db, kind, parentId)
  const checked = await readAndCheck(files)

  const saved: FileRow[] = []
  for (const file of checked) {
    const storageKey = objectKey(kind, file.type.ext)
    await putObject(storageKey, file.bytes, file.type.mime)
    try {
      saved.push(await insertFileRow(db, kind, parentId, toRowValues(storageKey, file, actor)))
    } catch (err) {
      await deleteObject(storageKey).catch(() => undefined)
      throw err
    }
  }
  return saved.map(toFileView(kind))
}

const toRowValues = (storageKey: string, file: { name: string; type: DetectedType }, actor: AuthUser) => ({
  storageKey,
  originalName: file.name,
  mimeType: file.type.mime,
  createdById: actor.id,
})

/** Removes a wrongly attached file from its entry and from storage. */
export async function deleteFile(db: DbOrTx, kind: FileKind, id: number) {
  const table = kind === 'movement' ? movementFiles : receiptFiles
  const [row] = await db.delete(table).where(eq(table.id, id)).returning({ storageKey: table.storageKey })
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Fichier introuvable' })
  // If storage fails the row is already gone; the orphan object is harmless and logged.
  await deleteObject(row.storageKey).catch((err) => console.error('Could not delete object', row.storageKey, err))
  return { id }
}
