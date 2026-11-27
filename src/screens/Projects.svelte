<script lang="ts">
  import Icon from '../lib/Icon.svelte'
  import ProjectSheet from '../lib/ProjectSheet.svelte'
  import TopBar from '../lib/TopBar.svelte'
  import Swatch from '../lib/ui/Swatch.svelte'
  import Switch from '../lib/ui/Switch.svelte'
  import { projects, totalsBetween } from '../lib/queries'
  import { weekStartDay } from '../lib/settings'
  import { addDays, formatHM, startOfWeek } from '../lib/time'

  const weekFrom = startOfWeek(Date.now(), weekStartDay())
  const week = totalsBetween(weekFrom, addDays(weekFrom, 7))

  let showArchived = $state(false)
  let creating = $state(false)

  const all = $derived($projects ?? [])
  const archivedCount = $derived(all.filter((p) => p.archived).length)
  const visible = $derived(all.filter((p) => showArchived || !p.archived))
  const weekTotal = $derived([...($week?.values() ?? [])].reduce((a, b) => a + b, 0))
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
  <div class="section">
    <div class="weekstrip row-between">
      <div>
        <h3>This week</h3>
        <div class="small muted">All projects</div>
      </div>
      <span class="bignum mono">{formatHM(weekTotal)}</span>
    </div>
  </div>

  <div class="section">
    <div class="row-between">
      <h3>Your projects</h3>
      <button class="btn ghost sm" onclick={() => (creating = true)}><Icon name="plus" /> New</button>
    </div>
    {#each visible as p (p.id)}
      <a class="proj" class:archived={p.archived} href="#/project/{p.id}">
        <Swatch name={p.name} color={p.color} />
        <span class="grow">
          <span class="proj-name">{p.name}</span>
          <span class="proj-sub">
            {#if p.archived}Archived{:else}<span class="mono">{formatHM($week?.get(p.id) ?? 0)}</span> this week{/if}
          </span>
        </span>
        <Icon name="chev" />
      </a>
    {/each}
    {#if archivedCount}
      <div class="switchrow">
        <span class="small muted">Show archived ({archivedCount})</span>
        <Switch bind:checked={showArchived} label="Show archived projects" />
      </div>
    {/if}
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
    padding: 14px;
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

  .proj {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px 12px 12px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-m);
    color: var(--ink-3);
    text-decoration: none;
  }

  .proj:hover {
    background: var(--surface-2);
  }

  .proj.archived {
    opacity: 0.7;
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
</style>
