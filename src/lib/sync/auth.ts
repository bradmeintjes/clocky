// Google sign-in with Google Identity Services (token flow, browser only).
// Scope: drive.appdata (Clocky's hidden folder) plus email for display.

export const CLIENT_ID = '684415690748-5ebni3lctk6clghbunb4cs06m1ml0icm.apps.googleusercontent.com'
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email'
const TOKEN_KEY = 'clocky.token'

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
}

interface TokenClient {
  requestAccessToken(o?: { prompt?: string; login_hint?: string }): void
}

interface Gis {
  accounts: {
    oauth2: {
      initTokenClient(c: {
        client_id: string
        scope: string
        callback: (r: TokenResponse) => void
        error_callback?: (e: { type: string }) => void
      }): TokenClient
      revoke(token: string, done?: () => void): void
    }
  }
}

declare global {
  interface Window {
    google?: Gis
  }
}

let loading: Promise<Gis> | null = null

function loadGis(): Promise<Gis> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google)
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => (window.google ? resolve(window.google) : reject(new Error('Google sign-in failed to load')))
    s.onerror = () => {
      loading = null
      reject(new Error("Couldn't reach Google. Check your connection."))
    }
    document.head.append(s)
  })
  return loading
}

export class SignInCancelled extends Error {}

/** The cached token, if it has more than a minute left. Kept across reloads within its hour. */
export function cachedToken(): string | null {
  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null') as { token: string; exp: number } | null
    return t && t.exp - 60_000 > Date.now() ? t.token : null
  } catch {
    return null
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage blocked */
  }
}

/**
 * Ask Google for an access token. Opens Google's window, so call it from a tap.
 * `hint` skips the account chooser for a known account.
 */
export async function signIn(hint?: string): Promise<string> {
  const gis = await loadGis()
  const r = await new Promise<TokenResponse>((resolve, reject) => {
    const client = gis.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: resolve,
      error_callback: (e) => reject(new SignInCancelled(e.type)),
    })
    client.requestAccessToken(hint ? { prompt: '', login_hint: hint } : { prompt: 'select_account' })
  })
  if (!r.access_token) throw new SignInCancelled(r.error ?? 'no token')
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: r.access_token, exp: Date.now() + (r.expires_in ?? 3600) * 1000 }))
  } catch {
    /* storage blocked: token lives for this call only */
  }
  return r.access_token
}

export async function fetchEmail(token: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Could not read your Google account')
  return ((await res.json()) as { email?: string }).email ?? ''
}

export async function revoke(): Promise<void> {
  const t = cachedToken()
  clearToken()
  if (t && window.google) window.google.accounts.oauth2.revoke(t)
}
