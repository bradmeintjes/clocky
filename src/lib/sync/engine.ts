// Sync with Drive's hidden app folder: pull changed files, push files with local
// changes, upload attachment bytes. Newer updatedAt wins, per record.
import type { ClockyDB } from '../db'
import { touched } from '../data/sync-fields'
import type { Attachment, Synced } from '../types'
import { DAY } from '../time'
import type { Drive, DriveFile } from './drive'
import { ATTACHMENT_PREFIX, fileFor, fromWire, gunzipJson, gzipJson, remoteWins, tableOf, TABLES, toWire, type AnyRecord, type Table } from './files'

export type KnownFiles = Record<string, { id: string; modifiedTime: string }>

export const META_FILES = 'sync.files'
export const META_LAST = 'sync.lastSync'
const TOMBSTONE_TTL = 90 * DAY

export interface SyncResult {
  pulled: number // records taken from Drive
  pushedFiles: number
  uploaded: number // attachment files
}

export interface SyncOptions {
  now?: number
  onUpload?: (attachmentId: string, sent: number, total: number) => void
}

async function getMeta<T>(db: ClockyDB, key: string, fallback: T): Promise<T> {
  return ((await db.meta.get(key))?.value as T) ?? fallback
}

const table = (db: ClockyDB, t: Table) => db.table<AnyRecord, string>(t)

/** Most recent file per name (Drive allows duplicates). */
function byName(files: DriveFile[]): Map<string, DriveFile> {
  const m = new Map<string, DriveFile>()
  for (const f of files) {
    const cur = m.get(f.name)
    if (!cur || f.modifiedTime > cur.modifiedTime) m.set(f.name, f)
  }
  return m
}

export async function pull(db: ClockyDB, drive: Drive, remote: Map<string, DriveFile>, known: KnownFiles): Promise<number> {
  let taken = 0
  for (const f of remote.values()) {
    const t = tableOf(f.name)
    if (!t || known[f.name]?.modifiedTime === f.modifiedTime) continue
    const wire = await gunzipJson<Record<string, unknown>[]>(await drive.download(f.id))
    const incoming = wire.map((w) => fromWire(t, w))
    await db.transaction('rw', table(db, t), async () => {
      for (const r of incoming) {
        const local = await table(db, t).get(r.id)
        if (remoteWins(local, r)) {
          await table(db, t).put(r)
          taken++
        }
      }
    })
    known[f.name] = { id: f.id, modifiedTime: f.modifiedTime }
  }
  return taken
}

export async function push(db: ClockyDB, drive: Drive, known: KnownFiles): Promise<number> {
  let files = 0
  for (const t of TABLES) {
    const all = await table(db, t).toArray()
    const groups = new Map<string, AnyRecord[]>()
    for (const r of all) {
      const name = fileFor(t, r)
      if (!groups.has(name)) groups.set(name, [])
      groups.get(name)!.push(r)
    }
    for (const [name, records] of groups) {
      // Upload a file when something in it changed, or when Drive doesn't have it yet.
      if (known[name] && !records.some((r) => r.dirty)) continue
      const wire = await Promise.all(records.map((r) => toWire(t, r)))
      const body = new Blob([await gzipJson(wire)], { type: 'application/gzip' })
      const f = await drive.put(name, body, known[name]?.id)
      known[name] = { id: f.id, modifiedTime: f.modifiedTime }
      files++
      // Clear dirty only on records that didn't change while uploading.
      await db.transaction('rw', table(db, t), async () => {
        for (const sent of records) {
          if (!sent.dirty) continue
          const cur = await table(db, t).get(sent.id)
          if (cur && cur.updatedAt === sent.updatedAt) {
            const clean = { ...cur } as Synced
            delete clean.dirty
            await table(db, t).put(clean as AnyRecord)
          }
        }
      })
    }
  }
  return files
}

export async function uploadAttachments(db: ClockyDB, drive: Drive, remote: Map<string, DriveFile>, opts: SyncOptions = {}): Promise<number> {
  const waiting = (await db.attachments.toArray()).filter((a) => !a.deleted && a.kind !== 'link' && !a.driveFileId)
  let n = 0
  for (const a of waiting) {
    const name = ATTACHMENT_PREFIX + a.id
    let f = remote.get(name) // uploaded before, but the record update didn't land
    if (!f) {
      const blob = (await db.blobs.get(a.id))?.data
      if (!blob) continue
      f = await drive.upload(name, blob, (sent) => opts.onUpload?.(a.id, sent, blob.size))
      n++
    }
    const id = f.id
    await db.transaction('rw', db.attachments, async () => {
      const cur = await db.attachments.get(a.id)
      if (cur && !cur.driveFileId) await db.attachments.put(touched<Attachment>({ ...cur, driveFileId: id }))
    })
  }
  return n
}

/** Drop tombstones that have been synced and are older than 90 days, with their bytes. */
export async function purgeTombstones(db: ClockyDB, drive: Drive, now: number): Promise<void> {
  const cutoff = now - TOMBSTONE_TTL
  for (const t of TABLES) {
    const old = (await table(db, t).toArray()).filter((r) => r.deleted && !r.dirty && r.updatedAt < cutoff)
    for (const r of old) {
      if (t === 'attachments') {
        const a = r as Attachment
        if (a.driveFileId) await drive.remove(a.driveFileId).catch(() => {})
        await db.blobs.delete(a.id)
      }
      await table(db, t).delete(r.id)
    }
  }
}

export async function syncOnce(db: ClockyDB, drive: Drive, opts: SyncOptions = {}): Promise<SyncResult> {
  const now = opts.now ?? Date.now()
  const known = { ...(await getMeta<KnownFiles>(db, META_FILES, {})) }
  const save = () => db.meta.put({ key: META_FILES, value: known })
  try {
    const remote = byName(await drive.list())
    // A file deleted on Drive is uploaded again from local data.
    for (const name of Object.keys(known)) if (!remote.has(name)) delete known[name]
    const pulled = await pull(db, drive, remote, known)
    let pushedFiles = await push(db, drive, known)
    const uploaded = await uploadAttachments(db, drive, remote, opts)
    pushedFiles += await push(db, drive, known) // carries new driveFileIds
    await purgeTombstones(db, drive, now)
    await db.meta.put({ key: META_LAST, value: now })
    return { pulled, pushedFiles, uploaded }
  } finally {
    await save()
  }
}

/** Forget what was synced, so the next connect starts fresh. Local data is kept. */
export async function resetSyncState(db: ClockyDB): Promise<void> {
  await db.meta.bulkDelete([META_FILES, META_LAST])
}

/** Count of local changes not yet on Drive. */
export async function pendingCount(db: ClockyDB): Promise<number> {
  let n = 0
  for (const t of TABLES) n += await table(db, t).filter((r) => !!r.dirty).count()
  return n
}
