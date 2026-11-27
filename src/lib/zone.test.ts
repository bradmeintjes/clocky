import { describe, expect, it } from 'vitest'
import { addDaysToKey, clockTime, dateKey, parseHM, zonedTime } from './zone'

describe('zone helpers', () => {
  const t = Date.UTC(2026, 10, 27, 23, 30) // 23:30 UTC

  it('reads date and time in the entry zone', () => {
    expect(dateKey(t, 'UTC')).toBe('2026-11-27')
    expect(dateKey(t, 'Africa/Johannesburg')).toBe('2026-11-28') // UTC+2
    expect(clockTime(t, 'Africa/Johannesburg')).toBe('01:30')
    expect(clockTime(t, 'America/New_York')).toBe('18:30')
  })

  it('round-trips wall-clock time to an instant', () => {
    for (const tz of ['UTC', 'Europe/London', 'Africa/Johannesburg', 'America/Los_Angeles', 'Asia/Kolkata']) {
      const back = zonedTime(dateKey(t, tz), clockTime(t, tz), tz)
      expect(back).toBe(t)
    }
  })

  it('handles daylight saving changes', () => {
    // London clocks go forward at 01:00 on 29 Mar 2026; 01:30 does not exist.
    const gap = zonedTime('2026-03-29', '01:30', 'Europe/London')!
    expect(clockTime(gap, 'Europe/London')).toBe('02:30')
    // Summer time: 09:00 BST is 08:00 UTC.
    expect(zonedTime('2026-07-01', '09:00', 'Europe/London')).toBe(Date.UTC(2026, 6, 1, 8, 0))
    // Clocks go back at 02:00 on 25 Oct 2026; 01:30 happens twice. Take the first.
    expect(zonedTime('2026-10-25', '01:30', 'Europe/London')).toBe(Date.UTC(2026, 9, 25, 0, 30))
  })

  it('parses times', () => {
    expect(parseHM('9:05')).toEqual([9, 5])
    expect(parseHM('0905')).toEqual([9, 5])
    expect(parseHM('24:00')).toBeNull()
    expect(parseHM('abc')).toBeNull()
  })

  it('shifts date keys across month ends', () => {
    expect(addDaysToKey('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28')
  })
})
