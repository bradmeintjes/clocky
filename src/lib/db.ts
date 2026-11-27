import Dexie, { type EntityTable } from 'dexie'
import type { Attachment, Entry, Meta, Project, StoredBlob, Tag } from './types'

export class ClockyDB extends Dexie {
  projects!: EntityTable<Project, 'id'>
  tags!: EntityTable<Tag, 'id'>
  entries!: EntityTable<Entry, 'id'>
  attachments!: EntityTable<Attachment, 'id'>
  blobs!: EntityTable<StoredBlob, 'id'>
  meta!: EntityTable<Meta, 'key'>

  constructor(name = 'clocky') {
    super(name)
    // Only indexed fields are listed. [projectId+start] also serves
    // "all entries for a project", so there is no separate projectId index.
    this.version(1).stores({
      projects: 'id, updatedAt',
      tags: 'id, updatedAt',
      entries: 'id, start, [projectId+start], end, updatedAt',
      attachments: 'id, entryId, updatedAt',
      blobs: 'id',
      meta: 'key',
    })
  }
}

export const db = new ClockyDB()
