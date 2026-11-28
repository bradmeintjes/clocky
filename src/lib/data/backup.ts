// One JSON file of all records (no attachment bytes), and restoring from it.
import { db as defaultDb, type ClockyDB } from '../db'
import { fromWire, remoteWins, TABLES, toWire, type AnyRecord, type Table } from '../sync/files'
import { ValidationError } from './projects'

export interface Backup {
  app: 'clocky'
  version: 1
  exportedAt: string
  data: Record<Table, unknown[]>
}

export async function makeBackup(db: ClockyDB = defaultDb, now = Date.now()): Promise<Backup> {
  const data = {} as Record<Table, unknown[]>
  for (const t of TABLES) {
    const rows = await db.table<AnyRecord, string>(t).toArray()
    data[t] = await Promise.all(rows.map((r) => toWire(t, r)))
  }
  return { app: 'clocky', version: 1, exportedAt: new Date(now).toISOString(), data }
}

/**
 * Merge a backup into this device: for each record the newer copy wins, so restoring
 * an old backup never overwrites newer work. Restored records are marked for sync.
 */
export async function restoreBackup(raw: unknown, db: ClockyDB = defaultDb): Promise<number> {
  const b = raw as Partial<Backup>
  if (!b || b.app !== 'clocky' || b.version !== 1 || typeof b.data !== 'object') {
    throw new ValidationError("That file isn't a Clocky backup.")
  }
  let n = 0
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      for (const w of (b.data![t] ?? []) as Record<string, unknown>[]) {
        if (typeof w?.id !== 'string' || typeof w.updatedAt !== 'number') continue
        const r = fromWire(t, w)
        const local = await db.table<AnyRecord, string>(t).get(r.id)
        if (remoteWins(local, r)) {
          await db.table<AnyRecord, string>(t).put({ ...r, dirty: 1 } as AnyRecord)
          n++
        }
      }
    }
  })
  return n
}
