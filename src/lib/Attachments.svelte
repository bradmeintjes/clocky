<script lang="ts" module>
  /** An attachment waiting for its entry to be saved (manual entries). */
  export type Pending =
    | { kind: 'link'; url: string; name: string }
    | { kind: 'file' | 'photo'; file: Blob; name: string; thumb?: Blob }
</script>

<script lang="ts">
  import { Dialog } from 'bits-ui'
  import { liveQuery } from 'dexie'
  import {
    addFile, addLink, formatSize, getBlob, linkName, listAttachments, MAX_FILE_BYTES, normaliseUrl,
    removeAttachment, restoreAttachment,
  } from './data/attachments'
  import { ValidationError } from './data/projects'
  import { saveBlob } from './export/download'
  import Icon from './Icon.svelte'
  import { makeThumb } from './thumb'
  import type { Attachment } from './types'
  import { ui } from './ui-state.svelte'

  let { entryId, pending = $bindable([]) }: { entryId: string | null; pending?: Pending[] } = $props()

  const stored = $derived(entryId ? liveQuery(() => listAttachments(entryId)) : null)

  type Item = { key: string; kind: Attachment['kind']; name: string; sub: string; url?: string; thumb?: Blob; att?: Attachment; index?: number }
  const items = $derived.by((): Item[] => {
    if (entryId) {
      return ($stored ?? []).map((a) => ({
        key: a.id,
        kind: a.kind,
        name: a.name,
        sub: a.kind === 'link' ? new URL(a.url!).hostname : [a.kind === 'photo' ? 'Photo' : 'File', a.size ? formatSize(a.size) : ''].filter(Boolean).join(' · '),
        url: a.url,
        thumb: a.thumb,
        att: a,
      }))
    }
    return pending.map((p, i) => ({
      key: 'p' + i,
      kind: p.kind,
      name: p.name,
      sub: p.kind === 'link' ? new URL(p.url).hostname : [p.kind === 'photo' ? 'Photo' : 'File', formatSize(p.file.size), 'saved with the entry'].join(' · '),
      url: p.kind === 'link' ? p.url : undefined,
      thumb: p.kind !== 'link' ? p.thumb : undefined,
      index: i,
    }))
  })

  // Object URLs for thumbnails, released when they leave the list.
  const thumbUrls = new Map<Blob, string>()
  const thumbUrl = (b: Blob) => {
    let u = thumbUrls.get(b)
    if (!u) thumbUrls.set(b, (u = URL.createObjectURL(b)))
    return u
  }
  $effect(() => {
    const live = new Set(items.map((i) => i.thumb).filter(Boolean))
    for (const [b, u] of thumbUrls) {
      if (!live.has(b)) {
        URL.revokeObjectURL(u)
        thumbUrls.delete(b)
      }
    }
  })
  $effect(() => () => {
    for (const u of thumbUrls.values()) URL.revokeObjectURL(u)
  })

  let linkOpen = $state(false)
  let linkText = $state('')
  let error = $state('')
  let busy = $state(0)
  let removed = $state<{ id: string; name: string } | null>(null)

  async function undoRemove() {
    if (!removed) return
    await restoreAttachment(removed.id)
    removed = null
  }

  async function saveLink(ev?: Event) {
    ev?.preventDefault()
    error = ''
    try {
      if (entryId) await addLink(entryId, linkText)
      else {
        const url = normaliseUrl(linkText)
        pending = [...pending, { kind: 'link', url, name: linkName(url) }]
      }
      linkText = ''
      linkOpen = false
    } catch (e) {
      error = e instanceof ValidationError ? e.message : 'Could not add the link.'
    }
  }

  async function addFiles(list: FileList | null, camera = false) {
    error = ''
    for (const file of Array.from(list ?? [])) {
      if (file.size > MAX_FILE_BYTES) {
        error = `${file.name} is larger than 100 MB.`
        continue
      }
      busy++
      try {
        const photo = camera || file.type.startsWith('image/')
        const thumb = photo ? await makeThumb(file) : undefined
        const input = { file, name: file.name || (photo ? 'Photo' : 'File'), kind: photo ? ('photo' as const) : ('file' as const), thumb }
        if (entryId) await addFile(entryId, input)
        else pending = [...pending, input]
      } catch (e) {
        error = e instanceof ValidationError ? e.message : `Could not add ${file.name}.`
      } finally {
        busy--
      }
    }
  }

  function onPick(ev: Event, camera = false) {
    const input = ev.currentTarget as HTMLInputElement
    addFiles(input.files, camera).finally(() => (input.value = ''))
  }

  async function remove(it: Item) {
    if (it.att) {
      const id = it.att.id
      await removeAttachment(id)
      // Inline undo: a toast can't be tapped while the sheet is open.
      removed = { id, name: it.name }
    } else if (it.index !== undefined) {
      pending = pending.filter((_, i) => i !== it.index)
    }
  }

  // Photo viewer.
  let viewerOpen = $state(false)
  let viewerUrl = $state('')
  let viewerName = $state('')
  let viewerBlob: Blob | undefined

  async function blobOf(it: Item): Promise<Blob | undefined> {
    if (it.att) return getBlob(it.att.id)
    const p = it.index !== undefined ? pending[it.index] : undefined
    return p && p.kind !== 'link' ? p.file : undefined
  }

  async function open(it: Item) {
    const blob = await blobOf(it)
    if (!blob) {
      ui.showToast("This file isn't on this device")
      return
    }
    if (it.kind === 'photo') {
      viewerBlob = blob
      viewerName = it.name
      viewerUrl = URL.createObjectURL(blob)
      viewerOpen = true
    } else {
      saveBlob(blob, it.name)
    }
  }

  $effect(() => {
    if (!viewerOpen && viewerUrl) {
      URL.revokeObjectURL(viewerUrl)
      viewerUrl = ''
    }
  })
</script>

<div class="field">
  <span class="lbl">Attachments</span>
  {#if items.length}
    <ul class="atts">
      {#each items as it (it.key)}
        <li class="att">
          {#if it.kind === 'link'}
            <a class="open" href={it.url} target="_blank" rel="noopener noreferrer">
              <span class="thumb"><Icon name="link" /></span>
              <span class="grow"><span class="nm">{it.name}</span><span class="sub">{it.sub}</span></span>
            </a>
          {:else}
            <button type="button" class="open" onclick={() => open(it)} aria-label="Open {it.name}">
              {#if it.thumb}
                <span class="thumb" style:background-image="url({thumbUrl(it.thumb)})"></span>
              {:else}
                <span class="thumb"><Icon name={it.kind === 'photo' ? 'camera' : 'file'} /></span>
              {/if}
              <span class="grow"><span class="nm">{it.name}</span><span class="sub">{it.sub}</span></span>
            </button>
          {/if}
          <button type="button" class="iconbtn" aria-label="Remove {it.name}" onclick={() => remove(it)}><Icon name="x" /></button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if removed}
    <div class="removed small">
      <span>Removed {removed.name}</span>
      <button type="button" class="btn ghost sm" onclick={undoRemove}>Undo</button>
    </div>
  {/if}

  {#if linkOpen}
    <div class="linkrow">
      <!-- svelte-ignore a11y_autofocus -->
      <input
        class="input"
        type="url"
        inputmode="url"
        placeholder="Paste a link"
        aria-label="Link"
        bind:value={linkText}
        autofocus
        onkeydown={(e) => {
          if (e.key === 'Enter') saveLink(e)
          if (e.key === 'Escape') linkOpen = false
        }}
      />
      <button type="button" class="btn primary" onclick={saveLink}>Add</button>
    </div>
  {/if}

  <div class="attadd">
    <button type="button" onclick={() => (linkOpen = !linkOpen)}><Icon name="link" />Link</button>
    <label><Icon name="file" />Files<input type="file" multiple onchange={(e) => onPick(e)} /></label>
    <label><Icon name="camera" />Photo<input type="file" accept="image/*" capture="environment" onchange={(e) => onPick(e, true)} /></label>
  </div>
  {#if busy}<p class="small muted">Adding…</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<Dialog.Root bind:open={viewerOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class="viewer-scrim" />
    <Dialog.Content class="viewer">
      <Dialog.Title class="viewer-title">{viewerName}</Dialog.Title>
      {#if viewerUrl}<img src={viewerUrl} alt={viewerName} />{/if}
      <div class="viewer-actions">
        <button class="btn" onclick={() => viewerBlob && saveBlob(viewerBlob, viewerName)}>Download</button>
        <Dialog.Close class="btn primary">Close</Dialog.Close>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  p {
    margin: 0;
  }

  .atts {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .att {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    padding: 6px;
    border: 1px solid var(--line);
    border-radius: 12px;
  }

  .open {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    text-align: left;
    color: inherit;
    text-decoration: none;
  }

  .thumb {
    width: 44px;
    height: 44px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: var(--surface-2) center / cover no-repeat;
    color: var(--ink-2);
  }

  .grow {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .nm,
  .sub {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .nm {
    font-weight: 500;
  }

  .sub {
    font-size: 0.75rem;
    color: var(--ink-3);
  }

  .removed {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-left: 10px;
    border-radius: 10px;
    background: var(--surface-2);
    color: var(--ink-2);
    min-width: 0;
  }

  .removed span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .linkrow {
    display: flex;
    gap: 8px;
  }

  .attadd {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .attadd button,
  .attadd label {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 64px;
    border: 1px dashed var(--line);
    border-radius: 12px;
    color: var(--ink-2);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
  }

  .attadd button:hover,
  .attadd label:hover,
  .attadd label:focus-within {
    border-color: var(--accent);
    color: var(--accent);
  }

  .attadd input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }

  :global(.viewer-scrim) {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgb(5 8 20 / 0.85);
  }

  :global(.viewer) {
    position: fixed;
    z-index: 51;
    inset: max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
    justify-content: center;
  }

  :global(.viewer-title) {
    margin: 0;
    color: #fff;
    font-size: 0.9375rem;
    font-weight: 600;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.viewer img) {
    max-width: 100%;
    min-height: 0;
    flex: 0 1 auto;
    object-fit: contain;
    border-radius: 8px;
  }

  :global(.viewer-actions) {
    display: flex;
    gap: 10px;
  }
</style>
