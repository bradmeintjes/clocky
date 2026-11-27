<script lang="ts">
  import type { Snippet } from 'svelte'
  import Logo from './Logo.svelte'

  let { children }: { children: Snippet } = $props()
</script>

<div class="topbar">
  <span class="logo"><Logo label={false} /></span>
  <div class="title">{@render children()}</div>
</div>

<style>
  .topbar {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 56px;
    padding-block: 14px 6px;
  }

  .title {
    flex: 1;
    min-width: 0;
  }

  @media (min-width: 960px) {
    .topbar {
      padding-top: 24px;
    }

    .logo {
      display: none;
    }
  }
</style>
