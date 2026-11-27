import { db as defaultDb, type ClockyDB } from '../db'
import { nextColor } from '../palette'
import type { Project } from '../types'
import { ulid } from '../ulid'
import { isLive, nameKey, touched } from './sync-fields'

export class ValidationError extends Error {}

/** All projects that are not deleted, sorted by name. */
export async function listProjects(db: ClockyDB = defaultDb): Promise<Project[]> {
  const all = await db.projects.toArray()
  return all.filter(isLive).sort(byName)
}

export function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

async function checkName(db: ClockyDB, name: string, exceptId?: string): Promise<string> {
  const clean = name.trim()
  if (!clean) throw new ValidationError('Give the project a name.')
  const clash = (await listProjects(db)).find((p) => p.id !== exceptId && nameKey(p.name) === nameKey(clean))
  if (clash) throw new ValidationError(`There is already a project called "${clash.name}".`)
  return clean
}

export async function suggestColor(db: ClockyDB = defaultDb): Promise<string> {
  const live = (await listProjects(db)).filter((p) => !p.archived)
  return nextColor(live.map((p) => p.color))
}

export async function createProject(
  input: { name: string; color: string },
  db: ClockyDB = defaultDb,
): Promise<Project> {
  const name = await checkName(db, input.name)
  const project = touched<Project>({ id: ulid(), updatedAt: 0, name, color: input.color })
  await db.projects.add(project)
  return project
}

export async function updateProject(
  id: string,
  changes: { name?: string; color?: string; archived?: boolean },
  db: ClockyDB = defaultDb,
): Promise<Project> {
  return db.transaction('rw', db.projects, async () => {
    const current = await db.projects.get(id)
    if (!isLive(current)) throw new ValidationError('That project no longer exists.')
    const next: Project = { ...current }
    if (changes.name !== undefined) next.name = await checkName(db, changes.name, id)
    if (changes.color !== undefined) next.color = changes.color
    if (changes.archived !== undefined) {
      if (changes.archived) next.archived = 1
      else delete next.archived
    }
    const saved = touched(next)
    await db.projects.put(saved)
    return saved
  })
}
