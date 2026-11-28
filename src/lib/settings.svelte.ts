// Preferences, kept in the local meta table (not synced: they belong to this device).
import { db } from './db'

export interface Prefs {
  weekStart: number // 0 Sunday, 1 Monday, 6 Saturday
  nudgeHours: number // long-running timer threshold
  notify: boolean // system notification for the nudge
  keepMonths: number // attachment bytes kept on device once on Drive; 0 = forever
}

export const DEFAULT_PREFS: Prefs = { weekStart: 1, nudgeHours: 8, notify: false, keepMonths: 3 }
const KEY = 'prefs'

class PrefsState {
  value = $state<Prefs>({ ...DEFAULT_PREFS })

  async load() {
    const saved = (await db.meta.get(KEY))?.value as Partial<Prefs> | undefined
    this.value = { ...DEFAULT_PREFS, ...saved }
  }

  async set(patch: Partial<Prefs>) {
    this.value = { ...this.value, ...patch }
    await db.meta.put({ key: KEY, value: $state.snapshot(this.value) })
  }
}

export const prefs = new PrefsState()

/** Week start day (0 Sunday, 1 Monday, 6 Saturday). */
export function weekStartDay(): number {
  return prefs.value.weekStart
}
