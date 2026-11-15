import type { RouterOutputs } from './trpc'
import { getToken } from './auth-token'

export type AttachmentView = RouterOutputs['movements']['day']['entries'][number]['files'][number]

export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const MAX_FILES_PER_UPLOAD = 10
export const ACCEPTED_FILES = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf'

/** Links from the API are relative ("/files/movement/12?..."). */
export const fileUrl = (path: string) => `${import.meta.env.VITE_API_URL}${path}`

export const isImage = (mime: string | null | undefined) => Boolean(mime?.startsWith('image/'))

/** Browsers can't draw HEIC, so it can't be previewed or shrunk here. */
const canResize = (type: string) => ['image/jpeg', 'image/png', 'image/webp'].includes(type)

const MAX_SIDE = 2000
const RESIZE_ABOVE_BYTES = 1.5 * 1024 * 1024

/**
 * Phone photos are often 4-8 MB; shrink big ones to max 2000 px (JPEG 85 %),
 * which keeps receipts readable at a few hundred KB. Small files are sent as they are.
 */
export async function prepareForUpload(file: File): Promise<File> {
  if (!canResize(file.type) || file.size <= RESIZE_ABOVE_BYTES) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.fillStyle = '#fff' // transparent PNGs become white, not black
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob || blob.size >= file.size) return file
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified })
  } catch {
    return file
  }
}

/** Message to show when a chosen file can't be attached, or null if it's fine. */
export function checkFile(file: File): string | null {
  const accepted = ACCEPTED_FILES.split(',')
  const heicByName = /\.(heic|heif)$/i.test(file.name) // some browsers give HEIC no type
  if (!accepted.includes(file.type) && !heicByName) {
    return `« ${file.name} » : seules les photos et les PDF sont acceptés`
  }
  if (file.size > MAX_FILE_BYTES) return `« ${file.name} » dépasse 10 Mo`
  return null
}

export async function uploadMovementFiles(movementId: number, files: File[]): Promise<void> {
  const form = new FormData()
  for (const file of files) form.append('files', file, file.name)
  const token = getToken()
  let res: Response
  try {
    res = await fetch(fileUrl(`/files/movement/${movementId}`), {
      method: 'POST',
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  } catch {
    throw new Error('Serveur injoignable. Vérifiez votre connexion et réessayez.')
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? "L'envoi des fichiers a échoué")
  }
}
