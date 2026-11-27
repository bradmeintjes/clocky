import { describe, expect, it } from 'vitest'
import { addDays, formatHM, HOUR, MIN, startOfWeek, workedMs } from './time'

describe('workedMs', () => {
  it('subtracts breaks', () => {
    const e = { start: 0, end: 4 * HOUR, breaks: [[HOUR, HOUR + 30 * MIN]] as [number, number][] }
    expect(workedMs(e)).toBe(3.5 * HOUR)
  })

  it('counts a running entry and an open break up to now', () => {
    const e = { start: 0, end: null, breaks: [[2 * HOUR, null]] as [number, number | null][] }
    expect(workedMs(e, 3 * HOUR)).toBe(2 * HOUR)
  })
})

describe('formatHM', () => {
  it('formats hours and minutes without rounding', () => {
    expect(formatHM(0)).toBe('0:00')
    expect(formatHM(3 * HOUR + 30 * MIN + 59_999)).toBe('3:30')
    expect(formatHM(42 * HOUR + 5 * MIN)).toBe('42:05')
  })
})

describe('startOfWeek', () => {
  const fri = new Date(2026, 10, 27, 14, 20).getTime() // Fri 27 Nov 2026

  it('defaults to Monday', () => {
    expect(new Date(startOfWeek(fri))).toEqual(new Date(2026, 10, 23))
  })

  it('supports Sunday and Saturday starts', () => {
    expect(new Date(startOfWeek(fri, 0))).toEqual(new Date(2026, 10, 22))
    expect(new Date(startOfWeek(fri, 6))).toEqual(new Date(2026, 10, 21))
  })

  it('returns the same day when it is the week start', () => {
    const mon = new Date(2026, 10, 23, 9).getTime()
    expect(new Date(startOfWeek(mon))).toEqual(new Date(2026, 10, 23))
  })
})

describe('addDays', () => {
  it('adds calendar days', () => {
    expect(new Date(addDays(new Date(2026, 10, 30).getTime(), 1))).toEqual(new Date(2026, 11, 1))
  })
})
