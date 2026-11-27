<script lang="ts">
  import Icon from '../lib/Icon.svelte'
  import TopBar from '../lib/TopBar.svelte'
</script>

<TopBar><h1>Projects</h1></TopBar>

<div class="section">
  <div class="empty">
    <span class="badge"><Icon name="clock" /></span>
    <h2>Set up your first project</h2>
    <p class="muted">Clocky tracks time against projects. Creating projects arrives in the next milestone.</p>
    <button class="btn primary" disabled><Icon name="plus" /> New project</button>
  </div>
</div>

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

  p {
    margin: 0;
    max-width: 34ch;
  }

  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
