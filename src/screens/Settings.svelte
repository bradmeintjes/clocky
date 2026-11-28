<script lang="ts">
  import { Dialog } from 'bits-ui'
  import { onMount } from 'svelte'
  import Icon from '../lib/Icon.svelte'
  import ProjectSheet from '../lib/ProjectSheet.svelte'
  import TagSheet from '../lib/TagSheet.svelte'
  import TopBar from '../lib/TopBar.svelte'
  import Swatch from '../lib/ui/Swatch.svelte'
  import { projects, tagCounts, tags } from '../lib/queries'
  import type { Project, Tag } from '../lib/types'
  import { sync } from '../lib/sync/sync.svelte'
  import { makeBackup, restoreBackup } from '../lib/data/backup'
  import { ValidationError } from '../lib/data/projects'
  import { saveBlob } from '../lib/export/download'
  import { ui } from '../lib/ui-state.svelte'
  import { prefs } from '../lib/settings.svelte'
  import Switch from '../lib/ui/Switch.svelte'

  let projectOpen = $state(false)
  let editProject = $state<Project | null>(null)
  let tagOpen = $state(false)
  let editTag = $state<Tag | null>(null)

  function openProject(p: Project | null) {
    editProject = p
    projectOpen = true
  }

  function openTag(t: Tag | null) {
    editTag = t
    tagOpen = true
  }

  const count = (id: string) => $tagCounts?.get(id) ?? 0

  let persisted = $state<boolean | undefined>()
  let usage = $state<string>()

  const ago = (t: number | null) => {
    if (!t) return 'Not yet'
    const m = Math.round((Date.now() - t) / 60000)
    if (m < 1) return 'Just now'
    if (m < 60) return `${m} min ago`
    return new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  }
  const statusText = $derived(
    sync.status === 'syncing'
      ? 'Syncing…'
      : sync.status === 'needs-auth'
        ? 'Sign in again to sync'
        : sync.status === 'offline'
          ? 'Offline. Will sync when back online.'
          : sync.status === 'error'
            ? `Last sync failed: ${sync.error}`
            : `Last synced ${ago(sync.lastSync).toLowerCase()}`,
  )
  const uploadCount = $derived(Object.keys(sync.uploads).length)

  async function backup() {
    const b = await makeBackup()
    const day = new Date().toISOString().slice(0, 10)
    saveBlob(new Blob([JSON.stringify(b)], { type: 'application/json' }), `clocky-backup-${day}.json`)
  }

  const notifySupported = typeof Notification !== 'undefined'
  let notify = $state(prefs.value.notify && notifySupported && Notification.permission === 'granted')
  let notifyNote = $state('')
  $effect(() => {
    if (notify === prefs.value.notify) return
    if (!notify) {
      void prefs.set({ notify: false })
      return
    }
    notifyNote = ''
    Notification.requestPermission().then((p) => {
      if (p === 'granted') void prefs.set({ notify: true })
      else {
        notify = false
        notifyNote = 'Notifications are blocked for Clocky. Allow them in your browser settings to use this.'
      }
    })
  })

  let restoreError = $state('')
  async function restore(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    restoreError = ''
    try {
      const n = await restoreBackup(JSON.parse(await file.text()))
      ui.showToast(n ? `Restored ${n} record${n === 1 ? '' : 's'}` : 'Nothing to restore: this device is up to date')
    } catch (e) {
      restoreError = e instanceof ValidationError ? e.message : e instanceof SyntaxError ? "That file isn't a Clocky backup." : 'Could not restore the backup.'
    }
  }

  onMount(async () => {
    persisted = await navigator.storage?.persisted?.()
    const est = await navigator.storage?.estimate?.()
    if (est?.usage !== undefined) usage = `${(est.usage / 1024 / 1024).toFixed(1)} MB`
  })
</script>

<TopBar><h1>Settings</h1></TopBar>

<div class="section">
  <h3>Account and sync</h3>
  <div class="group">
    {#if sync.mode === 'google'}
      <div class="srow">
        <span class="avatar">{(sync.email || '?')[0].toUpperCase()}</span>
        <div class="grow">
          <div class="t">{sync.email || 'Google account'}</div>
          <div class="d">Syncing to a private folder in your Google Drive</div>
        </div>
      </div>
      <div class="srow">
        <span class="okdot" class:busy={sync.status === 'syncing'} class:warn={sync.status !== 'idle' && sync.status !== 'syncing'}></span>
        <div class="grow">
          <div class="t">{statusText}</div>
          <div class="d">
            {sync.pending ? `${sync.pending} change${sync.pending === 1 ? '' : 's'} waiting` : 'Everything is on Drive'}{uploadCount
              ? ` · uploading ${uploadCount} file${uploadCount === 1 ? '' : 's'}`
              : ''}
          </div>
        </div>
        {#if sync.status === 'needs-auth'}
          <button class="btn sm primary" onclick={() => sync.reauth()} disabled={sync.busy}>Sign in</button>
        {:else}
          <button class="btn sm" onclick={() => sync.syncNow()} disabled={sync.status === 'syncing'}><Icon name="sync" /> Sync now</button>
        {/if}
      </div>
      <div class="srow">
        <div class="grow">
          <div class="t">Disconnect Google Drive</div>
          <div class="d">Stops syncing. Your data stays on this device, and Drive keeps its copy.</div>
        </div>
        <button class="btn sm danger" onclick={() => sync.disconnect()}>Disconnect</button>
      </div>
    {:else}
      <div class="srow">
        <span class="avatar"><Icon name="phone" /></span>
        <div class="grow">
          <div class="t">Local only</div>
          <div class="d">No account. Your data stays in this browser and isn't synced.</div>
        </div>
      </div>
      <div class="srow">
        <div class="grow">
          <div class="t">Connect Google Drive</div>
          <div class="d">Back up and sync to a private folder in your Drive. What you have now is uploaded.</div>
        </div>
        <button class="btn sm primary" onclick={() => sync.connect()} disabled={sync.busy}><Icon name="cloud" /> {sync.busy ? 'Waiting…' : 'Connect'}</button>
      </div>
    {/if}
  </div>
  {#if sync.error && sync.status !== 'error'}<p class="error" role="alert">{sync.error}</p>{/if}
</div>

<div class="section">
  <div class="row-between">
    <h3>Projects</h3>
    <button class="btn ghost sm" onclick={() => openProject(null)}><Icon name="plus" /> New</button>
  </div>
  <div class="group">
    {#each $projects ?? [] as p (p.id)}
      <div class="srow">
        <Swatch name={p.name} color={p.color} size={28} />
        <div class="grow">
          <div class="t">{p.name}</div>
          {#if p.archived}<div class="d">Archived</div>{/if}
        </div>
        <button class="btn sm" onclick={() => openProject(p)}>Edit</button>
      </div>
    {:else}
      <div class="srow"><span class="d">No projects yet.</span></div>
    {/each}
  </div>
</div>

<div class="section">
  <div class="row-between">
    <h3>Tags</h3>
    <button class="btn ghost sm" onclick={() => openTag(null)}><Icon name="plus" /> New</button>
  </div>
  <div class="group">
    {#each $tags ?? [] as t (t.id)}
      <div class="srow">
        <span class="chip">{t.name}</span>
        <div class="grow d mono">{count(t.id)} entr{count(t.id) === 1 ? 'y' : 'ies'}</div>
        <button class="btn sm" onclick={() => openTag(t)}>Edit</button>
      </div>
    {:else}
      <div class="srow"><span class="d">No tags yet. You can also add them while tracking time.</span></div>
    {/each}
  </div>
</div>

<div class="section">
  <h3>Preferences</h3>
  <div class="group">
    <div class="srow">
      <label class="grow t" for="pf-week">Week starts on</label>
      <select id="pf-week" class="input compact" value={prefs.value.weekStart} onchange={(e) => prefs.set({ weekStart: Number(e.currentTarget.value) })}>
        <option value={1}>Monday</option>
        <option value={0}>Sunday</option>
        <option value={6}>Saturday</option>
      </select>
    </div>
    <div class="srow">
      <div class="grow">
        <label class="t" for="pf-nudge">Ask if still working after</label>
        <div class="d">Measured from when you last started or resumed.</div>
      </div>
      <select id="pf-nudge" class="input compact" value={prefs.value.nudgeHours} onchange={(e) => prefs.set({ nudgeHours: Number(e.currentTarget.value) })}>
        {#each [2, 4, 6, 8, 10, 12] as h (h)}<option value={h}>{h} hours</option>{/each}
      </select>
    </div>
    {#if notifySupported}
      <div class="srow">
        <div class="grow">
          <div class="t">Notify me too</div>
          <div class="d">A system notification while Clocky is open or in the background.</div>
        </div>
        <Switch bind:checked={notify} label="Notify me when a timer runs long" />
      </div>
    {/if}
  </div>
  {#if notifyNote}<p class="small muted">{notifyNote}</p>{/if}
</div>

<div class="section">
  <h3>Storage</h3>
  <div class="group">
    <div class="srow">
      <div class="grow">
        <label class="t" for="pf-keep">Keep attachment files on this device</label>
        <div class="d">
          {sync.mode === 'google'
            ? 'Older files are removed from this device once they are on Drive, and download again when you open them.'
            : 'While local only, files always stay on this device.'}
        </div>
      </div>
      <select id="pf-keep" class="input compact" value={prefs.value.keepMonths} onchange={(e) => prefs.set({ keepMonths: Number(e.currentTarget.value) })}>
        <option value={1}>1 month</option>
        <option value={3}>3 months</option>
        <option value={6}>6 months</option>
        <option value={12}>12 months</option>
        <option value={0}>Forever</option>
      </select>
    </div>
    <div class="srow">
      <div class="grow"><div class="t">Space used</div></div>
      <span class="mono">{usage ?? 'Unknown'}</span>
    </div>
    <div class="srow">
      <div class="grow">
        <div class="t">Protected from clearing</div>
        <div class="d">The browser won't delete Clocky's data to free up space.</div>
      </div>
      <span>{persisted === undefined ? 'Unknown' : persisted ? 'Yes' : 'No'}</span>
    </div>
  </div>
</div>

<div class="section">
  <h3>Backup</h3>
  <div class="group">
    <div class="srow">
      <div class="grow">
        <div class="t">Download backup</div>
        <div class="d">One file with all projects, tags, entries and attachment details. File contents aren't included.</div>
      </div>
      <button class="btn sm" onclick={backup}>Download</button>
    </div>
    <div class="srow">
      <div class="grow">
        <div class="t">Restore from backup</div>
        <div class="d">Merges the backup in. Newer changes on this device are kept.</div>
      </div>
      <label class="btn sm filebtn">Choose file<input type="file" accept="application/json,.json" onchange={restore} /></label>
    </div>
  </div>
  {#if restoreError}<p class="error" role="alert">{restoreError}</p>{/if}
</div>

<div class="section">
  <h3>About</h3>
  <div class="group">
    <Dialog.Root>
      <Dialog.Trigger class="srow about">
        <Icon name="info" />
        <span class="grow t">About Clocky</span>
        <Icon name="chev" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay class="scrim" />
        <Dialog.Content class="dialog">
          <Dialog.Title class="dialog-title">Clocky</Dialog.Title>
          <Dialog.Description class="muted">A small, personal time tracker. Version {__APP_VERSION__}.</Dialog.Description>
          <Dialog.Close class="btn primary dialog-close">Close</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </div>
</div>

<ProjectSheet bind:open={projectOpen} project={editProject} />
<TagSheet bind:open={tagOpen} tag={editTag} tags={$tags ?? []} usage={editTag ? count(editTag.id) : 0} />

<style>
  .compact {
    width: auto;
    height: 36px;
    padding: 0 8px;
    flex: none;
  }

  .avatar {
    width: 40px;
    height: 40px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 700;
  }

  .okdot {
    width: 10px;
    height: 10px;
    flex: none;
    margin: 0 15px;
    border-radius: 50%;
    background: var(--live);
  }

  .okdot.busy {
    background: var(--accent);
    animation: pulse 1s infinite;
  }

  .okdot.warn {
    background: var(--pause);
  }

  .filebtn {
    position: relative;
    cursor: pointer;
  }

  .filebtn input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }

  .filebtn:focus-within {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  :global(.about) {
    width: 100%;
    text-align: left;
    color: var(--ink);
  }

  :global(.about svg) {
    color: var(--ink-3);
  }

</style>
