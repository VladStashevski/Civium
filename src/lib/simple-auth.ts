const AUTH_KEY = 'civium-authenticated'

export const AUTH_EMAIL = 'admin@civium.local'
export const AUTH_PASSWORD = 'Civium2026!'

export function isSignedIn() {
  return localStorage.getItem(AUTH_KEY) === 'true'
}

export function signIn() {
  localStorage.setItem(AUTH_KEY, 'true')
}

export function signOut() {
  localStorage.removeItem(AUTH_KEY)
  window.location.reload()
}
