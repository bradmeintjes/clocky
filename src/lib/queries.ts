import { liveQuery } from 'dexie'
import { db } from './db'
import { listProjects } from './data/projects'
import { listTags, tagUsage } from './data/tags'
import type { Entry } from './types'
import { workedMs } from './time'

// Dexie live queries. Each is a Svelte-compatible store: use `$projects` in components.

export const projects = liveQuery(() => listProjects())
export const tags = liveQuery(() => listTags())
export const tagCounts = liveQuery(() => tagUsage())

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
