<script lang="ts">
  import { ui } from './ui-state.svelte'
</script>

{#if ui.toast}
  {@const t = ui.toast}
  <div class="toastwrap" role="status" aria-live="polite">
    <div class="toast">
      <span>{t.message}</span>
      {#if t.undo}
        <button
          onclick={() => {
            t.undo?.()
            ui.toast = null
          }}>Undo</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .toastwrap {
    position: fixed;
    z-index: 60;
    left: 50%;
    bottom: calc(var(--tabs-h) + 92px + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    width: max-content;
    max-width: calc(100% - 32px);
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px 10px 16px;
    border-radius: 12px;
    background: var(--ink);
    color: var(--bg);
    font-size: 0.875rem;
    box-shadow: var(--shadow);
  }

  button {
    padding: 4px;
    color: var(--bg);
    font-weight: 700;
    text-decoration: underline;
  }

  @media (min-width: 960px) {
    .toastwrap {
      bottom: 32px;
    }
  }
</style>
