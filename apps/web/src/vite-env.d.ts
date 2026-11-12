/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API address without a trailing slash, e.g. http://127.0.0.1:3001 */
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
