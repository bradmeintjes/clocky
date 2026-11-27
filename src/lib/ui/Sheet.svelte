<script lang="ts">
  // Bottom sheet on phones, side drawer on wide screens (Bits UI Dialog).
  import { Dialog } from 'bits-ui'
  import type { Snippet } from 'svelte'
  import Icon from '../Icon.svelte'

  let {
    open = $bindable(false),
    title,
    children,
    footer,
  }: { open?: boolean; title: string; children: Snippet; footer?: Snippet } = $props()
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="sheet-scrim" />
    <Dialog.Content class="sheet">
      <div class="sheet-grab"></div>
      <div class="sheet-h">
        <Dialog.Title class="sheet-title">{title}</Dialog.Title>
        <Dialog.Close class="iconbtn" aria-label="Close"><Icon name="x" /></Dialog.Close>
      </div>
      <div class="sheet-b">{@render children()}</div>
      {#if footer}<div class="sheet-f">{@render footer()}</div>{/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  :global(.sheet-scrim) {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgb(10 12 18 / 0.45);
    animation: fade 0.15s;
  }

  :global(.sheet) {
    position: fixed;
    z-index: 41;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: 100%;
    max-width: 640px;
    max-height: 92dvh;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border-radius: 22px 22px 0 0;
    animation: up 0.2s ease-out;
  }

  .sheet-grab {
    width: 40px;
    height: 4px;
    margin: 8px auto 0;
    border-radius: 2px;
    background: var(--line);
  }

  .sheet-h {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 16px 8px;
  }

  :global(.sheet-title) {
    flex: 1;
    margin: 0;
    font-family: var(--f-display);
    font-size: 1.15rem;
    font-weight: 700;
  }

  .sheet-b {
    overflow: auto;
    padding: 4px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .sheet-f {
    display: flex;
    gap: 10px;
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--line);
  }

  .sheet-f :global(.btn) {
    flex: 1;
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  @keyframes up {
    from {
      transform: translate(-50%, 30px);
      opacity: 0.4;
    }
  }

  @keyframes slide {
    from {
      transform: translateX(30px);
      opacity: 0.4;
    }
  }

  @media (min-width: 960px) {
    :global(.sheet) {
      left: auto;
      right: 0;
      top: 0;
      transform: none;
      max-width: 460px;
      max-height: none;
      height: 100dvh;
      border-radius: 0;
      animation: slide 0.2s ease-out;
    }

    .sheet-grab {
      display: none;
    }
  }
</style>
