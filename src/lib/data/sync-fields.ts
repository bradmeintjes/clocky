import type { Synced } from '../types'

/** Mark a record as changed locally: new updatedAt, dirty for the next sync push. */
export function touched<T extends Synced>(record: T, now = Date.now()): T {
  return { ...record, updatedAt: now, dirty: 1 }
}

export function isLive<T extends Synced>(r: T | undefined): r is T {
  return !!r && !r.deleted
}

/** Case-insensitive, whitespace-trimmed key for uniqueness checks. */
export function nameKey(name: string): string {
  return name.trim().toLocaleLowerCase()
}
