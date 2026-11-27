<script lang="ts">
  import { liveQuery } from 'dexie'
  import { pause, resume, stop } from '../lib/actions'
  import { isPaused } from '../lib/data/entries'
  import { dayLabel } from '../lib/dates'
  import { db } from '../lib/db'
  import EntryRow from '../lib/EntryRow.svelte'
  import Icon from '../lib/Icon.svelte'
  import ProjectSheet from '../lib/ProjectSheet.svelte'
  import { projectEntries, running, tags } from '../lib/queries'
  import { weekStartDay } from '../lib/settings'
  import { formatHM, formatHMS, startOfMonth, startOfWeek, workedMs } from '../lib/time'
  import type { Entry } from '../lib/types'
  import Swatch from '../lib/ui/Swatch.svelte'
  import { ui } from '../lib/ui-state.svelte'
  import { dateKey } from '../lib/zone'

  let { id }: { id: string } = $props()

  // The screen is keyed on id by the router, so these are created once per project.
  // svelte-ignore state_referenced_locally
  const project = liveQuery(() => db.projects.get(id))
  // svelte-ignore state_referenced_locally
  const entries = projectEntries(id)

  let editing = $state(false)

  const monthName = new Date().toLocaleDateString(undefined, { month: 'long' })

  const list = $derived($entries ?? [])
  const tagsById = $derived(new Map(($tags ?? []).map((t) => [t.id, t])))
  const p = $derived($project && !$project.deleted ? $project : undefined)
  const run = $derived($running && $running.projectId === id ? $running : undefined)
  const paused = $derived(run ? isPaused(run) : false)

  const sum = (from: number) => list.filter((e) => e.start >= from).reduce((s, e) => s + workedMs(e, ui.now), 0)
  const week = $derived(sum(startOfWeek(ui.now, weekStartDay())))
  const month = $derived(sum(startOfMonth(ui.now)))

  // Group by the local date of each entry's start, in its own zone. List is newest first.
  const groups = $derived.by(() => {
    const out: { key: string; items: Entry[]; total: number }[] = []
    for (const e of list) {
      const key = dateKey(e.start, e.tz)
      let g = out[out.length - 1]
      if (!g || g.key !== key) out.push((g = { key, items: [], total: 0 }))
      g.items.push(e)
      g.total += workedMs(e, ui.now)
    }
    return out
  })
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
      <div class="stat"><b>{formatHM(week)}</b><span>This week</span></div>
      <div class="stat"><b>{formatHM(month)}</b><span>{monthName}</span></div>
      <div class="stat"><b>{list.length}</b><span>Entries</span></div>
    </div>
    {#if p.archived}
      <div class="notice">
        <Icon name="archive" />
        <span>This project is archived. Its time still shows up in exports for the periods it covers.</span>
      </div>
    {:else if run}
      <div class="runbox" class:paused>
        <div class="grow">
          <div class="small state">{paused ? 'On break' : 'Running'} · {run.task || 'No task'}</div>
          <div class="mono clock">{formatHMS(workedMs(run, ui.now))}</div>
        </div>
        {#if paused}
          <button class="rbtn" aria-label="Resume" onclick={resume}><Icon name="play" /></button>
        {:else}
          <button class="rbtn" aria-label="Pause for a break" onclick={pause}><Icon name="pause" /></button>
        {/if}
        <button class="rbtn stop" aria-label="Stop timer" onclick={stop}><Icon name="stop" /></button>
      </div>
    {:else}
      <button class="btn primary big block" onclick={() => ui.openStart(p.id)}><Icon name="play" /> Start timer</button>
    {/if}
  </div>

  {#each groups as g (g.key)}
    <div class="dsep">
      <b>{dayLabel(g.key, ui.now)}</b>
      <span class="mono">{formatHM(g.total)}</span>
    </div>
    <div class="elist">
      {#each g.items as e (e.id)}
        <EntryRow entry={e} {tagsById} />
      {/each}
    </div>
  {:else}
    {#if $entries}
      <div class="section">
        <div class="empty">
          <h2>No time yet</h2>
          <p class="muted">Start a timer, or add time you already worked with the + button.</p>
        </div>
      </div>
    {/if}
  {/each}

  <button class="fab" class:lifted={!!$running} aria-label="Add time by hand" title="Add time by hand" onclick={() => ui.newEntry(p.id)}>
    <Icon name="plus" />
  </button>

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

  .runbox {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 14px;
    background: var(--live-soft);
  }

  .runbox.paused {
    background: var(--pause-soft);
  }

  .runbox .grow {
    flex: 1;
    min-width: 0;
  }

  .state {
    font-weight: 600;
    color: var(--live);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .paused .state {
    color: var(--pause);
  }

  .clock {
    font-size: 1.6rem;
    font-weight: 700;
  }

  .rbtn {
    width: 42px;
    height: 42px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--surface);
    color: var(--ink);
  }

  .rbtn.stop {
    background: var(--ink);
    color: var(--bg);
  }

  .dsep {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 18px 4px 6px;
    background: var(--bg);
  }

  .dsep b {
    font-family: var(--f-display);
    font-size: 1rem;
  }

  .dsep .mono {
    font-size: 0.875rem;
    color: var(--ink-2);
  }

  .elist {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-m);
  }

  .empty p {
    margin: 0;
  }

  .fab {
    position: fixed;
    z-index: 18;
    right: max(18px, calc(env(safe-area-inset-right) + 18px));
    bottom: calc(var(--tabs-h) + 18px + env(safe-area-inset-bottom));
    width: 56px;
    height: 56px;
    display: grid;
    place-items: center;
    border-radius: 18px;
    background: var(--accent);
    color: var(--accent-ink);
    box-shadow: var(--shadow);
  }

  .fab.lifted {
    bottom: calc(var(--tabs-h) + 92px + env(safe-area-inset-bottom));
  }

  .fab :global(svg) {
    width: 26px;
    height: 26px;
  }

  @media (min-width: 960px) {
    .fab,
    .fab.lifted {
      bottom: 32px;
      right: 40px;
    }
  }
</style>
