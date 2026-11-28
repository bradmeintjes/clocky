<script lang="ts">
  import Icon, { type IconName } from './lib/Icon.svelte'
  import Logo from './lib/Logo.svelte'
  import { router } from './lib/router.svelte'
  import EntryEditor from './lib/EntryEditor.svelte'
  import { projects, running } from './lib/queries'
  import StartSheet from './lib/StartSheet.svelte'
  import TimerBar from './lib/TimerBar.svelte'
  import Toast from './lib/Toast.svelte'
  import Welcome from './lib/Welcome.svelte'
  import Nudge from './lib/Nudge.svelte'
  import { sync } from './lib/sync/sync.svelte'
  import { ui } from './lib/ui-state.svelte'
  import Project from './screens/Project.svelte'
  import Projects from './screens/Projects.svelte'
  import Export from './screens/Export.svelte'
  import Settings from './screens/Settings.svelte'

  const tabs: { name: string; label: string; href: string; icon: IconName }[] = [
    { name: 'projects', label: 'Projects', href: '#/projects', icon: 'grid' },
    { name: 'export', label: 'Export', href: '#/export', icon: 'export' },
    { name: 'settings', label: 'Settings', href: '#/settings', icon: 'sliders' },
  ]

  // Tick once a second while a timer runs, so clocks and totals stay live.
  $effect(() => {
    if (!$running) return
    ui.now = Date.now()
    const t = setInterval(() => (ui.now = Date.now()), 1000)
    return () => clearInterval(t)
  })

  const route = $derived(router.route)
  const active = $derived(route.name === 'project' ? 'projects' : route.name)
  const openId = $derived(route.name === 'project' ? route.id : null)
</script>

<!-- iOS draws the status bar text in white over the app (black-translucent), so on the
     light theme the area behind it gets a dark band to keep the clock readable. -->
<div class="statusbar" aria-hidden="true"></div>

<div class="app">
  <aside class="side">
    <div class="side-logo"><Logo /></div>
    <nav aria-label="Main">
      {#each tabs as tab (tab.name)}
        <a href={tab.href} aria-current={route.name === tab.name ? 'page' : undefined}>
          <Icon name={tab.icon} />{tab.label}
        </a>
      {/each}
    </nav>
    {#if $projects?.some((p) => !p.archived)}
      <div class="plist">
        <h3>Projects</h3>
        {#each $projects.filter((p) => !p.archived) as p (p.id)}
          <a class="pitem" href="#/project/{p.id}" aria-current={openId === p.id ? 'page' : undefined}>
            <i style="--pc:{p.color}"></i>{p.name}
            {#if $running?.projectId === p.id}<span class="livedot" title="Timer running"></span>{/if}
          </a>
        {/each}
      </div>
    {/if}
  </aside>

  <main class="main">
    <div class="inner">
      {#if sync.mode === 'google' && sync.status === 'needs-auth'}
        <div class="notice authbanner" role="status">
          <Icon name="cloud" />
          <span class="grow">Sign in again to sync. Tracking keeps working meanwhile.</span>
          <button class="btn sm primary" onclick={() => sync.reauth()} disabled={sync.busy}>Sign in</button>
        </div>
      {/if}
      <TimerBar />
      {#if route.name === 'project'}
        {#key route.id}<Project id={route.id} />{/key}
      {:else if active === 'projects'}
        <Projects />
      {:else if active === 'export'}
        <Export />
      {:else}
        <Settings />
      {/if}
    </div>
  </main>

  <StartSheet />
  <EntryEditor />
  <Toast />
  <Nudge />
  {#if sync.ready && sync.mode === null}<Welcome />{/if}

  <nav class="tabs" aria-label="Main">
    {#each tabs as tab (tab.name)}
      <a href={tab.href} aria-current={active === tab.name ? 'page' : undefined}>
        <Icon name={tab.icon} /><span>{tab.label}</span>
      </a>
    {/each}
  </nav>
</div>

<style>
  .authbanner {
    align-items: center;
    margin-top: 12px;
    background: var(--accent-soft);
  }

  .authbanner :global(svg) {
    color: var(--accent);
  }

  .authbanner .grow {
    flex: 1;
    min-width: 0;
  }

  .app {
    min-height: 100dvh;
  }

  .statusbar {
    display: none;
  }

  :global(html.ios-standalone) .statusbar {
    display: block;
    position: fixed;
    inset: 0 0 auto 0;
    z-index: 50;
    height: env(safe-area-inset-top);
    background: var(--statusbar-bg, transparent);
  }

  .side {
    display: none;
  }

  /* Phone: content, then fixed bottom tabs. */
  .main {
    max-width: 720px;
    margin: 0 auto;
    padding: env(safe-area-inset-top) max(16px, env(safe-area-inset-right))
      calc(var(--tabs-h) + 110px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
  }

  .tabs {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 20;
    display: flex;
    padding: 0 max(8px, env(safe-area-inset-right)) env(safe-area-inset-bottom) max(8px, env(safe-area-inset-left));
    background: var(--surface);
    border-top: 1px solid var(--line);
  }

  .tabs a {
    flex: 1;
    height: var(--tabs-h);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--ink-3);
    text-decoration: none;
  }

  .tabs a[aria-current='page'] {
    color: var(--accent);
  }

  /* Wide screens: sidebar + content. */
  @media (min-width: 960px) {
    .app {
      display: grid;
      grid-template-columns: var(--sidebar-w) 1fr;
    }

    .side {
      position: sticky;
      top: 0;
      height: 100dvh;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: calc(20px + env(safe-area-inset-top)) 14px calc(20px + env(safe-area-inset-bottom))
        max(14px, env(safe-area-inset-left));
      background: var(--surface);
      border-right: 1px solid var(--line);
    }

    .side-logo {
      padding: 4px 10px 18px;
    }

    .side a {
      display: flex;
      align-items: center;
      gap: 12px;
      height: 42px;
      padding: 0 12px;
      border-radius: 10px;
      font-weight: 500;
      color: var(--ink-2);
      text-decoration: none;
    }

    .side a:hover {
      background: var(--surface-2);
    }

    .side nav a[aria-current='page'] {
      background: var(--accent-soft);
      color: var(--accent);
    }

    .plist {
      margin-top: 18px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: auto;
    }

    .plist h3 {
      padding: 0 12px 6px;
    }

    .side .pitem {
      height: 36px;
      gap: 10px;
      border-radius: 8px;
      font-size: 0.875rem;
    }

    .side .pitem[aria-current='page'] {
      background: var(--surface-2);
      color: var(--ink);
      font-weight: 600;
    }

    .livedot {
      width: 7px;
      height: 7px;
      margin-left: auto;
      border-radius: 50%;
      background: var(--live);
    }

    .pitem i {
      width: 10px;
      height: 10px;
      flex: none;
      border-radius: 3px;
      background: var(--pc);
    }

    .tabs {
      display: none;
    }

    .main {
      max-width: none;
      width: 100%;
      padding: env(safe-area-inset-top) max(32px, env(safe-area-inset-right)) 48px 32px;
    }

    .inner {
      max-width: 880px;
      margin: 0 auto;
    }
  }
</style>
