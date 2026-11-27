<script lang="ts">
  import { projects } from '../queries'

  let { value = $bindable(), id }: { value: string | undefined; id?: string } = $props()

  // Archived projects stay hidden, except the one already selected.
  const options = $derived(($projects ?? []).filter((p) => !p.archived || p.id === value))
</script>

<select class="input" {id} bind:value>
  {#each options as p (p.id)}
    <option value={p.id}>{p.name}{p.archived ? ' (archived)' : ''}</option>
  {/each}
</select>
