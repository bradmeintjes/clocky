// How local records map to Drive files, and how files are encoded and merged.
import type { Attachment, Entry, Project, Synced, Tag } from '../types'

export type Table = 'projects' | 'tags' | 'entries' | 'attachments'
export const TABLES: Table[] = ['projects', 'tags', 'entries', 'attachments']

/** Wire form of an attachment: the thumbnail travels as a data URL. */
export type WireAttachment = Omit<Attachment, 'thumb' | 'dirty'> & { thumb?: string }
export type AnyRecord = Project | Tag | Entry | Attachment

export const ATTACHMENT_PREFIX = 'att-'

/** The Drive file a record belongs in. Entries are split by the UTC month they start in. */
export function fileFor(table: Table, record: AnyRecord): string {
  if (table === 'entries') return `entries-${new Date((record as Entry).start).toISOString().slice(0, 7)}.json.gz`
  return `${table}.json.gz`
}

/** The table a data file holds, or null for anything else (attachment bytes, unknown files). */
export function tableOf(name: string): Table | null {
  if (/^entries-\d{4}-\d{2}\.json\.gz$/.test(name)) return 'entries'
  const t = name.replace(/\.json\.gz$/, '')
  return name.endsWith('.json.gz') && (TABLES as string[]).includes(t) ? (t as Table) : null
}

/** True when `remote` should replace `local`: newer wins, a missing local always loses. */
export function remoteWins(local: Synced | undefined, remote: Synced): boolean {
  return !local || remote.updatedAt > local.updatedAt
}

async function pipe(data: BufferSource | Blob, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const blob = data instanceof Blob ? data : new Blob([data])
  return new Uint8Array(await new Response(blob.stream().pipeThrough(stream)).arrayBuffer())
}

export async function gzipJson(value: unknown): Promise<Uint8Array<ArrayBuffer>> {
  return pipe(new TextEncoder().encode(JSON.stringify(value)), new CompressionStream('gzip'))
}

export async function gunzipJson<T>(data: BufferSource | Blob): Promise<T> {
  return JSON.parse(new TextDecoder().decode(await pipe(data, new DecompressionStream('gzip')))) as T
}

async function blobToDataUrl(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${b.type || 'image/jpeg'};base64,${btoa(bin)}`
}

function dataUrlToBlob(url: string): Blob {
  const [head, b64] = url.split(',')
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/** Strip local-only fields before upload. */
export async function toWire(table: Table, r: AnyRecord): Promise<unknown> {
  const { dirty: _dirty, ...rest } = r as AnyRecord & { dirty?: 1 }
  if (table === 'attachments') {
    const a = rest as Attachment
    const { thumb, ...plain } = a
    return thumb ? { ...plain, thumb: await blobToDataUrl(thumb) } : plain
  }
  return rest
}

export function fromWire(table: Table, w: Record<string, unknown>): AnyRecord {
  const r = { ...w }
  delete r.dirty
  if (table === 'attachments' && typeof r.thumb === 'string') r.thumb = dataUrlToBlob(r.thumb)
  return r as unknown as AnyRecord
}
