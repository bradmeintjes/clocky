import { db as defaultDb, type ClockyDB } from '../db'
import type { Entry } from '../types'
import { ulid } from '../ulid'
import { localZone } from '../zone'
import { ValidationError } from './projects'
import { isLive, touched } from './sync-fields'

export type Break = [number, number | null]

/** The one entry with no end, if any. It is nearly always the latest by start. */
export async function getRunning(db: ClockyDB = defaultDb): Promise<Entry | undefined> {
  return db.entries
    .orderBy('start')
    .reverse()
    .filter((e) => e.end === null && !e.deleted)
    .first()
}

export function isPaused(e: Pick<Entry, 'breaks'>): boolean {
  const last = e.breaks[e.breaks.length - 1]
  return !!last && last[1] === null
}

/** Latest start or resume, which is what the long-timer nudge measures from. */
export function lastResume(e: Pick<Entry, 'start' | 'breaks'>): number {
  const ends = e.breaks.map((b) => b[1]).filter((t): t is number => t !== null)
  return Math.max(e.start, ...ends)
}

function closeOut(e: Entry, now: number): Entry {
  const breaks = e.breaks.map(([s, end]): Break => [s, end ?? now])
  return touched({ ...e, breaks, end: now }, now)
}

export interface EntryFields {
  projectId: string
  task?: string
  description?: string
  tagIds?: string[]
}

/** Start a timer. Any running timer is stopped first, at the same instant. */
export async function startTimer(
  fields: EntryFields,
  now = Date.now(),
  db: ClockyDB = defaultDb,
): Promise<{ started: Entry; stopped?: Entry }> {
  return db.transaction('rw', db.entries, async () => {
    const running = await getRunning(db)
    const stopped = running ? closeOut(running, now) : undefined
    if (stopped) await db.entries.put(stopped)
    const started = touched<Entry>(
      {
        id: ulid(now),
        updatedAt: 0,
        projectId: fields.projectId,
        task: fields.task?.trim() ?? '',
        description: fields.description ?? '',
        tagIds: [...(fields.tagIds ?? [])], // copy: callers may pass reactive proxies
        start: now,
        end: null,
        breaks: [],
        tz: localZone(),
        attachmentIds: [],
      },
      now,
    )
    await db.entries.add(started)
    return { started, stopped }
  })
}

async function withRunning(db: ClockyDB, fn: (e: Entry) => Entry | null): Promise<Entry | undefined> {
  return db.transaction('rw', db.entries, async () => {
    const e = await getRunning(db)
    if (!e) return undefined
    const next = fn(e)
    if (!next) return e
    await db.entries.put(next)
    return next
  })
}

/** Start a break on the running timer. */
export function pauseTimer(now = Date.now(), db: ClockyDB = defaultDb) {
  return withRunning(db, (e) => (isPaused(e) ? null : touched({ ...e, breaks: [...e.breaks, [now, null] as Break] }, now)))
}

/** End the current break on the running timer. */
export function resumeTimer(now = Date.now(), db: ClockyDB = defaultDb) {
  return withRunning(db, (e) => {
    if (!isPaused(e)) return null
    const breaks = e.breaks.slice()
    breaks[breaks.length - 1] = [breaks[breaks.length - 1][0], now]
    return touched({ ...e, breaks }, now)
  })
}

/** Stop the running timer. An open break ends at the same time. */
export function stopTimer(now = Date.now(), db: ClockyDB = defaultDb) {
  return withRunning(db, (e) => closeOut(e, now))
}

/** Check start, end and breaks make sense. Throws ValidationError with a readable message. */
export function validateTimes(start: number, end: number | null, breaks: Break[], now = Date.now()): void {
  if (!Number.isFinite(start)) throw new ValidationError('Enter a valid start time.')
  if (end !== null && end <= start) throw new ValidationError('The end time must be after the start.')
  if (end === null && start > now) throw new ValidationError("A running timer can't start in the future.")
  const limit = end ?? now
  const sorted = breaks.slice().sort((a, b) => a[0] - b[0])
  let prev = start
  for (const [s, e] of sorted) {
    if (s < start || s > limit) throw new ValidationError('Each break must fall within the entry.')
    if (e !== null && (e <= s || e > limit)) throw new ValidationError('Each break must end after it starts, within the entry.')
    if (s < prev) throw new ValidationError("Breaks can't overlap.")
    prev = e ?? limit
  }
  const open = breaks.filter((b) => b[1] === null)
  if (open.length > (end === null ? 1 : 0)) throw new ValidationError('Only a running timer can have an open break.')
}

export interface ManualEntry extends EntryFields {
  start: number
  end: number
  breaks?: Break[]
  tz?: string
}

/** Add time by hand. Always flagged manual. */
export async function addManualEntry(input: ManualEntry, db: ClockyDB = defaultDb): Promise<Entry> {
  const breaks = (input.breaks ?? []).slice().sort((a, b) => a[0] - b[0])
  validateTimes(input.start, input.end, breaks)
  const entry = touched<Entry>({
    id: ulid(),
    updatedAt: 0,
    projectId: input.projectId,
    task: input.task?.trim() ?? '',
    description: input.description ?? '',
    tagIds: [...(input.tagIds ?? [])],
    start: input.start,
    end: input.end,
    breaks,
    tz: input.tz ?? localZone(),
    manual: 1,
    attachmentIds: [],
  })
  await db.entries.add(entry)
  return entry
}

export type EntryChanges = Partial<Pick<Entry, 'projectId' | 'task' | 'description' | 'tagIds' | 'start' | 'end' | 'breaks'>>

function sameBreaks(a: Break[], b: Break[]): boolean {
  return a.length === b.length && a.every((x, i) => x[0] === b[i][0] && x[1] === b[i][1])
}

/**
 * Update an entry. Changing start, end or any break sets the manual flag;
 * task, description, tags and project do not.
 */
export async function updateEntry(id: string, changes: EntryChanges, db: ClockyDB = defaultDb): Promise<Entry> {
  return db.transaction('rw', db.entries, async () => {
    const cur = await db.entries.get(id)
    if (!isLive(cur)) throw new ValidationError('That entry no longer exists.')
    const next: Entry = { ...cur, ...changes }
    if (changes.task !== undefined) next.task = changes.task.trim()
    // Plain copies, since callers may pass reactive proxies that IndexedDB can't clone.
    next.tagIds = [...next.tagIds]
    next.breaks = next.breaks.map(([a, b]): Break => [a, b]).sort((a, b) => a[0] - b[0])
    if (cur.end === null && changes.end !== undefined && changes.end !== null) {
      throw new ValidationError('Stop the timer to set an end time.')
    }
    const timesChanged = next.start !== cur.start || next.end !== cur.end || !sameBreaks(next.breaks, cur.breaks)
    if (timesChanged) {
      validateTimes(next.start, next.end, next.breaks)
      next.manual = 1
    }
    const saved = touched(next)
    await db.entries.put(saved)
    return saved
  })
}

/** Soft-delete (tombstone). Returns the entry so it can be restored. */
export async function deleteEntry(id: string, db: ClockyDB = defaultDb): Promise<Entry | undefined> {
  return db.transaction('rw', db.entries, async () => {
    const cur = await db.entries.get(id)
    if (!isLive(cur)) return undefined
    await db.entries.put(touched({ ...cur, deleted: 1 }))
    return cur
  })
}

export async function restoreEntry(id: string, db: ClockyDB = defaultDb): Promise<void> {
  await db.transaction('rw', db.entries, async () => {
    const cur = await db.entries.get(id)
    if (!cur) return
    const next = { ...cur }
    delete next.deleted
    await db.entries.put(touched(next))
  })
}
