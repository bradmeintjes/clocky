// Wall-clock helpers in an entry's own IANA time zone, so dates never shift
// when you travel or when daylight saving changes.

export function localZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

const fmtCache = new Map<string, Intl.DateTimeFormat>()

function parts(t: number, tz: string) {
  let f = fmtCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
    fmtCache.set(tz, f)
  }
  const o: Record<string, number> = {}
  for (const p of f.formatToParts(new Date(t))) if (p.type !== 'literal') o[p.type] = Number(p.value)
  return o as { year: number; month: number; day: number; hour: number; minute: number; second: number }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** YYYY-MM-DD of `t` in zone `tz`. */
export function dateKey(t: number, tz: string): string {
  const p = parts(t, tz)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** HH:MM (24-hour) of `t` in zone `tz`. */
export function clockTime(t: number, tz: string): string {
  const p = parts(t, tz)
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/** Offset of `tz` from UTC at instant `t`, in ms. */
function offset(t: number, tz: string): number {
  const p = parts(t, tz)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(t / 1000) * 1000
}

/**
 * Epoch ms for wall-clock `date` (YYYY-MM-DD) and `time` (HH:MM) in zone `tz`.
 * Returns null for malformed input. In a DST gap the time moves forward; in an
 * overlap the earlier instant wins.
 */
export function zonedTime(date: string, time: string, tz: string): number | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const h = parseHM(time)
  if (!d || !h) return null
  const guess = Date.UTC(+d[1], +d[2] - 1, +d[3], h[0], h[1])
  // Try the zone's offsets either side of the guess, so DST changes are covered.
  const day = 86_400_000
  const candidates = [-day, 0, day].map((d) => guess - offset(guess + d, tz))
  const want = `${pad(h[0])}:${pad(h[1])}`
  const matches = candidates.filter((c) => clockTime(c, tz) === want && dateKey(c, tz) === date)
  if (matches.length) return Math.min(...matches) // overlap: earlier instant
  return Math.max(...candidates) // gap: the time moves forward
}

/** Parse "9:05", "09:05" or "0905" into [hours, minutes]. */
export function parseHM(s: string): [number, number] | null {
  const m = /^\s*(\d{1,2}):?(\d{2})\s*$/.exec(s)
  if (!m) return null
  const hh = +m[1]
  const mm = +m[2]
  if (hh > 23 || mm > 59) return null
  return [hh, mm]
}

/** Shift a YYYY-MM-DD string by whole days. */
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}
