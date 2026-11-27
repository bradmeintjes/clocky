import { describe, expect, it } from 'vitest'
import { parseHash } from './routes'

describe('parseHash', () => {
  it('defaults to projects', () => {
    expect(parseHash('')).toEqual({ name: 'projects' })
    expect(parseHash('#/nope')).toEqual({ name: 'projects' })
  })

  it('reads tabs and project ids', () => {
    expect(parseHash('#/export')).toEqual({ name: 'export' })
    expect(parseHash('#/settings')).toEqual({ name: 'settings' })
    expect(parseHash('#/project/01ABC')).toEqual({ name: 'project', id: '01ABC' })
  })
})
