<script lang="ts">
  import { RadioGroup } from 'bits-ui'
  import Icon from '../Icon.svelte'
  import { PALETTE } from '../palette'

  let { value = $bindable() }: { value: string } = $props()
</script>

<RadioGroup.Root bind:value class="swatches" aria-label="Colour" orientation="horizontal">
  {#each PALETTE as p (p.color)}
    <RadioGroup.Item value={p.color} aria-label={p.name} style="--pc:{p.color}">
      {#snippet children({ checked })}
        {#if checked}<Icon name="check" />{/if}
      {/snippet}
    </RadioGroup.Item>
  {/each}
</RadioGroup.Root>

<style>
  :global(.swatches) {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 10px;
  }

  :global(.swatches [data-radio-group-item]) {
    aspect-ratio: 1;
    border-radius: 12px;
    background: var(--pc);
    color: #fff;
    display: grid;
    place-items: center;
  }

  :global(.swatches [data-state='checked']) {
    box-shadow:
      0 0 0 3px var(--surface),
      0 0 0 5px var(--ink);
  }
</style>
