import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { ClockyDB } from './db'
import { ulid } from './ulid'

describe('ClockyDB', () => {
  it('stores entries and finds them by project in start order', async () => {
    const db = new ClockyDB('test-' + ulid())
    const projectId = ulid()
    const base = { projectId, task: '', description: '', tagIds: [], breaks: [], tz: 'UTC', attachmentIds: [], updatedAt: 0 }
    await db.entries.bulkAdd([
      { ...base, id: ulid(), start: 2000, end: 3000 },
      { ...base, id: ulid(), start: 1000, end: 1500 },
      { ...base, id: ulid(), projectId: 'other', start: 500, end: 900 },
    ])
    const rows = await db.entries
      .where('[projectId+start]')
      .between([projectId, Dexie.minKey], [projectId, Dexie.maxKey])
      .toArray()
    expect(rows.map((r) => r.start)).toEqual([1000, 2000])
    db.close()
  })
})
