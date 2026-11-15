/** PostgreSQL error code, also when Drizzle wraps the driver error in `cause`. */
export function pgErrorCode(err: unknown): string | undefined {
  for (let e: unknown = err; e && typeof e === 'object'; e = (e as { cause?: unknown }).cause) {
    const code = (e as { code?: unknown }).code
    if (typeof code === 'string') return code
  }
  return undefined
}

export const isUniqueViolation = (err: unknown) => pgErrorCode(err) === '23505'

/** A referenced row (person, category...) does not exist. */
export const isForeignKeyViolation = (err: unknown) => pgErrorCode(err) === '23503'
