import type { Entry } from './types'

export const MIN = 60_000
export const HOUR = 60 * MIN
export const DAY = 24 * HOUR

/** Total break time in ms. An open break counts up to `now`. */
export function breakMs(e: Pick<Entry, 'breaks'>, now = Date.now()): number {
  return e.breaks.reduce((sum, [s, end]) => sum + ((end ?? now) - s), 0)
}

/** Worked time: (end - start) - breaks. A running entry counts up to `now`. */
export function workedMs(e: Pick<Entry, 'start' | 'end' | 'breaks'>, now = Date.now()): number {
  return Math.max(0, (e.end ?? now) - e.start - breakMs(e, now))
}

/** Hours and minutes, no rounding: 3:30, 42:05. */
export function formatHM(ms: number): string {
  const m = Math.floor(Math.max(0, ms) / MIN)
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

/**
 * Local midnight at the start of the week containing `t`.
 * `weekStart` is a day number: 0 Sunday, 1 Monday (default), 6 Saturday.
 */
export function startOfWeek(t: number, weekStart = 1): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  const diff = (d.getDay() - weekStart + 7) % 7
  d.setDate(d.getDate() - diff)
  return d.getTime()
}

/** Local midnight on the first of the month containing `t`. */
export function startOfMonth(t: number): number {
  const d = new Date(t)
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
}

/** Add whole local days, safe across daylight saving changes. */
export function addDays(t: number, days: number): number {
  const d = new Date(t)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

/** Running clock: 1:05:09. */
export function formatHMS(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000)
  return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Short break length: "35 min", "1h 10m". */
export function formatBreak(ms: number): string {
  const m = Math.round(ms / MIN)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`
}
