import { describe, expect, it } from 'vitest'
import { fromFields, toFields } from './entry-form'

const tz = 'Europe/London'

describe('entry form fields', () => {
  it('round-trips an entry', () => {
    const e = { start: Date.UTC(2026, 10, 3, 9, 2), end: Date.UTC(2026, 10, 3, 12, 47), breaks: [[Date.UTC(2026, 10, 3, 10, 30), Date.UTC(2026, 10, 3, 10, 45)]] as [number, number][], tz }
    const f = toFields(e)
    expect(f).toEqual({ date: '2026-11-03', start: '09:02', end: '12:47', breaks: [{ start: '10:30', end: '10:45' }] })
    expect(fromFields(f, tz)).toEqual({ start: e.start, end: e.end, breaks: e.breaks })
  })

  it('rolls an end before the start over midnight', () => {
    const r = fromFields({ date: '2026-11-03', start: '22:00', end: '01:30', breaks: [{ start: '23:50', end: '00:10' }] }, tz)
    expect(r.end! - r.start).toBe(3.5 * 3600e3)
    expect(r.breaks[0][1]! - r.breaks[0][0]).toBe(20 * 60e3)
  })

  it('keeps a running entry open', () => {
    const r = fromFields({ date: '2026-11-03', start: '09:00', end: null, breaks: [{ start: '10:00', end: null }] }, tz)
    expect(r.end).toBeNull()
    expect(r.breaks[0][1]).toBeNull()
  })

  it('explains bad input', () => {
    expect(() => fromFields({ date: '2026-11-03', start: '9am', end: '10:00', breaks: [] }, tz)).toThrow(/HH:MM/)
  })
})
