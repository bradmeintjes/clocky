import { describe, expect, it } from 'vitest'
import { HOUR, MIN } from '../time'
import type { Entry, Project, Tag } from '../types'
import { csvCell, toCsv } from './csv'
import { daysIn, periodFor } from './period'
import { buildTimesheet } from './timesheet'
import { workbookSheets } from './xlsx'

const tz = 'UTC'
const at = (d: number, h: number, m = 0) => Date.UTC(2026, 10, d, h, m)
const projects: Project[] = [
  { id: 'w', name: 'Website', color: '#0091E6', updatedAt: 0 },
  { id: 'm', name: 'Mobile app', color: '#8E4EC6', updatedAt: 0 },
  { id: 'o', name: 'Old site', color: '#697386', updatedAt: 0, archived: 1 },
]
const tags: Tag[] = [
  { id: 'd', name: 'design', updatedAt: 0 },
  { id: 'f', name: 'frontend', updatedAt: 0 },
]
let n = 0
function entry(projectId: string, start: number, end: number | null, extra: Partial<Entry> = {}): Entry {
  return { id: `e${n++}`, updatedAt: 0, projectId, task: '', description: '', tagIds: [], start, end, breaks: [], tz, attachmentIds: [], ...extra }
}

const november = periodFor('custom', { from: '2026-11-01', to: '2026-11-30' })

describe('periods', () => {
  const now = new Date(2026, 10, 27, 14).getTime() // Fri 27 Nov 2026

  it('covers months and weeks', () => {
    expect(periodFor('this-month', { now })).toMatchObject({ from: '2026-11-01', to: '2026-11-30', slug: '2026-11' })
    expect(periodFor('last-month', { now })).toMatchObject({ from: '2026-10-01', to: '2026-10-31', slug: '2026-10' })
    expect(periodFor('this-week', { now })).toMatchObject({ from: '2026-11-23', to: '2026-11-29' })
    expect(periodFor('last-week', { now, weekStart: 0 })).toMatchObject({ from: '2026-11-15', to: '2026-11-21' })
    expect(periodFor('last-month', { now: new Date(2026, 0, 10).getTime() })).toMatchObject({ slug: '2025-12' })
  })

  it('swaps a backwards custom range', () => {
    expect(periodFor('custom', { from: '2026-11-10', to: '2026-11-01' })).toMatchObject({ from: '2026-11-01', to: '2026-11-10' })
  })

  it('lists every day', () => {
    expect(daysIn('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02'])
  })
})

describe('timesheet', () => {
  const entries = [
    entry('w', at(3, 9, 2), at(3, 12, 47), { breaks: [[at(3, 10, 0), at(3, 10, 15)]], tagIds: ['d', 'f'], task: 'Header', manual: 1 }),
    entry('m', at(3, 13), at(3, 14, 15), { tagIds: ['f'] }),
    entry('m', at(4, 9), at(4, 15)),
    entry('o', at(5, 23), at(6, 1)), // crosses midnight: stays on the 5th
    entry('w', at(30, 9), null), // running: excluded
    entry('w', Date.UTC(2026, 9, 31, 9), Date.UTC(2026, 9, 31, 10)), // October: out of period
    entry('w', at(10, 9), at(10, 10), { deleted: 1 }),
  ]
  const ts = buildTimesheet({ period: november, entries, projects, tags })

  it('filters to the period and skips running and deleted entries', () => {
    expect(ts.rows).toHaveLength(4)
    expect(ts.runningExcluded).toBe(1)
  })

  it('totals by project and day, without rounding', () => {
    const g = ts.byProject
    expect(g.columns.map((c) => c.name)).toEqual(['Mobile app', 'Old site', 'Website'])
    expect(g.days).toHaveLength(30)
    const d3 = g.days.find((d) => d.date === '2026-11-03')!
    expect(d3.cells).toEqual([75 * MIN, 0, 3 * HOUR + 30 * MIN])
    expect(d3.total).toBe(4 * HOUR + 45 * MIN)
    expect(g.days.find((d) => d.date === '2026-11-05')!.total).toBe(2 * HOUR)
    expect(g.total).toBe(4.75 * HOUR + 6 * HOUR + 2 * HOUR)
    expect(g.totals.reduce((a, b) => a + b, 0)).toBe(g.total)
  })

  it('counts multi-tag entries under each tag and adds Untagged', () => {
    const g = ts.byTag
    expect(g.columns.map((c) => c.name)).toEqual(['design', 'frontend', 'Untagged'])
    const d3 = g.days.find((d) => d.date === '2026-11-03')!
    expect(d3.cells).toEqual([3.5 * HOUR, 3.5 * HOUR + 75 * MIN, 0])
    expect(d3.total).toBe(4.75 * HOUR) // real worked time, not the column sum
  })

  it('filters by project', () => {
    const only = buildTimesheet({ period: november, entries, projects, tags, projectIds: ['m'] })
    expect(only.byProject.columns.map((c) => c.name)).toEqual(['Mobile app'])
    expect(only.rows).toHaveLength(2)
  })

  it('handles an empty period', () => {
    const empty = buildTimesheet({ period: periodFor('custom', { from: '2026-12-01', to: '2026-12-03' }), entries, projects, tags })
    expect(empty.rows).toEqual([])
    expect(empty.byProject.days).toHaveLength(3)
    expect(empty.byProject.total).toBe(0)
  })

  it("uses each entry's own time zone for its date", () => {
    const late = entry('w', Date.UTC(2026, 10, 30, 23, 30), Date.UTC(2026, 11, 1, 0, 30), { tz: 'Africa/Johannesburg' })
    const t = buildTimesheet({ period: november, entries: [late], projects, tags })
    expect(t.rows).toHaveLength(0) // 01:30 on 1 Dec in Johannesburg
  })
})

describe('csv', () => {
  it('quotes, escapes and defuses formulas', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a, b')).toBe('"a, b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell('-1, two')).toBe(`"'-1, two"`)
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"')
  })

  it("writes the plan's columns with a BOM and h:mm durations", () => {
    const ts = buildTimesheet({
      period: november,
      entries: [entry('w', at(3, 9, 2), at(3, 12, 47), { breaks: [[at(3, 10, 0), at(3, 10, 15)]], tagIds: ['d', 'f'], task: 'Header redesign', description: 'Reworked nav, fixed mobile menu', manual: 1 })],
      projects,
      tags,
    })
    const csv = toCsv(ts.rows)
    expect(csv.startsWith('﻿')).toBe(true)
    const lines = csv.slice(1).trim().split('\r\n')
    expect(lines[0]).toBe('Date,Project,Task,Description,Tags,Start,End,Breaks,Worked,Manual,Links,Attachments')
    expect(lines[1]).toBe('2026-11-03,Website,Header redesign,"Reworked nav, fixed mobile menu",design; frontend,09:02,12:47,0:15,3:30,Yes,,0')
  })
})

describe('xlsx sheets', () => {
  const ts = buildTimesheet({ period: periodFor('custom', { from: '2026-11-03', to: '2026-11-04' }), entries: [entry('w', at(3, 9), at(3, 12, 30), { tagIds: ['d'] })], projects, tags })

  it('builds Timesheet and Entries, plus By tag when asked', () => {
    expect(workbookSheets(ts, { byTag: false }).map((s) => s.sheet)).toEqual(['Timesheet', 'Entries'])
    expect(workbookSheets(ts, { byTag: true }).map((s) => s.sheet)).toEqual(['Timesheet', 'By tag', 'Entries'])
  })

  it('writes durations as [h]:mm time values and empty days as blank rows', () => {
    const data = workbookSheets(ts, { byTag: false })[0].data
    expect(data).toHaveLength(4) // header, 2 days, total
    const day = data[1]
    expect(day[1]).toMatchObject({ value: 3.5 / 24, format: '[h]:mm' })
    expect(data[2][1]).toBeNull()
    expect(data[3][0]).toMatchObject({ value: 'Total' })
  })
})
