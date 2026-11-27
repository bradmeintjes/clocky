<script lang="ts">
  import { Dialog } from 'bits-ui'
  import { onMount } from 'svelte'

  let persisted = $state<boolean | undefined>()
  let usage = $state<string>()

  onMount(async () => {
    persisted = await navigator.storage?.persisted?.()
    const est = await navigator.storage?.estimate?.()
    if (est?.usage !== undefined) usage = `${(est.usage / 1024 / 1024).toFixed(1)} MB`
  })
</script>

<h1>Settings</h1>

<section class="card">
  <h2>Storage</h2>
  <dl>
    <dt>Space used</dt>
    <dd>{usage ?? 'Unknown'}</dd>
    <dt>Protected from clearing</dt>
    <dd>{persisted === undefined ? 'Unknown' : persisted ? 'Yes' : 'No'}</dd>
  </dl>
</section>

<Dialog.Root>
  <Dialog.Trigger class="btn about">About Clocky</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay class="overlay" />
    <Dialog.Content class="dialog">
      <Dialog.Title>Clocky</Dialog.Title>
      <Dialog.Description class="muted">A small, personal time tracker. Version {__APP_VERSION__}.</Dialog.Description>
      <Dialog.Close class="btn btn-primary">Close</Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  dl {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    margin: 0;
  }

  dd {
    margin: 0;
  }

  :global(.about) {
    margin-top: var(--space);
  }

  :global(.overlay) {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.4);
  }

  :global(.dialog) {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(400px, calc(100vw - 32px));
    padding: calc(var(--space) * 1.5);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    display: grid;
    gap: var(--space);
  }

  :global(.dialog [data-dialog-title]) {
    font-size: 1.2rem;
    font-weight: 700;
  }

  :global(.dialog [data-dialog-close]) {
    justify-self: end;
  }
</style>
