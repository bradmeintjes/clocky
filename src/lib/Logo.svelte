<script lang="ts">
  import Icon from './Icon.svelte'

  let { label = true }: { label?: boolean } = $props()
</script>

<span class="logo">
  <span class="mark"><Icon name="clock" /></span>
  {#if label}Clocky{/if}
</span>

<style>
  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--f-display);
    font-weight: 700;
    font-size: 1.2rem;
    letter-spacing: -0.02em;
  }

  .mark {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    background: var(--ink);
    color: var(--bg);
    display: grid;
    place-items: center;
  }

  .mark :global(svg) {
    width: 16px;
    height: 16px;
  }
</style>
