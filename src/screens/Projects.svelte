<script lang="ts">
  import { start, stop } from '../lib/actions'
  import Icon from '../lib/Icon.svelte'
  import ProjectSheet from '../lib/ProjectSheet.svelte'
  import TopBar from '../lib/TopBar.svelte'
  import Swatch from '../lib/ui/Swatch.svelte'
  import Switch from '../lib/ui/Switch.svelte'
  import { entriesBetween, projects, running } from '../lib/queries'
  import { weekStartDay } from '../lib/settings'
  import { addDays, formatHM, HOUR, startOfWeek, workedMs } from '../lib/time'
  import { ui } from '../lib/ui-state.svelte'

  const weekFrom = startOfWeek(Date.now(), weekStartDay())
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekFrom, i))
  const weekEntries = entriesBetween(weekFrom, addDays(weekFrom, 7))

  let showArchived = $state(false)
  let creating = $state(false)

  const all = $derived($projects ?? [])
  const colorOf = $derived(new Map(all.map((p) => [p.id, p.color])))
  const archivedCount = $derived(all.filter((p) => p.archived).length)
  const visible = $derived(all.filter((p) => showArchived || !p.archived))

  const perProject = $derived.by(() => {
    const m = new Map<string, number>()
    for (const e of $weekEntries ?? []) m.set(e.projectId, (m.get(e.projectId) ?? 0) + workedMs(e, ui.now))
    return m
  })
  const weekTotal = $derived([...perProject.values()].reduce((a, b) => a + b, 0))

  // Stacked bar per day (local days), one segment per project.
  const bars = $derived.by(() => {
    const rows = days.map((d, i) => {
      const to = i < 6 ? days[i + 1] : addDays(d, 1)
      const seg = new Map<string, number>()
      for (const e of $weekEntries ?? []) {
        if (e.start >= d && e.start < to) seg.set(e.projectId, (seg.get(e.projectId) ?? 0) + workedMs(e, ui.now))
      }
      return { d, seg: [...seg.entries()], total: [...seg.values()].reduce((a, b) => a + b, 0) }
    })
    const max = Math.max(8 * HOUR, ...rows.map((r) => r.total))
    return rows.map((r) => ({ ...r, max }))
  })
  const todayIndex = $derived(days.findIndex((d, i) => ui.now >= d && (i === 6 || ui.now < days[i + 1])))
  const dayName = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)
</script>

<TopBar><h1>Projects</h1></TopBar>

{#if $projects && all.length === 0}
  <div class="section">
    <div class="empty">
      <span class="badge"><Icon name="clock" /></span>
      <h2>Set up your first project</h2>
      <p class="muted">Clocky tracks time against projects. Add one, then start a timer or log time by hand.</p>
      <button class="btn primary" onclick={() => (creating = true)}><Icon name="plus" /> New project</button>
    </div>
  </div>
{:else if $projects}
  <div class="layout">
    <div class="section">
      <div class="weekstrip">
        <div class="row-between">
          <div>
            <h3>This week</h3>
            <div class="small muted">From {new Date(weekFrom).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
          </div>
          <span class="bignum mono">{formatHM(weekTotal)}</span>
        </div>
        <div class="bars" aria-hidden="true">
          {#each bars as b (b.d)}
            <div class="bar">
              {#each b.seg as [pid, ms] (pid)}
                <span style="height:{((ms / b.max) * 100).toFixed(1)}%;background:{colorOf.get(pid) ?? 'var(--ink-3)'}"></span>
              {/each}
            </div>
          {/each}
        </div>
        <div class="barlbl">
          {#each days as d, i (d)}<span class:today={i === todayIndex}>{dayName(d)}</span>{/each}
        </div>
      </div>
    </div>

    <div class="section">
      <div class="row-between">
        <h3>Your projects</h3>
        <button class="btn ghost sm" onclick={() => (creating = true)}><Icon name="plus" /> New</button>
      </div>
      {#each visible as p (p.id)}
        {@const on = $running?.projectId === p.id}
        <div class="proj" class:archived={p.archived}>
          <a class="open" href="#/project/{p.id}">
            <Swatch name={p.name} color={p.color} />
            <span class="grow">
              <span class="proj-name">{p.name}</span>
              <span class="proj-sub">
                {#if p.archived}
                  Archived
                {:else}
                  {#if on}<span class="live">Running now</span> ·{/if}
                  <span class="mono">{formatHM(perProject.get(p.id) ?? 0)}</span> this week
                {/if}
              </span>
            </span>
          </a>
          {#if !p.archived}
            {#if on}
              <button class="startbtn on" aria-label="Stop timer" onclick={stop}><Icon name="stop" /></button>
            {:else}
              <button class="startbtn" aria-label="Start timer on {p.name}" onclick={() => start({ projectId: p.id })}>
                <Icon name="play" />
              </button>
            {/if}
          {/if}
        </div>
      {/each}
      {#if archivedCount}
        <div class="switchrow">
          <span class="small muted">Show archived ({archivedCount})</span>
          <Switch bind:checked={showArchived} label="Show archived projects" />
        </div>
      {/if}
    </div>
  </div>
{/if}

<ProjectSheet bind:open={creating} oncreated={(p) => (location.hash = `#/project/${p.id}`)} />

<style>
  .badge {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    display: grid;
    place-items: center;
    background: var(--accent);
    color: var(--accent-ink);
  }

  .empty p {
    margin: 0;
    max-width: 34ch;
  }

  .weekstrip {
    padding: 14px 14px 10px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-m);
  }

  .bignum {
    font-size: 1.9rem;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.03em;
  }

  .bars {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 6px;
    align-items: end;
    height: 84px;
    margin-top: 10px;
  }

  .bar {
    display: flex;
    flex-direction: column-reverse;
    height: 100%;
    overflow: hidden;
    border-radius: 5px;
    background: var(--surface-2);
  }

  .bar span {
    display: block;
  }

  .barlbl {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 6px;
    margin-top: 6px;
    font-size: 0.6875rem;
    color: var(--ink-3);
    text-align: center;
  }

  .barlbl .today {
    color: var(--ink);
    font-weight: 600;
  }

  .proj {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px 6px 6px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-m);
  }

  .proj.archived {
    opacity: 0.7;
  }

  .open {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px;
    border-radius: 10px;
    color: var(--ink-3);
    text-decoration: none;
  }

  .open:hover {
    background: var(--surface-2);
  }

  .grow {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .proj-name {
    font-weight: 600;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .proj-sub {
    font-size: 0.8125rem;
  }

  .live {
    color: var(--live);
    font-weight: 600;
  }

  .startbtn {
    width: 44px;
    height: 44px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--go);
    color: var(--go-ink);
  }

  .startbtn.on {
    background: var(--live-soft);
    color: var(--live);
  }

  @media (min-width: 960px) {
    .layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      align-items: start;
    }
  }
</style>
