// Google sign-in with a full-page OAuth redirect (implicit token flow), browser only.
// A pop-up can't hand the token back from an installed Android app; a redirect can.
// Scope: drive.appdata (Clocky's hidden folder) plus email for display.

export const CLIENT_ID = '684415690748-5ebni3lctk6clghbunb4cs06m1ml0icm.apps.googleusercontent.com'
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email'
const TOKEN_KEY = 'clocky.token'
const PENDING_KEY = 'clocky.signin'

const SILENT_KEY = 'clocky.silent'
const SILENT_RETRY = 10 * 60_000

/** connect/reauth show Google's page; silent renews an expired token without it (prompt=none). */
export type SignInPurpose = 'connect' | 'reauth' | 'silent'

/** Where Google sends you back: the app's own URL. Must be an authorised redirect URI. */
export function redirectUri(): string {
  return `${location.origin}${import.meta.env.BASE_URL}`
}

function store(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage blocked */
  }
}

function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null
  } catch {
    return null
  }
}

/** The cached token, if it has more than a minute left. Kept across reloads within its hour. */
export function cachedToken(): string | null {
  const t = read<{ token: string; exp: number }>(TOKEN_KEY)
  return t && t.exp - 60_000 > Date.now() ? t.token : null
}

export function clearToken(): void {
  store(TOKEN_KEY, null)
}

/** Leave for Google's sign-in page. The app loads again on return (see consumeRedirect). */
export function startSignIn(purpose: SignInPurpose, hint?: string): void {
  const state = crypto.randomUUID()
  store(PENDING_KEY, { state, purpose, hash: location.hash, at: Date.now() })
  const q = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope: SCOPE,
    include_granted_scopes: 'true',
    state,
  })
  // A known account goes straight through; otherwise let the person pick one.
  if (hint) q.set('login_hint', hint)
  if (purpose === 'silent') {
    q.set('prompt', 'none')
    store(SILENT_KEY, Date.now())
  } else if (!hint) q.set('prompt', 'select_account')
  location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${q}`)
}

/**
 * Whether to try a silent renewal now: online, and no silent attempt in the last ten
 * minutes (if Google needs the person, it answers with an error and we must not loop).
 */
export function silentAllowed(): boolean {
  const last = read<number>(SILENT_KEY) ?? 0
  return navigator.onLine && Date.now() - last > SILENT_RETRY
}

export type RedirectResult =
  | { ok: true; purpose: SignInPurpose; token: string }
  | { ok: false; purpose: SignInPurpose; error: string }
  | null

/**
 * On startup, before the router reads the hash: take the token (or error) Google put in
 * the URL fragment, check it answers our own request, and put the app's route back.
 */
export function consumeRedirect(): RedirectResult {
  const frag = new URLSearchParams(location.hash.replace(/^#/, ''))
  if (!frag.has('state') || !(frag.has('access_token') || frag.has('error'))) return null
  const pending = read<{ state: string; purpose: SignInPurpose; hash: string; at: number }>(PENDING_KEY)
  store(PENDING_KEY, null)
  history.replaceState(null, '', location.pathname + location.search + (pending?.hash || '#/projects'))
  if (!pending || pending.state !== frag.get('state') || Date.now() - pending.at > 15 * 60_000) {
    return { ok: false, purpose: pending?.purpose ?? 'connect', error: 'Sign-in was interrupted. Please try again.' }
  }
  const error = frag.get('error')
  if (error) return { ok: false, purpose: pending.purpose, error }
  if (!frag.get('scope')?.includes('drive.appdata')) {
    return { ok: false, purpose: pending.purpose, error: 'Clocky needs access to its Drive folder to sync. Please allow it when signing in.' }
  }
  const token = frag.get('access_token')!
  store(TOKEN_KEY, { token, exp: Date.now() + Number(frag.get('expires_in') ?? 3600) * 1000 })
  return { ok: true, purpose: pending.purpose, token }
}

export async function fetchEmail(token: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Could not read your Google account')
  return ((await res.json()) as { email?: string }).email ?? ''
}

export async function revoke(): Promise<void> {
  const t = cachedToken()
  clearToken()
  if (t) {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: t }),
    }).catch(() => {})
  }
}

/** Readable text for Google's error codes. */
export function describeError(code: string): string {
  if (code === 'access_denied') return 'Sign-in was cancelled.'
  return code.includes(' ') ? code : `Google sign-in failed (${code}).`
}
