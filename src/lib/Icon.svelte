<script lang="ts" module>
  // Stroke icons, 24px grid.
  const paths = {
    clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M10 2h4"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
    export: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    sliders: '<path d="M4 7h9M19 7h1M4 17h3M13 17h7"/><circle cx="16" cy="7" r="2.5"/><circle cx="10" cy="17" r="2.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    chev: '<path d="M9 5l7 7-7 7"/>',
  }
  export type IconName = keyof typeof paths
</script>

<script lang="ts">
  let { name }: { name: IconName } = $props()
</script>

<svg class="i" viewBox="0 0 24 24" aria-hidden="true">{@html paths[name]}</svg>
