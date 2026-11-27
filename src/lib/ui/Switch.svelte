<script lang="ts">
  import { Switch } from 'bits-ui'

  let { checked = $bindable(false), label }: { checked?: boolean; label: string } = $props()
</script>

<Switch.Root bind:checked class="switch" aria-label={label}>
  <Switch.Thumb class="switch-thumb" />
</Switch.Root>

<style>
  :global(.switch) {
    position: relative;
    flex: none;
    width: 44px;
    height: 26px;
    border-radius: 13px;
    background: var(--line);
    transition: background 0.15s;
  }

  :global(.switch[data-state='checked']) {
    background: var(--accent);
  }

  :global(.switch-thumb) {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--surface);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.25);
    transition: transform 0.15s;
  }

  :global(.switch-thumb[data-state='checked']) {
    transform: translateX(18px);
  }
</style>
