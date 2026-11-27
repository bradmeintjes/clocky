import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { ClockyDB } from '../db'
import type { Entry } from '../types'
import { ulid } from '../ulid'
import { createProject, listProjects, suggestColor, updateProject, ValidationError } from './projects'
import { deleteTag, getOrCreateTag, listTags, mergeTags, renameTag, tagUsage } from './tags'

let db: ClockyDB

beforeEach(() => {
  db = new ClockyDB('test-' + ulid())
})

function entry(tagIds: string[]): Entry {
  return {
    id: ulid(), updatedAt: 0, projectId: 'p', task: '', description: '', tagIds,
    start: 0, end: 1, breaks: [], tz: 'UTC', attachmentIds: [],
  }
}

describe('projects', () => {
  it('creates a dirty project with a trimmed name', async () => {
    const p = await createProject({ name: '  Website  ', color: '#0091E6' }, db)
    expect(p.name).toBe('Website')
    expect(p.dirty).toBe(1)
    expect(p.updatedAt).toBeGreaterThan(0)
    expect(await listProjects(db)).toHaveLength(1)
  })

  it('rejects empty and duplicate names, case-insensitively', async () => {
    await createProject({ name: 'Website', color: '#000' }, db)
    await expect(createProject({ name: ' ', color: '#000' }, db)).rejects.toThrow(ValidationError)
    await expect(createProject({ name: 'website', color: '#000' }, db)).rejects.toThrow(/already/)
  })

  it('renames, recolours and archives', async () => {
    const p = await createProject({ name: 'A', color: '#111' }, db)
    await updateProject(p.id, { name: 'B', color: '#222', archived: true }, db)
    let [saved] = await listProjects(db)
    expect(saved).toMatchObject({ name: 'B', color: '#222', archived: 1 })
    await updateProject(p.id, { archived: false }, db)
    ;[saved] = await listProjects(db)
    expect(saved.archived).toBeUndefined()
  })

  it('keeps its own name when renaming to the same name', async () => {
    const p = await createProject({ name: 'Website', color: '#111' }, db)
    await expect(updateProject(p.id, { name: 'WEBSITE' }, db)).resolves.toMatchObject({ name: 'WEBSITE' })
  })

  it('suggests an unused colour', async () => {
    const first = await suggestColor(db)
    await createProject({ name: 'A', color: first }, db)
    expect(await suggestColor(db)).not.toBe(first)
  })
})

describe('tags', () => {
  it('reuses an existing tag regardless of case', async () => {
    const a = await getOrCreateTag('Design', db)
    const b = await getOrCreateTag(' design ', db)
    expect(b.id).toBe(a.id)
    expect(await listTags(db)).toHaveLength(1)
  })

  it('refuses to rename onto another tag', async () => {
    const a = await getOrCreateTag('design', db)
    await getOrCreateTag('frontend', db)
    await expect(renameTag(a.id, 'Frontend', db)).rejects.toThrow(/Merge/)
    await expect(renameTag(a.id, 'UI design', db)).resolves.toMatchObject({ name: 'UI design' })
  })

  it('merges a tag into another on every entry', async () => {
    const a = await getOrCreateTag('ui', db)
    const b = await getOrCreateTag('design', db)
    const both = entry([a.id, b.id])
    const onlyA = entry([a.id])
    await db.entries.bulkAdd([both, onlyA, entry([])])

    await mergeTags(a.id, b.id, db)

    expect((await db.entries.get(both.id))!.tagIds).toEqual([b.id])
    expect((await db.entries.get(onlyA.id))!.tagIds).toEqual([b.id])
    expect((await db.entries.get(onlyA.id))!.dirty).toBe(1)
    expect((await listTags(db)).map((t) => t.name)).toEqual(['design'])
    expect((await db.tags.get(a.id))!.deleted).toBe(1)
  })

  it('deletes a tag from entries and leaves a tombstone', async () => {
    const a = await getOrCreateTag('ui', db)
    const e = entry([a.id])
    await db.entries.add(e)
    await deleteTag(a.id, db)
    expect((await db.entries.get(e.id))!.tagIds).toEqual([])
    expect(await listTags(db)).toEqual([])
    expect((await db.tags.get(a.id))!.deleted).toBe(1)
  })

  it('counts usage per tag', async () => {
    const a = await getOrCreateTag('ui', db)
    await db.entries.bulkAdd([entry([a.id]), entry([a.id]), { ...entry([a.id]), deleted: 1 }])
    expect((await tagUsage(db)).get(a.id)).toBe(2)
  })
})
