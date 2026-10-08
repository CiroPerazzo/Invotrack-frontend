const API_BASE = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/$/, '')

let syncedToken = null
let pending = null

export async function syncAuthCookie(token) {
  if (!token) {
    syncedToken = null
    await fetch(`${API_BASE}/auth/session`, { method: 'DELETE', credentials: 'include' })
    return
  }
  if (token === syncedToken) return
  if (pending?.token === token) return pending.promise

  const promise = fetch(`${API_BASE}/auth/session`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: token }),
  }).then(async (response) => {
    if (!response.ok) throw new Error('No se pudo establecer la sesión de la API')
    syncedToken = token
  }).finally(() => { pending = null })
  pending = { token, promise }
  return promise
}
