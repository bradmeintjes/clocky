import { db as defaultDb, type ClockyDB } from '../db'
import type { Tag } from '../types'
import { ulid } from '../ulid'
import { ValidationError } from './projects'
import { isLive, nameKey, touched } from './sync-fields'

/** All tags that are not deleted, sorted by name. */
export async function listTags(db: ClockyDB = defaultDb): Promise<Tag[]> {
  const all = await db.tags.toArray()
  return all.filter(isLive).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

export async function findTagByName(name: string, db: ClockyDB = defaultDb): Promise<Tag | undefined> {
  const key = nameKey(name)
  return (await listTags(db)).find((t) => nameKey(t.name) === key)
}

/** Create a tag, or return the existing one with the same name (case-insensitive). */
export async function getOrCreateTag(name: string, db: ClockyDB = defaultDb): Promise<Tag> {
  const clean = name.trim()
  if (!clean) throw new ValidationError('A tag needs a name.')
  return db.transaction('rw', db.tags, async () => {
    const existing = await findTagByName(clean, db)
    if (existing) return existing
    const tag = touched<Tag>({ id: ulid(), updatedAt: 0, name: clean })
    await db.tags.add(tag)
    return tag
  })
}

export async function renameTag(id: string, name: string, db: ClockyDB = defaultDb): Promise<Tag> {
  const clean = name.trim()
  if (!clean) throw new ValidationError('A tag needs a name.')
  return db.transaction('rw', db.tags, async () => {
    const tag = await db.tags.get(id)
    if (!isLive(tag)) throw new ValidationError('That tag no longer exists.')
    const clash = await findTagByName(clean, db)
    if (clash && clash.id !== id) {
      throw new ValidationError(`There is already a tag called "${clash.name}". Merge them instead.`)
    }
    const saved = touched({ ...tag, name: clean })
    await db.tags.put(saved)
    return saved
  })
}

/** Entries are stored with tag ids, so rewrite every entry that uses `fromId`. */
async function replaceOnEntries(db: ClockyDB, fromId: string, toId: string | null): Promise<number> {
  const now = Date.now()
  const affected = await db.entries.filter((e) => e.tagIds.includes(fromId)).toArray()
  for (const e of affected) {
    const ids = e.tagIds.filter((t) => t !== fromId)
    if (toId && !ids.includes(toId)) ids.push(toId)
    await db.entries.put(touched({ ...e, tagIds: ids }, now))
  }
  return affected.length
}

/** Move every use of `fromId` onto `intoId`, then delete `fromId`. */
export async function mergeTags(fromId: string, intoId: string, db: ClockyDB = defaultDb): Promise<void> {
  if (fromId === intoId) return
  await db.transaction('rw', db.tags, db.entries, async () => {
    const [from, into] = await Promise.all([db.tags.get(fromId), db.tags.get(intoId)])
    if (!isLive(from) || !isLive(into)) throw new ValidationError('That tag no longer exists.')
    await replaceOnEntries(db, fromId, intoId)
    await db.tags.put(touched({ ...from, deleted: 1 }))
  })
}

/** Delete a tag and remove it from every entry. Kept as a tombstone for sync. */
export async function deleteTag(id: string, db: ClockyDB = defaultDb): Promise<void> {
  await db.transaction('rw', db.tags, db.entries, async () => {
    const tag = await db.tags.get(id)
    if (!isLive(tag)) return
    await replaceOnEntries(db, id, null)
    await db.tags.put(touched({ ...tag, deleted: 1 }))
  })
}

/** How many live entries use each tag. */
export async function tagUsage(db: ClockyDB = defaultDb): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  await db.entries.each((e) => {
    if (e.deleted) return
    for (const id of e.tagIds) counts.set(id, (counts.get(id) ?? 0) + 1)
  })
  return counts
}
