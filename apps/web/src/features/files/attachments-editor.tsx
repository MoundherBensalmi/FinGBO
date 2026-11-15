import { useMutation } from '@tanstack/react-query'
import { Camera, ExternalLink, Loader2, Paperclip, Trash2, X } from 'lucide-react'
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/errors'
import {
  ACCEPTED_FILES,
  type AttachmentView,
  type FileKind,
  MAX_FILES_PER_UPLOAD,
  checkFile,
  fileUrl,
  prepareForUpload,
} from '@/lib/files'
import { invalidateLedger } from '@/lib/invalidate'
import { trpc } from '@/lib/trpc'
import { AttachmentThumb } from './attachment-thumb'

type AttachmentsEditorProps = {
  kind: FileKind
  /** Files already saved on the entry (edit mode). */
  saved: AttachmentView[]
  /** Files chosen but not sent yet; they are sent when the entry is saved. */
  pending: File[]
  onPendingChange: (files: File[]) => void
  disabled?: boolean
}

/** Attachments section of the movement and receipt forms. */
export function AttachmentsEditor({ kind, saved: savedProp, pending, onPendingChange, disabled }: AttachmentsEditorProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const [preparing, setPreparing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  // Files removed while the form is open disappear at once.
  const [removed, setRemoved] = useState<number[]>([])
  const saved = savedProp.filter((f) => !removed.includes(f.id))

  // Local previews for files not sent yet, released when they go away.
  const previews = useMemo(() => pending.map((f) => URL.createObjectURL(f)), [pending])
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews])

  const remove = useMutation(
    trpc.files.delete.mutationOptions({
      onSuccess: (_, input) => {
        setRemoved((ids) => [...ids, input.id])
        void invalidateLedger()
        toast.success('Fichier supprimé')
      },
      onError: (e) => toast.error(errorMessage(e)),
      onSettled: () => setConfirmDelete(null),
    }),
  )

  async function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? [])
    event.target.value = '' // choosing the same file again still triggers a change
    if (chosen.length === 0) return

    const room = MAX_FILES_PER_UPLOAD - pending.length
    if (chosen.length > room) toast.error(`${MAX_FILES_PER_UPLOAD} fichiers maximum à la fois`)

    setPreparing(true)
    try {
      const ready: File[] = []
      for (const file of chosen.slice(0, Math.max(room, 0))) {
        const prepared = await prepareForUpload(file)
        const problem = checkFile(prepared)
        if (problem) toast.error(problem)
        else ready.push(prepared)
      }
      if (ready.length) onPendingChange([...pending, ...ready])
    } finally {
      setPreparing(false)
    }
  }

  const count = saved.length + pending.length

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Pièces jointes{count > 0 && ` (${count})`}</span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={disabled || preparing} onClick={() => cameraInput.current?.click()}>
            <Camera />
            <span className="hidden sm:inline">Appareil photo</span>
            <span className="sm:hidden">Photo</span>
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={disabled || preparing} onClick={() => fileInput.current?.click()}>
            {preparing ? <Loader2 className="animate-spin" /> : <Paperclip />}
            Ajouter un fichier
          </Button>
        </div>
        <input ref={fileInput} type="file" accept={ACCEPTED_FILES} multiple hidden onChange={addFiles} />
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={addFiles} />
      </div>

      {count === 0 ? (
        <p className="text-muted-foreground text-xs">Photo du reçu, bon ou facture (images ou PDF, 10 Mo max.).</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {saved.map((file) => (
            <li key={file.id} className="flex items-center gap-3 rounded-md border p-2">
              <AttachmentThumb src={fileUrl(file.url)} name={file.originalName} mimeType={file.mimeType} />
              <a
                href={fileUrl(file.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-sm hover:underline"
              >
                {file.originalName}
                <ExternalLink className="text-muted-foreground ml-1 inline size-3" aria-hidden />
              </a>
              {confirmDelete === file.id ? (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate({ kind, id: file.id })}
                  >
                    {remove.isPending && <Loader2 className="animate-spin" />}
                    Supprimer
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                    Non
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={disabled}
                  aria-label={`Supprimer ${file.originalName}`}
                  onClick={() => setConfirmDelete(file.id)}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
          {pending.map((file, i) => (
            <li key={`${file.name}-${i}`} className="flex items-center gap-3 rounded-md border border-dashed p-2">
              <AttachmentThumb src={previews[i] ?? null} name={file.name} mimeType={file.type} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{file.name}</p>
                <p className="text-muted-foreground text-xs">Envoyé à l'enregistrement · {Math.ceil(file.size / 1024)} Ko</p>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Retirer ${file.name}`}
                onClick={() => onPendingChange(pending.filter((_, j) => j !== i))}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
