<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db } from '../lib/db'
  import Icon from '../lib/Icon.svelte'
  import ProjectSheet from '../lib/ProjectSheet.svelte'
  import { weekStartDay } from '../lib/settings'
  import { formatHM, startOfMonth, startOfWeek, workedMs } from '../lib/time'
  import Swatch from '../lib/ui/Swatch.svelte'

  let { id }: { id: string } = $props()

  const project = $derived(liveQuery(() => db.projects.get(id)))
  const entries = $derived(
    liveQuery(() =>
      db.entries
        .where('[projectId+start]')
        .between([id, -Infinity], [id, Infinity])
        .filter((e) => !e.deleted)
        .toArray(),
    ),
  )

  let editing = $state(false)

  const now = Date.now()
  const weekFrom = startOfWeek(now, weekStartDay())
  const monthFrom = startOfMonth(now)
  const monthName = new Date(now).toLocaleDateString(undefined, { month: 'long' })

  const list = $derived($entries ?? [])
  const sum = (from: number) => list.filter((e) => e.start >= from).reduce((s, e) => s + workedMs(e, now), 0)
  const p = $derived($project && !$project.deleted ? $project : undefined)
</script>

<div class="topbar">
  <a class="iconbtn" href="#/projects" aria-label="Back to projects"><Icon name="back" /></a>
</div>

{#if p}
  <div class="phead" style="--pc:{p.color}">
    <div class="row-between top">
      <div class="title">
        <Swatch name={p.name} color={p.color} size={44} />
        <h1>{p.name}</h1>
      </div>
      <button class="iconbtn" aria-label="Edit project" onclick={() => (editing = true)}><Icon name="edit" /></button>
    </div>
    <div class="stats">
      <div class="stat"><b>{formatHM(sum(weekFrom))}</b><span>This week</span></div>
      <div class="stat"><b>{formatHM(sum(monthFrom))}</b><span>{monthName}</span></div>
      <div class="stat"><b>{list.length}</b><span>Entries</span></div>
    </div>
    {#if p.archived}
      <div class="notice">
        <Icon name="archive" />
        <span>This project is archived. Its time still shows up in exports for the periods it covers.</span>
      </div>
    {:else}
      <button class="btn primary big block" disabled title="Timers arrive in the next milestone">
        <Icon name="play" /> Start timer
      </button>
    {/if}
  </div>

  <div class="section">
    <div class="empty">
      <h2>No time yet</h2>
      <p class="muted">Timers and entries arrive in the next milestone.</p>
    </div>
  </div>

  <ProjectSheet bind:open={editing} project={p} />
{:else if $project !== undefined || $entries}
  <div class="empty">
    <h2>Project not found</h2>
    <a class="btn" href="#/projects">Back to projects</a>
  </div>
{/if}

<style>
  .topbar {
    display: flex;
    align-items: center;
    min-height: 56px;
    padding-block: 14px 6px;
  }

  .phead {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-l);
  }

  .phead::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 6px;
    background: var(--pc);
  }

  .top {
    align-items: flex-start;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .title h1 {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 22px;
  }

  .stat b {
    display: block;
    font-family: var(--f-mono);
    font-size: 1.25rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .stat span {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--ink-3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .empty p {
    margin: 0;
  }
</style>
