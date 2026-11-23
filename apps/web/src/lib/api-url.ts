/**
 * API address without a trailing slash. The same build is opened from two addresses:
 * a *.local one on the office network, which uses VITE_API_URL_LOCAL, and the public one,
 * which uses VITE_API_URL. Without VITE_API_URL_LOCAL both use VITE_API_URL.
 */
const isLocalHost = window.location.hostname.endsWith('.local')

export const API_URL =
  (isLocalHost && import.meta.env.VITE_API_URL_LOCAL) || import.meta.env.VITE_API_URL
