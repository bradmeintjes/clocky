import { db as defaultDb, type ClockyDB } from '../db'
import type { Attachment } from '../types'
import { ulid } from '../ulid'
import { ValidationError } from './projects'
import { isLive, touched } from './sync-fields'

/** Largest file accepted, per the plan (about 100 MB). */
export const MAX_FILE_BYTES = 100 * 1024 * 1024

export async function listAttachments(entryId: string, db: ClockyDB = defaultDb): Promise<Attachment[]> {
  const all = await db.attachments.where('entryId').equals(entryId).toArray()
  return all.filter(isLive).sort((a, b) => (a.id < b.id ? -1 : 1))
}

/** Turn what was typed into a link URL, or throw. Bare domains get https://. */
export function normaliseUrl(input: string): string {
  let s = input.trim()
  if (!s) throw new ValidationError('Enter a link.')
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s
  let u: URL
  try {
    u = new URL(s)
  } catch {
    throw new ValidationError("That doesn't look like a link.")
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new ValidationError('Links must start with http or https.')
  if (!u.hostname.includes('.') && u.hostname !== 'localhost') throw new ValidationError("That doesn't look like a link.")
  return u.href
}

/** A short readable name for a link: host plus path, without the scheme or www. */
export function linkName(url: string): string {
  const u = new URL(url)
  const path = (u.pathname + u.search).replace(/\/$/, '')
  const name = u.hostname.replace(/^www\./, '') + path
  return name.length > 60 ? name.slice(0, 57) + '…' : name
}

async function attach(entryId: string, att: Attachment, blob: Blob | null, db: ClockyDB): Promise<Attachment> {
  await db.transaction('rw', db.entries, db.attachments, db.blobs, async () => {
    const e = await db.entries.get(entryId)
    if (!isLive(e)) throw new ValidationError('That entry no longer exists.')
    await db.attachments.add(att)
    if (blob) await db.blobs.put({ id: att.id, data: blob })
    // Adding proof of work never makes an entry manual.
    await db.entries.put(touched({ ...e, attachmentIds: [...e.attachmentIds, att.id] }))
  })
  return att
}

export async function addLink(entryId: string, input: string, db: ClockyDB = defaultDb): Promise<Attachment> {
  const url = normaliseUrl(input)
  const att = touched<Attachment>({ id: ulid(), updatedAt: 0, entryId, kind: 'link', name: linkName(url), url })
  return attach(entryId, att, null, db)
}

export interface FileInput {
  file: Blob
  name: string
  kind: 'file' | 'photo'
  thumb?: Blob
}

export async function addFile(entryId: string, input: FileInput, db: ClockyDB = defaultDb): Promise<Attachment> {
  if (input.file.size > MAX_FILE_BYTES) {
    throw new ValidationError(`${input.name} is larger than 100 MB.`)
  }
  const att = touched<Attachment>({
    id: ulid(),
    updatedAt: 0,
    entryId,
    kind: input.kind,
    name: input.name || (input.kind === 'photo' ? 'Photo' : 'File'),
    mime: input.file.type || undefined,
    size: input.file.size,
    ...(input.thumb ? { thumb: input.thumb } : {}),
  })
  return attach(entryId, att, input.file, db)
}

/** Remove from the entry (tombstone). The bytes stay until cleanup so undo works. */
export async function removeAttachment(id: string, db: ClockyDB = defaultDb): Promise<void> {
  await db.transaction('rw', db.entries, db.attachments, async () => {
    const a = await db.attachments.get(id)
    if (!isLive(a)) return
    await db.attachments.put(touched({ ...a, deleted: 1 }))
    const e = await db.entries.get(a.entryId)
    if (e) await db.entries.put(touched({ ...e, attachmentIds: e.attachmentIds.filter((x) => x !== id) }))
  })
}

export async function restoreAttachment(id: string, db: ClockyDB = defaultDb): Promise<void> {
  await db.transaction('rw', db.entries, db.attachments, async () => {
    const a = await db.attachments.get(id)
    if (!a) return
    const next = { ...a }
    delete next.deleted
    await db.attachments.put(touched(next))
    const e = await db.entries.get(a.entryId)
    if (e && !e.attachmentIds.includes(id)) await db.entries.put(touched({ ...e, attachmentIds: [...e.attachmentIds, id] }))
  })
}

export async function getBlob(id: string, db: ClockyDB = defaultDb): Promise<Blob | undefined> {
  return (await db.blobs.get(id))?.data
}

export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
