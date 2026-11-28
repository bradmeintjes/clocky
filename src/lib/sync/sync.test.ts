import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { ClockyDB } from '../db'
import { addFile, addLink } from '../data/attachments'
import { addManualEntry, deleteEntry, updateEntry } from '../data/entries'
import { createProject } from '../data/projects'
import { DAY } from '../time'
import { ulid } from '../ulid'
import { FakeDrive } from './fake-drive'
import { fileFor, gunzipJson, gzipJson, tableOf } from './files'
import { pendingCount, resetSyncState, syncOnce } from './engine'

let db: ClockyDB
let drive: FakeDrive
const T = Date.UTC(2026, 10, 27, 8, 0)

beforeEach(() => {
  db = new ClockyDB('test-' + ulid())
  drive = new FakeDrive()
})

async function fileRecords(name: string) {
  return gunzipJson<Record<string, unknown>[]>(drive.byName(name)!.data)
}

describe('files', () => {
  it('maps records to files and back', () => {
    expect(fileFor('entries', { start: T } as never)).toBe('entries-2026-11.json.gz')
    expect(fileFor('projects', {} as never)).toBe('projects.json.gz')
    expect(tableOf('entries-2026-11.json.gz')).toBe('entries')
    expect(tableOf('tags.json.gz')).toBe('tags')
    expect(tableOf('att-01ABC')).toBeNull()
    expect(tableOf('other.json.gz')).toBeNull()
  })

  it('round-trips gzip json', async () => {
    expect(await gunzipJson(await gzipJson([{ a: 1, b: 'é' }]))).toEqual([{ a: 1, b: 'é' }])
  })
})

describe('sync', () => {
  it('first sync uploads everything and clears dirty, without local-only fields', async () => {
    const p = await createProject({ name: 'Web', color: '#000' }, db)
    await addManualEntry({ projectId: p.id, start: T, end: T + 3600e3, tz: 'UTC' }, db)
    await addManualEntry({ projectId: p.id, start: T - 40 * DAY, end: T - 40 * DAY + 3600e3, tz: 'UTC' }, db)
    expect(await pendingCount(db)).toBe(3)

    await syncOnce(db, drive, { now: T })
    const names = [...drive.files.values()].map((f) => f.meta.name).sort()
    expect(names).toEqual(['entries-2026-10.json.gz', 'entries-2026-11.json.gz', 'projects.json.gz'])
    expect(await pendingCount(db)).toBe(0)
    const [wp] = await fileRecords('projects.json.gz')
    expect(wp).toMatchObject({ id: p.id, name: 'Web' })
    expect(wp).not.toHaveProperty('dirty')
  })

  it('only re-uploads files with changes, and skips unchanged downloads', async () => {
    const p = await createProject({ name: 'Web', color: '#000' }, db)
    const e = await addManualEntry({ projectId: p.id, start: T, end: T + 3600e3, tz: 'UTC' }, db)
    await syncOnce(db, drive, { now: T })
    drive.calls = []
    await updateEntry(e.id, { task: 'Header' }, db)
    await syncOnce(db, drive, { now: T })
    expect(drive.calls.filter((c) => c.startsWith('put'))).toEqual(['put entries-2026-11.json.gz'])
    expect(drive.calls.filter((c) => c.startsWith('download'))).toEqual([])
    expect((await fileRecords('entries-2026-11.json.gz'))[0]).toMatchObject({ task: 'Header' })
  })

  it('pulls newer records from another device and keeps newer local ones', async () => {
    // Device A
    const p = await createProject({ name: 'Web', color: '#000' }, db)
    const e = await addManualEntry({ projectId: p.id, start: T, end: T + 3600e3, tz: 'UTC' }, db)
    await syncOnce(db, drive, { now: T })
    // Device B starts from Drive
    const b = new ClockyDB('test-' + ulid())
    await syncOnce(b, drive, { now: T })
    expect((await b.entries.get(e.id))?.projectId).toBe(p.id)
    expect(await pendingCount(b)).toBe(0)
    // B edits, then A syncs
    await new Promise((r) => setTimeout(r, 5))
    await updateEntry(e.id, { task: 'From B' }, b)
    await syncOnce(b, drive, { now: T })
    await syncOnce(db, drive, { now: T })
    expect((await db.entries.get(e.id))?.task).toBe('From B')
    expect((await db.entries.get(e.id))?.dirty).toBeUndefined()
  })

  it('syncs tombstones', async () => {
    const p = await createProject({ name: 'Web', color: '#000' }, db)
    const e = await addManualEntry({ projectId: p.id, start: T, end: T + 3600e3, tz: 'UTC' }, db)
    await syncOnce(db, drive, { now: T })
    await deleteEntry(e.id, db)
    await syncOnce(db, drive, { now: T })
    expect((await fileRecords('entries-2026-11.json.gz'))[0]).toMatchObject({ id: e.id, deleted: 1 })
  })

  it('uploads attachment bytes and records their Drive id in the same sync', async () => {
    const p = await createProject({ name: 'Web', color: '#000' }, db)
    const e = await addManualEntry({ projectId: p.id, start: T, end: T + 3600e3, tz: 'UTC' }, db)
    await addLink(e.id, 'github.com', db)
    const f = await addFile(e.id, { file: new Blob(['bytes']), name: 'a.bin', kind: 'photo', thumb: new Blob(['th'], { type: 'image/jpeg' }) }, db)
    const progress: number[] = []
    const res = await syncOnce(db, drive, { now: T, onUpload: (_id, sent) => progress.push(sent) })
    expect(res.uploaded).toBe(1)
    expect(progress).toEqual([5])
    const att = drive.byName('att-' + f.id)!
    expect(await att.data.text()).toBe('bytes')
    const local = await db.attachments.get(f.id)
    expect(local?.driveFileId).toBe(att.meta.id)
    expect(local?.dirty).toBeUndefined()
    const wire = await fileRecords('attachments.json.gz')
    const w = wire.find((x) => x.id === f.id)!
    expect(w.driveFileId).toBe(att.meta.id)
    expect(String(w.thumb)).toMatch(/^data:image\/jpeg;base64,/)
    // Another device gets the thumbnail back as a Blob.
    const b = new ClockyDB('test-' + ulid())
    await syncOnce(b, drive, { now: T })
    const thumb = (await b.attachments.get(f.id))!.thumb!
    expect(thumb).toBeInstanceOf(Blob)
    expect(await thumb.text()).toBe('th')
  })

  it('purges old synced tombstones', async () => {
    const p = await createProject({ name: 'Web', color: '#000' }, db)
    const e = await addManualEntry({ projectId: p.id, start: T, end: T + 3600e3, tz: 'UTC' }, db)
    await deleteEntry(e.id, db)
    await syncOnce(db, drive, { now: Date.now() })
    expect(await db.entries.get(e.id)).toBeDefined()
    await syncOnce(db, drive, { now: Date.now() + 91 * DAY })
    expect(await db.entries.get(e.id)).toBeUndefined()
  })

  it('re-uploads everything after a reset (connect again)', async () => {
    await createProject({ name: 'Web', color: '#000' }, db)
    await syncOnce(db, drive, { now: T })
    drive.files.clear()
    await resetSyncState(db)
    await syncOnce(db, drive, { now: T })
    expect(drive.byName('projects.json.gz')).toBeDefined()
  })
})
