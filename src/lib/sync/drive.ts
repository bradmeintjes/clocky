// Minimal Drive v3 client for the hidden app folder. The token comes from a callback,
// so a refreshed token is picked up without rebuilding the client.

export interface DriveFile {
  id: string
  name: string
  modifiedTime: string
  size?: string
}

export interface Drive {
  list(): Promise<DriveFile[]>
  download(id: string): Promise<Blob>
  /** Create (no id) or replace the contents of a small file. */
  put(name: string, data: Blob, id?: string): Promise<DriveFile>
  /** Upload a large file with a resumable session. */
  upload(name: string, data: Blob, onProgress?: (sent: number) => void): Promise<DriveFile>
  remove(id: string): Promise<void>
}

export class AuthError extends Error {}

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const FIELDS = 'id,name,modifiedTime,size'
const CHUNK = 8 * 1024 * 1024 // multiple of 256 KiB, as Drive requires

export class GoogleDrive implements Drive {
  constructor(private token: () => Promise<string>) {}

  private async req(url: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${await this.token()}` } })
    if (res.status === 401) throw new AuthError('Google sign-in expired')
    if (!res.ok && res.status !== 308) throw new Error(`Drive ${res.status}: ${(await res.text()).slice(0, 200)}`)
    return res
  }

  async list(): Promise<DriveFile[]> {
    const out: DriveFile[] = []
    let page = ''
    do {
      const q = new URLSearchParams({ spaces: 'appDataFolder', fields: `nextPageToken,files(${FIELDS})`, pageSize: '1000' })
      if (page) q.set('pageToken', page)
      const body = await (await this.req(`${API}/files?${q}`)).json()
      out.push(...body.files)
      page = body.nextPageToken ?? ''
    } while (page)
    return out
  }

  async download(id: string): Promise<Blob> {
    return (await this.req(`${API}/files/${id}?alt=media`)).blob()
  }

  async put(name: string, data: Blob, id?: string): Promise<DriveFile> {
    const meta = id ? {} : { name, parents: ['appDataFolder'] }
    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }))
    form.append('file', data)
    const url = id ? `${UPLOAD}/files/${id}?uploadType=multipart&fields=${FIELDS}` : `${UPLOAD}/files?uploadType=multipart&fields=${FIELDS}`
    return (await this.req(url, { method: id ? 'PATCH' : 'POST', body: form })).json()
  }

  async upload(name: string, data: Blob, onProgress?: (sent: number) => void): Promise<DriveFile> {
    const start = await this.req(`${UPLOAD}/files?uploadType=resumable&fields=${FIELDS}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Length': String(data.size) },
      body: JSON.stringify({ name, parents: ['appDataFolder'] }),
    })
    const session = start.headers.get('Location')!
    let sent = 0
    for (;;) {
      const end = Math.min(sent + CHUNK, data.size)
      let res: Response
      try {
        res = await this.req(session, {
          method: 'PUT',
          headers: { 'Content-Range': data.size ? `bytes ${sent}-${end - 1}/${data.size}` : 'bytes */0' },
          body: data.slice(sent, end),
        })
      } catch (e) {
        if (e instanceof AuthError) throw e
        // Dropped connection: ask Drive how much it has, then carry on from there.
        await new Promise((r) => setTimeout(r, 2000))
        const probe = await this.req(session, { method: 'PUT', headers: { 'Content-Range': `bytes */${data.size}` } })
        if (probe.status !== 308) return probe.json()
        sent = rangeEnd(probe)
        continue
      }
      if (res.status !== 308) return res.json()
      sent = rangeEnd(res)
      onProgress?.(sent)
    }
  }

  async remove(id: string): Promise<void> {
    await this.req(`${API}/files/${id}`, { method: 'DELETE' })
  }
}

function rangeEnd(res: Response): number {
  const r = res.headers.get('Range') // "bytes=0-1234"
  return r ? Number(r.split('-')[1]) + 1 : 0
}
