<script lang="ts">
  import Icon from './Icon.svelte'
  import Logo from './Logo.svelte'
  import { sync } from './sync/sync.svelte'
</script>

<div class="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
  <div class="mark"><Logo label={false} /></div>
  <h1 id="welcome-title">Clocky</h1>
  <p class="muted">Track time against projects and export clean timesheets.</p>
  <div class="choices">
    <button class="btn primary big block" onclick={() => sync.connect()} disabled={sync.busy}>
      <Icon name="cloud" />{sync.busy ? 'Waiting for Google…' : 'Sign in with Google'}
    </button>
    <p class="small muted">Syncs your data to a private folder in your Google Drive.</p>
    <button class="btn big block" onclick={() => sync.continueLocal()} disabled={sync.busy}>
      <Icon name="phone" />Continue without signing in
    </button>
    <p class="small muted">Everything stays in this browser. You can connect Google Drive later in Settings.</p>
    {#if sync.error}<p class="error" role="alert">{sync.error}</p>{/if}
  </div>
</div>

<style>
  .welcome {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: calc(32px + env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) calc(32px + env(safe-area-inset-bottom))
      max(24px, env(safe-area-inset-left));
    background: var(--bg);
    text-align: center;
  }

  .mark :global(.mark) {
    width: 88px;
    height: 88px;
    border-radius: 24px;
    box-shadow: var(--shadow);
  }

  .mark :global(.mark svg) {
    width: 72px;
    height: 72px;
  }

  h1 {
    font-size: 2.6rem;
    margin: 0;
  }

  p {
    margin: 0;
    max-width: 34ch;
  }

  .choices {
    width: min(360px, 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin-top: 18px;
  }

  .choices .small {
    margin-bottom: 10px;
  }
</style>
