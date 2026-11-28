// App-wide sync state: local-only or Google, status for Settings, and when to sync.
import Dexie from 'dexie'
import { db } from '../db'
import { cachedToken, clearToken, describeError, fetchEmail, revoke, silentAllowed, startSignIn, type RedirectResult } from './auth'
import { AuthError, GoogleDrive } from './drive'
import { META_LAST, pendingCount, resetSyncState, syncOnce } from './engine'
import { dropSyncedBlobs } from '../data/attachments'
import { prefs } from '../settings.svelte'

export type Mode = 'local' | 'google'
type Status = 'idle' | 'syncing' | 'error' | 'needs-auth' | 'offline'

const META_ACCOUNT = 'account'
const DEBOUNCE = 10_000

class NeedsAuth extends Error {}

class SyncState {
  ready = $state(false)
  mode = $state<Mode | null>(null) // null until chosen on first launch
  email = $state('')
  status = $state<Status>('idle')
  error = $state('')
  lastSync = $state<number | null>(null)
  pending = $state(0)
  uploads = $state<Record<string, number>>({}) // attachment id -> fraction sent
  busy = $state(false) // sign-in in progress

  private timer: ReturnType<typeof setTimeout> | undefined
  private running: Promise<void> | null = null
  private again = false

  private drive = new GoogleDrive(async () => {
    const t = cachedToken()
    if (!t) throw new NeedsAuth()
    return t
  })

  async init(redirect: RedirectResult = null) {
    const acct = (await db.meta.get(META_ACCOUNT))?.value as { mode: Mode; email?: string } | undefined
    this.mode = acct?.mode ?? null
    this.email = acct?.email ?? ''
    this.lastSync = ((await db.meta.get(META_LAST))?.value as number) ?? null
    this.pending = await pendingCount(db)
    if (redirect) await this.finishSignIn(redirect)
    // Token expired since last time: renew it with Google before showing anything, so
    // the app opens synced instead of asking to sign in. Comes straight back.
    else if (this.renewSilently()) return
    this.ready = true

    Dexie.on('storagemutated', (parts) => {
      const keys = Object.keys(parts)
      if (keys.every((k) => k.includes('/meta/') || k.includes('/blobs/'))) return
      void pendingCount(db).then((n) => (this.pending = n))
      if (!this.running) this.schedule()
    })
    // Back from Google's page without finishing: the page may be restored as it was.
    addEventListener('pageshow', (e) => e.persisted && (this.busy = false))
    addEventListener('online', () => this.syncSoon(0))
    addEventListener('offline', () => this.mode === 'google' && (this.status = 'offline'))
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return
      // Back in the app after a while: renew an expired token unless something is open.
      if (!document.querySelector('[role="dialog"]') && this.renewSilently()) return
      this.syncSoon(0)
    })
    this.syncSoon(0)
  }

  private async saveAccount() {
    await db.meta.put({ key: META_ACCOUNT, value: { mode: this.mode, ...(this.email ? { email: this.email } : {}) } })
  }

  async continueLocal() {
    this.mode = 'local'
    await this.saveAccount()
  }

  /** Sign in and start syncing. Leaves for Google's page; finishSignIn runs on return. */
  connect() {
    this.busy = true
    this.error = ''
    startSignIn('connect', this.email || undefined)
  }

  /** Leave for Google to renew an expired token without a prompt. False if not worth trying. */
  private renewSilently(): boolean {
    if (this.mode !== 'google' || cachedToken() || !this.email || !silentAllowed()) return false
    startSignIn('silent', this.email)
    return true
  }

  /** Back from Google: a connect uploads what is on this device; a re-auth just syncs. */
  private async finishSignIn(r: NonNullable<RedirectResult>) {
    if (!r.ok && r.purpose === 'silent') {
      this.status = 'needs-auth' // Google wants the person: show the Sign in banner
      return
    }
    if (!r.ok) {
      this.error = describeError(r.error)
      if (r.purpose === 'reauth') this.status = 'needs-auth'
      return
    }
    try {
      const email = await fetchEmail(r.token)
      if (this.email && email && email !== this.email) await resetSyncState(db) // different account
      this.email = email
      this.mode = 'google'
      await this.saveAccount()
      this.status = 'idle'
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e)
    }
  }

  /** Stop syncing. Local data stays; Drive keeps its copy. */
  async disconnect() {
    clearTimeout(this.timer)
    await revoke()
    await resetSyncState(db)
    this.mode = 'local'
    this.email = ''
    this.status = 'idle'
    this.lastSync = null
    this.error = ''
    await this.saveAccount()
  }

  schedule() {
    this.syncSoon(DEBOUNCE)
  }

  syncSoon(ms: number) {
    if (this.mode !== 'google') return
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.syncNow(), ms)
  }

  async syncNow(): Promise<void> {
    if (this.mode !== 'google') return
    if (this.running) {
      this.again = true
      return this.running
    }
    if (!navigator.onLine) {
      this.status = 'offline'
      return
    }
    if (!cachedToken()) {
      this.status = 'needs-auth'
      return
    }
    this.status = 'syncing'
    this.error = ''
    this.running = (async () => {
      try {
        do {
          this.again = false
          await syncOnce(db, this.drive, {
            onUpload: (id, sent, total) => (this.uploads = { ...this.uploads, [id]: total ? sent / total : 1 }),
          })
        } while (this.again)
        this.lastSync = Date.now()
        this.status = 'idle'
        await dropSyncedBlobs(prefs.value.keepMonths).catch(() => 0)
      } catch (e) {
        if (e instanceof NeedsAuth || e instanceof AuthError) {
          clearToken()
          this.status = 'needs-auth'
        } else {
          this.status = navigator.onLine ? 'error' : 'offline'
          this.error = e instanceof Error ? e.message : String(e)
          console.error(e)
        }
      } finally {
        this.uploads = {}
        this.pending = await pendingCount(db)
        this.running = null
      }
    })()
    return this.running
  }

  /** Banner action: a fresh token from Google, then sync on return. */
  reauth() {
    this.busy = true
    startSignIn('reauth', this.email || undefined)
  }

  /** Download an attachment's bytes from Drive and keep them locally. */
  async fetchBlob(attachmentId: string, driveFileId: string): Promise<Blob | undefined> {
    if (this.mode !== 'google' || !cachedToken()) return undefined
    const blob = await this.drive.download(driveFileId)
    await db.blobs.put({ id: attachmentId, data: blob })
    return blob
  }
}

export const sync = new SyncState()
