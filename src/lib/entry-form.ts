// Converts between an entry's timestamps and the editor's wall-clock fields
// (a date plus HH:MM strings in the entry's own time zone).
import type { Break } from './data/entries'
import { ValidationError } from './data/projects'
import type { Entry } from './types'
import { addDaysToKey, clockTime, dateKey, zonedTime } from './zone'

export interface TimeFields {
  date: string // YYYY-MM-DD of the start
  start: string // HH:MM
  end: string | null // HH:MM, or null while running
  breaks: { start: string; end: string | null }[]
}

export function toFields(e: Pick<Entry, 'start' | 'end' | 'breaks' | 'tz'>): TimeFields {
  return {
    date: dateKey(e.start, e.tz),
    start: clockTime(e.start, e.tz),
    end: e.end === null ? null : clockTime(e.end, e.tz),
    breaks: e.breaks.map(([s, end]) => ({ start: clockTime(s, e.tz), end: end === null ? null : clockTime(end, e.tz) })),
  }
}

/**
 * Times after the start on the same date are that day; earlier ones roll to the
 * next day, so an entry can cross midnight.
 */
function onOrAfter(date: string, hm: string, after: number, tz: string, label: string): number {
  const t = zonedTime(date, hm, tz)
  if (t === null) throw new ValidationError(`Enter ${label} as HH:MM.`)
  if (t >= after) return t
  const next = zonedTime(addDaysToKey(date, 1), hm, tz)!
  return next
}

export function fromFields(f: TimeFields, tz: string): { start: number; end: number | null; breaks: Break[] } {
  const start = zonedTime(f.date, f.start, tz)
  if (start === null) throw new ValidationError('Enter a date and a start time as HH:MM.')
  const breaks: Break[] = f.breaks.map((b, i) => {
    const s = onOrAfter(f.date, b.start, start, tz, `break ${i + 1} start`)
    const e = b.end === null ? null : onOrAfter(f.date, b.end, s, tz, `break ${i + 1} end`)
    return [s, e]
  })
  const end = f.end === null ? null : onOrAfter(f.date, f.end, start + 1, tz, 'the end time')
  return { start, end, breaks }
}
