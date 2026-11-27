import { addDaysToKey, dateKey } from './zone'
import { localZone } from './zone'

/** "Today", "Yesterday" or "Mon 24 Nov" for a YYYY-MM-DD key. */
export function dayLabel(key: string, now = Date.now()): string {
  const today = dateKey(now, localZone())
  if (key === today) return 'Today'
  if (key === addDaysToKey(today, -1)) return 'Yesterday'
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const sameYear = y === new Date(now).getFullYear()
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}
