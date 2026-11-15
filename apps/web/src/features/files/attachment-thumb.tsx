import { FileText, ImageIcon } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

type AttachmentThumbProps = {
  /** Full URL (signed API link or a local blob: URL). */
  src: string | null
  name: string
  mimeType: string | null | undefined
  className?: string
}

/** Small square preview: the picture itself, or an icon for PDFs and HEIC photos. */
export function AttachmentThumb({ src, name, mimeType, className }: AttachmentThumbProps) {
  const [failed, setFailed] = useState(false)
  const previewable = src && !failed && ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType ?? '')

  return (
    <div className={cn('bg-muted flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border', className)}>
      {previewable ? (
        <img src={src} alt={name} loading="lazy" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : mimeType === 'application/pdf' ? (
        <FileText className="text-muted-foreground size-6" aria-hidden />
      ) : (
        <ImageIcon className="text-muted-foreground size-6" aria-hidden />
      )}
    </div>
  )
}
