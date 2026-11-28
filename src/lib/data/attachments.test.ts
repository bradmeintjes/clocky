import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { ClockyDB } from '../db'
import { ulid } from '../ulid'
import { addFile, addLink, getBlob, linkName, listAttachments, MAX_FILE_BYTES, normaliseUrl, removeAttachment, restoreAttachment } from './attachments'
import { addManualEntry, deleteEntry } from './entries'

let db: ClockyDB
const T = Date.UTC(2026, 10, 27, 8, 0)
let entryId: string

beforeEach(async () => {
  db = new ClockyDB('test-' + ulid())
  entryId = (await addManualEntry({ projectId: 'p', start: T, end: T + 3600e3, tz: 'UTC' }, db)).id
})

describe('links', () => {
  it('normalises urls', () => {
    expect(normaliseUrl(' github.com/a/b ')).toBe('https://github.com/a/b')
    expect(normaliseUrl('http://x.io')).toBe('http://x.io/')
    expect(() => normaliseUrl('')).toThrow()
    expect(() => normaliseUrl('javascript:alert(1)')).toThrow()
    expect(() => normaliseUrl('not a link')).toThrow()
  })

  it('names links by host and path', () => {
    expect(linkName('https://www.figma.com/file/abc/')).toBe('figma.com/file/abc')
    expect(linkName('https://github.com/')).toBe('github.com')
  })

  it('adds a link without touching the manual flag or times', async () => {
    const before = await db.entries.get(entryId)
    const a = await addLink(entryId, 'github.com/o/r/pull/1', db)
    expect(a).toMatchObject({ kind: 'link', url: 'https://github.com/o/r/pull/1', name: 'github.com/o/r/pull/1', dirty: 1 })
    const e = await db.entries.get(entryId)
    expect(e!.attachmentIds).toEqual([a.id])
    expect(e!.start).toBe(before!.start)
    expect(await listAttachments(entryId, db)).toHaveLength(1)
  })
})

describe('files', () => {
  it('stores bytes separately from the record', async () => {
    const file = new Blob(['hello'], { type: 'text/plain' })
    const a = await addFile(entryId, { file, name: 'notes.txt', kind: 'file' }, db)
    expect(a).toMatchObject({ kind: 'file', name: 'notes.txt', mime: 'text/plain', size: 5 })
    expect((await db.attachments.get(a.id)) as object).not.toHaveProperty('data')
    expect(await (await getBlob(a.id, db))!.text()).toBe('hello')
  })

  it('rejects files over 100 MB', async () => {
    const big = { size: MAX_FILE_BYTES + 1, type: '' } as Blob
    await expect(addFile(entryId, { file: big, name: 'huge.mov', kind: 'file' }, db)).rejects.toThrow('larger than 100 MB')
    expect(await listAttachments(entryId, db)).toHaveLength(0)
  })

  it('removes and restores', async () => {
    const a = await addFile(entryId, { file: new Blob(['x']), name: 'a.bin', kind: 'file' }, db)
    await removeAttachment(a.id, db)
    expect(await listAttachments(entryId, db)).toHaveLength(0)
    expect((await db.entries.get(entryId))!.attachmentIds).toEqual([])
    expect(await getBlob(a.id, db)).toBeDefined() // kept for undo
    await restoreAttachment(a.id, db)
    expect(await listAttachments(entryId, db)).toHaveLength(1)
    expect((await db.entries.get(entryId))!.attachmentIds).toEqual([a.id])
  })

  it('refuses to attach to a deleted entry', async () => {
    await deleteEntry(entryId, db)
    await expect(addLink(entryId, 'x.com', db)).rejects.toThrow()
  })
})
