<script lang="ts">
  import { Dialog } from 'bits-ui'
  import { onMount } from 'svelte'
  import Icon from '../lib/Icon.svelte'
  import TopBar from '../lib/TopBar.svelte'

  let persisted = $state<boolean | undefined>()
  let usage = $state<string>()

  onMount(async () => {
    persisted = await navigator.storage?.persisted?.()
    const est = await navigator.storage?.estimate?.()
    if (est?.usage !== undefined) usage = `${(est.usage / 1024 / 1024).toFixed(1)} MB`
  })
</script>

<TopBar><h1>Settings</h1></TopBar>

<div class="section">
  <h3>Storage</h3>
  <div class="group">
    <div class="srow">
      <div class="grow"><div class="t">Space used</div></div>
      <span class="mono">{usage ?? 'Unknown'}</span>
    </div>
    <div class="srow">
      <div class="grow">
        <div class="t">Protected from clearing</div>
        <div class="d">The browser won't delete Clocky's data to free up space.</div>
      </div>
      <span>{persisted === undefined ? 'Unknown' : persisted ? 'Yes' : 'No'}</span>
    </div>
  </div>
</div>

<div class="section">
  <h3>About</h3>
  <div class="group">
    <Dialog.Root>
      <Dialog.Trigger class="srow about">
        <Icon name="info" />
        <span class="grow t">About Clocky</span>
        <Icon name="chev" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay class="scrim" />
        <Dialog.Content class="dialog">
          <Dialog.Title class="dialog-title">Clocky</Dialog.Title>
          <Dialog.Description class="muted">A small, personal time tracker. Version {__APP_VERSION__}.</Dialog.Description>
          <Dialog.Close class="btn primary dialog-close">Close</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </div>
</div>

<style>
  :global(.about) {
    width: 100%;
    text-align: left;
    color: var(--ink);
  }

  :global(.about svg) {
    color: var(--ink-3);
  }

  :global(.scrim) {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgb(10 12 18 / 0.45);
  }

  :global(.dialog) {
    position: fixed;
    z-index: 41;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(420px, calc(100vw - 32px));
    padding: 22px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    background: var(--surface);
    border-radius: 22px;
  }

  :global(.dialog-title) {
    font-family: var(--f-display);
    font-size: 1.15rem;
    font-weight: 700;
    margin: 0;
  }

  :global(.dialog [data-dialog-description]) {
    margin: 0;
  }

  :global(.dialog-close) {
    align-self: flex-end;
  }
</style>
