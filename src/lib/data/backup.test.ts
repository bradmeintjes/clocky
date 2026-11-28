import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { ClockyDB } from '../db'
import { ulid } from '../ulid'
import { makeBackup, restoreBackup } from './backup'
import { addManualEntry, updateEntry } from './entries'
import { createProject } from './projects'

const T = Date.UTC(2026, 10, 27, 8, 0)

describe('backup', () => {
  it('round-trips into an empty device and keeps newer local work', async () => {
    const a = new ClockyDB('test-' + ulid())
    const p = await createProject({ name: 'Web', color: '#000' }, a)
    const e = await addManualEntry({ projectId: p.id, start: T, end: T + 3600e3, tz: 'UTC' }, a)
    const backup = JSON.parse(JSON.stringify(await makeBackup(a)))
    expect(backup.data.entries[0]).not.toHaveProperty('dirty')

    const b = new ClockyDB('test-' + ulid())
    expect(await restoreBackup(backup, b)).toBe(2)
    expect((await b.entries.get(e.id))?.dirty).toBe(1)

    await new Promise((r) => setTimeout(r, 5))
    await updateEntry(e.id, { task: 'Newer' }, a)
    expect(await restoreBackup(backup, a)).toBe(0)
    expect((await a.entries.get(e.id))?.task).toBe('Newer')
  })

  it('rejects other files', async () => {
    const b = new ClockyDB('test-' + ulid())
    await expect(restoreBackup({ foo: 1 }, b)).rejects.toThrow("isn't a Clocky backup")
  })
})
