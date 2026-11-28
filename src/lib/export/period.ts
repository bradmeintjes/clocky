// Export periods as inclusive ranges of local date keys (YYYY-MM-DD).
import { addDaysToKey } from '../zone'

export type PeriodKind = 'this-month' | 'last-month' | 'this-week' | 'last-week' | 'custom'

export interface Period {
  from: string // inclusive
  to: string // inclusive
  label: string
  slug: string // for file names
}

const pad = (n: number) => String(n).padStart(2, '0')
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Every date key from `from` to `to`, inclusive. */
export function daysIn(from: string, to: string): string[] {
  const out: string[] = []
  for (let k = from; k <= to; k = addDaysToKey(k, 1)) out.push(k)
  return out
}

function monthName(y: number, m: number) {
  return new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function shortDate(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function periodFor(
  kind: PeriodKind,
  opts: { now?: number; weekStart?: number; from?: string; to?: string } = {},
): Period {
  const now = new Date(opts.now ?? Date.now())
  const y = now.getFullYear()
  const m = now.getMonth()
  if (kind === 'this-month' || kind === 'last-month') {
    const first = kind === 'this-month' ? new Date(y, m, 1) : new Date(y, m - 1, 1)
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
    return {
      from: keyOf(first),
      to: keyOf(last),
      label: monthName(first.getFullYear(), first.getMonth()),
      slug: `${first.getFullYear()}-${pad(first.getMonth() + 1)}`,
    }
  }
  if (kind === 'this-week' || kind === 'last-week') {
    const ws = opts.weekStart ?? 1
    const start = new Date(y, m, now.getDate() - ((now.getDay() - ws + 7) % 7) - (kind === 'last-week' ? 7 : 0))
    const from = keyOf(start)
    const to = addDaysToKey(from, 6)
    return { from, to, label: `Week of ${shortDate(from)}`, slug: `${from}_${to}` }
  }
  let from = opts.from ?? keyOf(now)
  let to = opts.to ?? from
  if (to < from) [from, to] = [to, from]
  return { from, to, label: from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`, slug: from === to ? from : `${from}_${to}` }
}
