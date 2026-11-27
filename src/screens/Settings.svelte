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

  onMount(async () => {
    persisted = await navigator.storage?.persisted?.()
    const est = await navigator.storage?.estimate?.()
    if (est?.usage !== undefined) usage = `${(est.usage / 1024 / 1024).toFixed(1)} MB`
  })
</script>

<TopBar><h1>Settings</h1></TopBar>

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
  <h3>Storage</h3>
  <div class="group">
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
  :global(.about) {
    width: 100%;
    text-align: left;
    color: var(--ink);
  }

  :global(.about svg) {
    color: var(--ink-3);
  }

  :global(.scrim) {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgb(10 12 18 / 0.45);
  }

  :global(.dialog) {
    position: fixed;
    z-index: 41;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(420px, calc(100vw - 32px));
    padding: 22px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    background: var(--surface);
    border-radius: 22px;
  }

  :global(.dialog-title) {
    font-family: var(--f-display);
    font-size: 1.15rem;
    font-weight: 700;
    margin: 0;
  }

  :global(.dialog [data-dialog-description]) {
    margin: 0;
  }

  :global(.dialog-close) {
    align-self: flex-end;
  }
</style>
