import { ExternalLink, Paperclip } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { type AttachmentView, fileUrl } from '@/lib/files'
import { AttachmentThumb } from './attachment-thumb'

/** 📎 count in the journal; opens the files (for everyone, viewers included). */
export function AttachmentsBadge({ files }: { files: AttachmentView[] }) {
  if (files.length === 0) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          // Don't open the edit form when clicking the paperclip in a row.
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 rounded px-1 text-xs"
          aria-label={`${files.length} pièce${files.length > 1 ? 's' : ''} jointe${files.length > 1 ? 's' : ''}`}
        >
          <Paperclip className="size-3.5" />
          {files.length}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start" onClick={(e) => e.stopPropagation()}>
        <ul className="flex flex-col gap-1">
          {files.map((file) => (
            <li key={file.id}>
              <a
                href={fileUrl(file.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:bg-muted flex items-center gap-3 rounded-md p-1.5 text-sm"
              >
                <AttachmentThumb src={fileUrl(file.url)} name={file.originalName} mimeType={file.mimeType} className="size-10" />
                <span className="min-w-0 flex-1 truncate">{file.originalName}</span>
                <ExternalLink className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
