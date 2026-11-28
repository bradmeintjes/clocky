<script lang="ts" module>
  let n = 0
</script>

<script lang="ts">
  // The "t" mark. Colours follow the theme: lime over teal in light, teal over lime in dark.
  let { label = true }: { label?: boolean } = $props()
  const id = `logo${n++}`
</script>

<span class="logo">
  <span class="mark">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="{id}t" x1="29" y1="16" x2="66" y2="53" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="var(--logo-top-1)" /><stop offset="1" stop-color="var(--logo-top-2)" />
        </linearGradient>
        <linearGradient id="{id}b" x1="29" y1="54" x2="71" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="var(--logo-bot-1)" /><stop offset="1" stop-color="var(--logo-bot-2)" />
        </linearGradient>
        <linearGradient id="{id}s" x1="0" y1="54" x2="0" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#000" stop-opacity=".22" /><stop offset="1" stop-color="#000" stop-opacity="0" />
        </linearGradient>
      </defs>
      <g transform="translate(50 50) scale(1.15) translate(-50 -53.5)">
        <path d="M29 16H48V35H66V53H29Z" fill="url(#{id}t)" />
        <path d="M29 35H48L62 53H48Z" fill="#000" fill-opacity=".16" />
        <path d="M29 54H48V64A8 8 0 0 0 60.6 70.6L71.5 86A27 27 0 0 1 29 64Z" fill="url(#{id}b)" />
        <path d="M29 54H48V62H29Z" fill="url(#{id}s)" />
      </g>
    </svg>
  </span>
  {#if label}Clocky{/if}
</span>

<style>
  .logo {
    --logo-top-1: #84cc16;
    --logo-top-2: #a3e635;
    --logo-bot-1: #0d9488;
    --logo-bot-2: #14b8a6;
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--f-display);
    font-weight: 700;
    font-size: 1.2rem;
    letter-spacing: -0.02em;
  }

  @media (prefers-color-scheme: dark) {
    .logo {
      --logo-top-1: #14b8a6;
      --logo-top-2: #10b981;
      --logo-bot-1: #a3e635;
      --logo-bot-2: #84cc16;
    }

    .mark {
      border-color: color-mix(in srgb, var(--accent) 55%, transparent) !important;
    }
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
    width: 26px;
    height: 26px;
  }
</style>
