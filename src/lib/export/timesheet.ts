// Pure export model shared by the preview, CSV and Excel, so they always agree.
import { breakMs, workedMs } from '../time'
import type { Attachment, Entry, Project, Tag } from '../types'
import { clockTime, dateKey } from '../zone'
import { daysIn, type Period } from './period'

export interface ExportRow {
  date: string
  project: string
  task: string
  description: string
  tags: string[]
  start: string
  end: string
  breakMs: number
  workedMs: number
  manual: boolean
  links: string[]
  attachments: number
}

export interface Column {
  key: string
  name: string
  color?: string
}

export interface Grid {
  columns: Column[]
  days: { date: string; cells: number[]; total: number }[]
  totals: number[]
  total: number
}

export interface Timesheet {
  period: Period
  rows: ExportRow[]
  byProject: Grid
  byTag: Grid
  runningExcluded: number
}

export interface ExportInput {
  period: Period
  entries: Entry[] // any superset; filtered here
  projects: Project[]
  tags: Tag[]
  attachments?: Attachment[]
  projectIds?: string[] // empty or undefined: all
}

export const UNTAGGED = '__untagged'

export function buildTimesheet(input: ExportInput): Timesheet {
  const { period } = input
  const filter = input.projectIds?.length ? new Set(input.projectIds) : null
  const projectById = new Map(input.projects.map((p) => [p.id, p]))
  const tagById = new Map(input.tags.map((t) => [t.id, t]))
  const attsByEntry = new Map<string, Attachment[]>()
  for (const a of input.attachments ?? []) {
    if (a.deleted) continue
    attsByEntry.set(a.entryId, [...(attsByEntry.get(a.entryId) ?? []), a])
  }

  const inPeriod = input.entries.filter((e) => {
    if (e.deleted) return false
    if (filter && !filter.has(e.projectId)) return false
    const d = dateKey(e.start, e.tz)
    return d >= period.from && d <= period.to
  })
  const runningExcluded = inPeriod.filter((e) => e.end === null).length
  const done = inPeriod.filter((e) => e.end !== null).sort((a, b) => a.start - b.start)

  const rows: ExportRow[] = done.map((e) => {
    const atts = attsByEntry.get(e.id) ?? []
    return {
      date: dateKey(e.start, e.tz),
      project: projectById.get(e.projectId)?.name ?? 'Unknown project',
      task: e.task,
      description: e.description,
      tags: e.tagIds.map((id) => tagById.get(id)?.name).filter((n): n is string => !!n),
      start: clockTime(e.start, e.tz),
      end: clockTime(e.end!, e.tz),
      breakMs: breakMs(e),
      workedMs: workedMs(e),
      manual: !!e.manual,
      links: atts.filter((a) => a.kind === 'link' && a.url).map((a) => a.url!),
      attachments: atts.filter((a) => a.kind !== 'link').length,
    }
  })

  const days = daysIn(period.from, period.to)

  // Project columns: projects with time in the period, by name.
  const projectCols: Column[] = [...new Set(done.map((e) => e.projectId))]
    .map((id) => ({ key: id, name: projectById.get(id)?.name ?? 'Unknown project', color: projectById.get(id)?.color }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  const byProject = grid(days, projectCols, done, (e) => [e.projectId])

  // Tag columns: tags used in the period, by name, then Untagged.
  const tagIds = [...new Set(done.flatMap((e) => e.tagIds).filter((id) => tagById.has(id)))]
  const tagCols: Column[] = tagIds
    .map((id) => ({ key: id, name: tagById.get(id)!.name }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  const live = (e: Entry) => e.tagIds.filter((id) => tagById.has(id))
  if (done.some((e) => live(e).length === 0)) tagCols.push({ key: UNTAGGED, name: 'Untagged' })
  // An entry with two tags counts under both, so the day total is the real worked time, not the row sum.
  const byTag = grid(days, tagCols, done, (e) => (live(e).length ? live(e) : [UNTAGGED]))

  return { period, rows, byProject, byTag, runningExcluded }
}

function grid(days: string[], columns: Column[], entries: Entry[], keysOf: (e: Entry) => string[]): Grid {
  const col = new Map(columns.map((c, i) => [c.key, i]))
  const byDay = new Map(days.map((d) => [d, { date: d, cells: columns.map(() => 0), total: 0 }]))
  for (const e of entries) {
    const row = byDay.get(dateKey(e.start, e.tz))
    if (!row) continue
    const w = workedMs(e)
    row.total += w
    for (const k of keysOf(e)) {
      const i = col.get(k)
      if (i !== undefined) row.cells[i] += w
    }
  }
  // Only days with time: no blank rows in the preview or the files.
  const rows = [...byDay.values()].filter((r) => r.total > 0)
  return {
    columns,
    days: rows,
    totals: columns.map((_, i) => rows.reduce((s, r) => s + r.cells[i], 0)),
    total: rows.reduce((s, r) => s + r.total, 0),
  }
}
