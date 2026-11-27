import { liveQuery } from 'dexie'
import { db } from './db'
import { listProjects } from './data/projects'
import { getRunning } from './data/entries'
import { listTags, tagUsage } from './data/tags'
import type { Entry } from './types'
import { workedMs } from './time'

// Dexie live queries. Each is a Svelte-compatible store: use `$projects` in components.

export const projects = liveQuery(() => listProjects())
export const tags = liveQuery(() => listTags())
export const tagCounts = liveQuery(() => tagUsage())
export const running = liveQuery(() => getRunning())

/** Live entries for a project, newest first. */
export function projectEntries(projectId: string) {
  return liveQuery(async () => {
    const rows = await db.entries
      .where('[projectId+start]')
      .between([projectId, -Infinity], [projectId, Infinity])
      .reverse()
      .toArray()
    return rows.filter((e) => !e.deleted)
  })
}

/** Live entries starting in [from, to), all projects. */
export function entriesBetween(from: number, to: number) {
  return liveQuery(async () => {
    const rows = await db.entries.where('start').between(from, to, true, false).toArray()
    return rows.filter((e) => !e.deleted)
  })
}

/** Worked ms per project for entries starting in [from, to). Running timers count up to now. */
export function totalsBetween(from: number, to: number) {
  return liveQuery(async () => {
    const rows = await db.entries.where('start').between(from, to, true, false).toArray()
    return sumByProject(rows)
  })
}

export function sumByProject(rows: Entry[], now = Date.now()): Map<string, number> {
  const out = new Map<string, number>()
  for (const e of rows) {
    if (e.deleted) continue
    out.set(e.projectId, (out.get(e.projectId) ?? 0) + workedMs(e, now))
  }
  return out
}
