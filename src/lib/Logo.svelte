<script lang="ts">
  let { label = true }: { label?: boolean } = $props()
</script>

<span class="logo">
  <svg class="mark" viewBox="0 0 512 512" aria-hidden="true">
    <rect width="512" height="512" rx="120" fill="#111111" />
    <g transform="translate(256 256) scale(1.1) translate(-256 -256)">
      <path d="M362 150a150 150 0 1 0 0 212" fill="none" stroke="#F2F0EB" stroke-width="56" stroke-linecap="round" />
      <circle cx="256" cy="256" r="36" fill="#D9692B" />
    </g>
  </svg>
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
    flex: none;
  }
</style>
