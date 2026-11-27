import { describe, expect, it } from 'vitest'
import { ulid, ulidTime } from './ulid'

describe('ulid', () => {
  it('is 26 Crockford base32 characters', () => {
    expect(ulid()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
  })

  it('encodes its creation time', () => {
    const t = Date.UTC(2026, 10, 27, 9, 30)
    expect(ulidTime(ulid(t))).toBe(t)
  })

  it('sorts by creation time', () => {
    const a = ulid(1_000)
    const b = ulid(2_000)
    expect(a < b).toBe(true)
  })
})
