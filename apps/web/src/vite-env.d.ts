/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API address without a trailing slash, e.g. http://127.0.0.1:3001 */
  readonly VITE_API_URL: string
  /** API address used when the app is opened from a *.local address (optional) */
  readonly VITE_API_URL_LOCAL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
