// Data model from docs/PLAN.md section 3.

export interface Synced {
  id: string // ULID
  updatedAt: number // ms since epoch, set on every local change
  deleted?: 1 // tombstone; hidden but kept for sync
  dirty?: 1 // changed locally since the last push (local only, never synced)
}

export interface Project extends Synced {
  name: string
  color: string
  archived?: 1
}

export interface Tag extends Synced {
  name: string
}

export interface Entry extends Synced {
  projectId: string
  task: string
  description: string
  tagIds: string[]
  start: number
  end: number | null // null while the timer runs
  breaks: [number, number | null][]
  tz: string // IANA zone at start
  manual?: 1
  attachmentIds: string[]
}

export interface Attachment extends Synced {
  entryId: string
  kind: 'link' | 'file' | 'photo'
  name: string
  url?: string
  mime?: string
  size?: number
  driveFileId?: string
  thumb?: Blob
}

/** Attachment bytes, local only. */
export interface StoredBlob {
  id: string // attachment id
  data: Blob
}

/** Local-only key/value store for settings and sync state. */
export interface Meta {
  key: string
  value: unknown
}
