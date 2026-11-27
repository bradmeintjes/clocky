<script lang="ts">
  let { name, color, size = 36 }: { name: string; color: string; size?: number } = $props()
</script>

<span class="swatch" style="--pc:{color};--sz:{size}px" aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>

<style>
  .swatch {
    width: var(--sz);
    height: var(--sz);
    flex: none;
    display: grid;
    place-items: center;
    border-radius: calc(var(--sz) * 0.28);
    background: var(--pc);
    color: #fff;
    font-family: var(--f-display);
    font-weight: 700;
    font-size: calc(var(--sz) * 0.44);
  }
</style>
