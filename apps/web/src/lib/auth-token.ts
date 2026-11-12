// The login token, kept in localStorage and sent as "Authorization: Bearer <token>".
// localStorage can throw (private mode, blocked storage), so every access is guarded.

const KEY = 'fingbo.token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(KEY, token)
  } catch {
    // storage unavailable: the user stays logged in until the page is reloaded
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nothing to clear
  }
}
