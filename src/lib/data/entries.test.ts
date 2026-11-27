import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { ClockyDB } from '../db'
import { HOUR, MIN, workedMs } from '../time'
import { ulid } from '../ulid'
import {
  addManualEntry, deleteEntry, getRunning, isPaused, lastResume, pauseTimer, restoreEntry,
  resumeTimer, startTimer, stopTimer, updateEntry, validateTimes,
} from './entries'

let db: ClockyDB
const T = Date.UTC(2026, 10, 27, 8, 0)

beforeEach(() => {
  db = new ClockyDB('test-' + ulid())
})

describe('timer', () => {
  it('starts, pauses, resumes and stops', async () => {
    const { started } = await startTimer({ projectId: 'p', task: ' Header ' }, T, db)
    expect(started).toMatchObject({ task: 'Header', end: null, dirty: 1 })
    expect((await getRunning(db))?.id).toBe(started.id)

    await pauseTimer(T + HOUR, db)
    expect(isPaused((await getRunning(db))!)).toBe(true)
    await pauseTimer(T + HOUR + 5 * MIN, db) // second pause is ignored
    await resumeTimer(T + HOUR + 30 * MIN, db)
    const stopped = await stopTimer(T + 3 * HOUR, db)

    expect(stopped!.breaks).toEqual([[T + HOUR, T + HOUR + 30 * MIN]])
    expect(workedMs(stopped!)).toBe(2.5 * HOUR)
    expect(stopped!.manual).toBeUndefined()
    expect(await getRunning(db)).toBeUndefined()
  })

  it('stopping while paused closes the break at the stop time', async () => {
    await startTimer({ projectId: 'p' }, T, db)
    await pauseTimer(T + HOUR, db)
    const e = await stopTimer(T + 2 * HOUR, db)
    expect(e!.breaks).toEqual([[T + HOUR, T + 2 * HOUR]])
    expect(workedMs(e!)).toBe(HOUR)
  })

  it('starting a new timer stops the running one at the same instant', async () => {
    const a = await startTimer({ projectId: 'a' }, T, db)
    const b = await startTimer({ projectId: 'b' }, T + HOUR, db)
    expect(b.stopped?.id).toBe(a.started.id)
    expect((await db.entries.get(a.started.id))!.end).toBe(T + HOUR)
    expect((await getRunning(db))!.projectId).toBe('b')
  })

  it('measures the nudge from the latest start or resume', () => {
    expect(lastResume({ start: T, breaks: [] })).toBe(T)
    expect(lastResume({ start: T, breaks: [[T + HOUR, T + 2 * HOUR], [T + 3 * HOUR, null]] })).toBe(T + 2 * HOUR)
  })
})

describe('manual entries and edits', () => {
  it('adds a manual entry', async () => {
    const e = await addManualEntry({ projectId: 'p', start: T, end: T + HOUR, tz: 'UTC' }, db)
    expect(e.manual).toBe(1)
    expect(e.tz).toBe('UTC')
  })

  it('rejects bad times', async () => {
    await expect(addManualEntry({ projectId: 'p', start: T, end: T }, db)).rejects.toThrow(/after the start/)
    expect(() => validateTimes(T, T + HOUR, [[T - MIN, T + MIN]])).toThrow(/within/)
    expect(() => validateTimes(T, T + HOUR, [[T + 10 * MIN, T + 5 * MIN]])).toThrow(/after it starts/)
    expect(() => validateTimes(T, T + HOUR, [[T + 10 * MIN, T + 30 * MIN], [T + 20 * MIN, T + 40 * MIN]])).toThrow(/overlap/)
    expect(() => validateTimes(T, T + HOUR, [[T + 10 * MIN, null]])).toThrow(/open break/)
    expect(() => validateTimes(T + HOUR, null, [], T)).toThrow(/future/)
  })

  it('flags manual only when times change', async () => {
    const { started } = await startTimer({ projectId: 'p' }, T, db)
    const e = (await stopTimer(T + HOUR, db))!
    let saved = await updateEntry(e.id, { task: 'Docs', description: 'x', tagIds: ['t'], projectId: 'q' }, db)
    expect(saved.manual).toBeUndefined()
    saved = await updateEntry(started.id, { end: T + 2 * HOUR }, db)
    expect(saved.manual).toBe(1)
  })

  it('flags manual when a break is edited', async () => {
    await startTimer({ projectId: 'p' }, T, db)
    await pauseTimer(T + 10 * MIN, db)
    await resumeTimer(T + 20 * MIN, db)
    const e = (await stopTimer(T + HOUR, db))!
    const saved = await updateEntry(e.id, { breaks: [[T + 10 * MIN, T + 25 * MIN]] }, db)
    expect(saved.manual).toBe(1)
    expect(workedMs(saved)).toBe(45 * MIN)
  })

  it('lets you move the start of a running timer but not end it by editing', async () => {
    const { started } = await startTimer({ projectId: 'p' }, T, db)
    const moved = await updateEntry(started.id, { start: T - 30 * MIN }, db)
    expect(moved).toMatchObject({ start: T - 30 * MIN, end: null, manual: 1 })
    await expect(updateEntry(started.id, { end: T + HOUR }, db)).rejects.toThrow(/Stop the timer/)
  })

  it('deletes and restores', async () => {
    const e = await addManualEntry({ projectId: 'p', start: T, end: T + HOUR }, db)
    await deleteEntry(e.id, db)
    expect((await db.entries.get(e.id))!.deleted).toBe(1)
    await restoreEntry(e.id, db)
    expect((await db.entries.get(e.id))!.deleted).toBeUndefined()
  })
})
