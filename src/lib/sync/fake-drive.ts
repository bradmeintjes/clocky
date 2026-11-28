// In-memory Drive for tests.
import type { Drive, DriveFile } from './drive'

export class FakeDrive implements Drive {
  files = new Map<string, { meta: DriveFile; data: Blob }>()
  private n = 0
  private clock = 0
  calls: string[] = []

  private stamp() {
    return new Date(Date.UTC(2026, 0, 1) + ++this.clock * 1000).toISOString()
  }

  async list() {
    this.calls.push('list')
    return [...this.files.values()].map((f) => f.meta)
  }

  async download(id: string) {
    this.calls.push('download ' + this.files.get(id)!.meta.name)
    return this.files.get(id)!.data
  }

  async put(name: string, data: Blob, id?: string) {
    this.calls.push('put ' + name)
    const fid = id && this.files.has(id) ? id : 'f' + ++this.n
    const meta = { id: fid, name, modifiedTime: this.stamp(), size: String(data.size) }
    this.files.set(fid, { meta, data })
    return meta
  }

  async upload(name: string, data: Blob, onProgress?: (sent: number) => void) {
    this.calls.push('upload ' + name)
    onProgress?.(data.size)
    return this.put(name, data)
  }

  async remove(id: string) {
    this.calls.push('remove ' + id)
    this.files.delete(id)
  }

  byName(name: string) {
    return [...this.files.values()].find((f) => f.meta.name === name)
  }
}
