/** File types accepted as attachments, recognised from their first bytes (not the name). */
export type DetectedType = { mime: string; ext: string }

const ascii = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end))

export function detectFileType(bytes: Uint8Array): DetectedType | null {
  if (bytes.length < 12) return null

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' }
  if (bytes[0] === 0x89 && ascii(bytes, 1, 4) === 'PNG') return { mime: 'image/png', ext: 'png' }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' }
  if (ascii(bytes, 0, 5) === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' }

  // HEIC/HEIF (iPhone photos): "ftyp" box with a HEIF brand
  if (ascii(bytes, 4, 8) === 'ftyp') {
    const brand = ascii(bytes, 8, 12)
    if (['heic', 'heix', 'hevc', 'heim', 'heis'].includes(brand)) return { mime: 'image/heic', ext: 'heic' }
    if (['mif1', 'msf1', 'heif'].includes(brand)) return { mime: 'image/heif', ext: 'heif' }
  }
  return null
}
