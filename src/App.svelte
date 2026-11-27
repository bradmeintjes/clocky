<script lang="ts">
  import { router } from './lib/router.svelte'
  import Projects from './screens/Projects.svelte'
  import Export from './screens/Export.svelte'
  import Settings from './screens/Settings.svelte'

  const tabs = [
    { name: 'projects', label: 'Projects', href: '#/projects' },
    { name: 'export', label: 'Export', href: '#/export' },
    { name: 'settings', label: 'Settings', href: '#/settings' },
  ] as const

  const active = $derived(router.route.name === 'project' ? 'projects' : router.route.name)
</script>

<div class="shell">
  <nav class="nav" aria-label="Main">
    <span class="brand">Clocky</span>
    {#each tabs as tab (tab.name)}
      <a href={tab.href} class="tab" aria-current={active === tab.name ? 'page' : undefined}>{tab.label}</a>
    {/each}
  </nav>

  <main class="main">
    {#if active === 'projects'}
      <Projects />
    {:else if active === 'export'}
      <Export />
    {:else}
      <Settings />
    {/if}
  </main>
</div>

<style>
  .shell {
    min-height: 100dvh;
  }

  .main {
    padding: var(--space);
    padding-bottom: calc(var(--nav-h) + var(--space) + env(safe-area-inset-bottom));
    max-width: 760px;
  }

  /* Mobile: bottom navigation. */
  .nav {
    position: fixed;
    inset: auto 0 0 0;
    display: flex;
    height: calc(var(--nav-h) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: var(--surface);
    border-top: 1px solid var(--border);
  }

  .brand {
    display: none;
  }

  .tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    text-decoration: none;
    font-weight: 500;
  }

  .tab[aria-current='page'] {
    color: var(--accent);
  }

  /* Desktop: left sidebar. */
  @media (min-width: 768px) {
    .shell {
      display: grid;
      grid-template-columns: var(--sidebar-w) 1fr;
    }

    .nav {
      position: sticky;
      top: 0;
      inset: auto;
      flex-direction: column;
      height: 100dvh;
      padding: var(--space) 8px;
      gap: 4px;
      border-top: 0;
      border-right: 1px solid var(--border);
    }

    .brand {
      display: block;
      font-weight: 700;
      font-size: 1.2rem;
      padding: 0 12px var(--space);
    }

    .tab {
      flex: 0 0 auto;
      justify-content: flex-start;
      padding: 10px 12px;
      border-radius: var(--radius);
    }

    .tab[aria-current='page'] {
      background: var(--bg);
    }

    .main {
      padding: calc(var(--space) * 2);
    }
  }
</style>
