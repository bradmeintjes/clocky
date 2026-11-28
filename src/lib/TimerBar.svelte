<script lang="ts">
  import { pause, resume, stop } from './actions'
  import { isPaused } from './data/entries'
  import Icon from './Icon.svelte'
  import { projects, running } from './queries'
  import { formatHM, formatHMS, workedMs } from './time'
  import { ui } from './ui-state.svelte'

  const e = $derived($running)
  const p = $derived(e ? $projects?.find((x) => x.id === e.projectId) : undefined)
  const paused = $derived(e ? isPaused(e) : false)
  const breakStart = $derived(e && paused ? e.breaks[e.breaks.length - 1][0] : 0)
</script>

{#if e}
  <div class="timerbar">
    <div class="tb" style="--pc:{p?.color ?? 'var(--accent)'}">
      <button class="info" aria-label="Open running entry" onclick={() => ui.openEntry(e.id)}>
        <b><span class="pulse" class:paused></span>{p?.name ?? 'Timer'}</b>
        <small>
          {#if paused}
            <span class="onbreak">On break <span class="mono">{formatHM(ui.now - breakStart)}</span></span>
          {:else}
            {e.task || 'No task yet, tap to add'}
          {/if}
        </small>
      </button>
      <span class="clock mono" aria-label="Worked time">{formatHMS(workedMs(e, ui.now))}</span>
      {#if paused}
        <button class="tbtn" aria-label="Resume" title="Resume" onclick={resume}><Icon name="play" /></button>
      {:else}
        <button class="tbtn" aria-label="Pause for a break" title="Pause for a break" onclick={pause}><Icon name="pause" /></button>
      {/if}
      <button class="tbtn stop" aria-label="Stop timer" title="Stop" onclick={stop}><Icon name="stop" /></button>
    </div>
  </div>
{/if}

<style>
  .timerbar {
    position: fixed;
    z-index: 19;
    left: max(10px, env(safe-area-inset-left));
    right: max(10px, env(safe-area-inset-right));
    bottom: calc(var(--tabs-h) + 10px + env(safe-area-inset-bottom));
  }

  .tb {
    position: relative;
    overflow: hidden;
    max-width: 700px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 10px 10px 16px;
    border-radius: var(--r-l);
    background: var(--tb-bg);
    color: var(--tb-fg);
    box-shadow: var(--shadow);
  }

  .tb::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 5px;
    background: var(--pc);
  }

  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    color: inherit;
  }

  .info b {
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .info small {
    max-width: 100%;
    overflow: hidden;
    color: var(--tb-muted);
    font-size: 0.8125rem;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .onbreak {
    color: var(--pause);
    font-weight: 600;
  }

  .pulse {
    width: 8px;
    height: 8px;
    flex: none;
    border-radius: 50%;
    background: var(--live);
    animation: pulse 1.6s ease-in-out infinite;
  }

  .pulse.paused {
    background: var(--pause);
    animation: none;
  }

  @keyframes pulse {
    50% {
      opacity: 0.35;
    }
  }

  .clock {
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--tb-clock);
  }

  .tbtn {
    width: 42px;
    height: 42px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: rgb(255 255 255 / 0.1);
    color: var(--tb-fg);
  }

  .tbtn:hover {
    background: rgb(255 255 255 / 0.18);
  }

  .tbtn.stop {
    background: var(--tb-fg);
    color: var(--tb-bg);
  }

  @media (max-width: 380px) {
    .clock {
      font-size: 1.1rem;
    }
  }

  @media (min-width: 960px) {
    .timerbar {
      position: sticky;
      top: 12px;
      left: auto;
      right: auto;
      bottom: auto;
      margin-top: 12px;
    }

    .tb {
      max-width: 880px;
    }
  }
</style>
