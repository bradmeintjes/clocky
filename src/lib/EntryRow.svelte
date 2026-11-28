<script lang="ts">
  import Icon from './Icon.svelte'
  import { breakMs, formatBreak, formatHM, workedMs } from './time'
  import type { Entry, Tag } from './types'
  import { ui } from './ui-state.svelte'
  import { clockTime } from './zone'

  let { entry: e, tagsById }: { entry: Entry; tagsById: Map<string, Tag> } = $props()

  const live = $derived(e.end === null)
  const n = $derived(e.breaks.length)
</script>

<button class="entry" onclick={() => ui.openEntry(e.id)}>
  <span class="grow">
    <span class="task" class:none={!e.task}>{e.task || 'No task'}</span>
    <span class="meta">
      <span class="mono">{clockTime(e.start, e.tz)}–{live ? 'now' : clockTime(e.end!, e.tz)}</span>
      {#if n}
        <span class="it"><Icon name="coffee" />{n} break{n > 1 ? 's' : ''}, {formatBreak(breakMs(e, ui.now))}</span>
      {/if}
      {#each e.tagIds as id (id)}
        {@const t = tagsById.get(id)}
        {#if t}<span class="chip">{t.name}</span>{/if}
      {/each}
      {#if e.attachmentIds.length}
        <span class="it" title="Attachments"><Icon name="clip" />{e.attachmentIds.length}</span>
      {/if}
      {#if e.manual}<span class="badge-manual" title="Added by hand or times edited">Manual</span>{/if}
      {#if live}<span class="badge-live"><span class="pulse"></span>Live</span>{/if}
    </span>
  </span>
  <span class="dur mono" class:live>{formatHM(workedMs(e, ui.now))}</span>
</button>

<style>
  .entry {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
    padding: 12px 14px;
    text-align: left;
    border-top: 1px solid var(--line);
  }

  .entry:first-child {
    border-top: 0;
  }

  .entry:hover {
    background: var(--surface-2);
  }

  .grow {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .task {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .task.none {
    color: var(--ink-3);
    font-weight: 500;
    font-style: italic;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
    font-size: 0.8125rem;
    color: var(--ink-3);
  }

  .it {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .it :global(svg) {
    width: 14px;
    height: 14px;
  }

  .dur {
    padding-top: 1px;
    font-size: 1rem;
    font-weight: 700;
  }

  .dur.live {
    color: var(--live);
  }
</style>
