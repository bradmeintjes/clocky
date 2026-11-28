<script lang="ts">
  let { label = true }: { label?: boolean } = $props()
</script>

<span class="logo">
  <span class="mark">
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="18" stroke="var(--accent-soft)" stroke-width="4.5" />
      <circle cx="24" cy="24" r="18" stroke="var(--go)" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="90 23.1" transform="rotate(-80 24 24)" />
      <circle cx="24" cy="24" r="10" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" stroke-dasharray="49 13.8" transform="rotate(-62 24 24)" />
      <path d="M24 12.5v8" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" />
    </svg>
  </span>
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
    width: 30px;
    height: 30px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 9px;
    background: var(--surface);
    border: 1px solid var(--line);
  }

  .mark svg {
    width: 24px;
    height: 24px;
  }
</style>
