<script lang="ts">
  // Tag picker: chips for chosen tags, plus a Bits UI combobox that autocompletes
  // from the global tag list and offers "Create tag" when nothing matches.
  import { Combobox } from 'bits-ui'
  import Icon from '../Icon.svelte'
  import { getOrCreateTag } from '../data/tags'
  import { nameKey } from '../data/sync-fields'
  import type { Tag } from '../types'

  let { value = $bindable([]), tags, id }: { value: string[]; tags: Tag[]; id?: string } = $props()

  let query = $state('')
  let open = $state(false)

  const CREATE = 'create:'
  const byId = $derived(new Map(tags.map((t) => [t.id, t])))
  const chosen = $derived(value.map((v) => byId.get(v)).filter((t): t is Tag => !!t))
  const q = $derived(nameKey(query))
  const matches = $derived(tags.filter((t) => !value.includes(t.id) && (!q || nameKey(t.name).includes(q))).slice(0, 8))
  const exact = $derived(tags.some((t) => nameKey(t.name) === q))

  async function onValueChange(next: string[]) {
    const created = next.find((v) => v.startsWith(CREATE))
    if (created) {
      const tag = await getOrCreateTag(created.slice(CREATE.length))
      next = next.filter((v) => v !== created)
      if (!next.includes(tag.id)) next.push(tag.id)
    }
    value = next
    query = ''
  }

  function remove(tagId: string) {
    value = value.filter((v) => v !== tagId)
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Backspace' && !query && value.length) value = value.slice(0, -1)
  }
</script>

<div class="tagbox">
  {#each chosen as t (t.id)}
    <span class="tagchip">
      {t.name}
      <button type="button" aria-label="Remove tag {t.name}" onclick={() => remove(t.id)}><Icon name="x" /></button>
    </span>
  {/each}
  <Combobox.Root type="multiple" {value} {onValueChange} bind:open inputValue={query}>
    <Combobox.Input
      {id}
      class="tag-input"
      placeholder={chosen.length ? 'Add tag' : 'Add tags'}
      autocomplete="off"
      oninput={(e) => {
        query = e.currentTarget.value
        open = true
      }}
      onfocus={() => (open = true)}
      {onkeydown}
    />
    {#if matches.length || (q && !exact)}
      <Combobox.Portal>
        <Combobox.Content class="listbox" sideOffset={6} align="start">
          {#each matches as t (t.id)}
            <Combobox.Item value={t.id} label={t.name} class="option">{t.name}</Combobox.Item>
          {/each}
          {#if q && !exact}
            <Combobox.Item value={CREATE + query.trim()} label={query} class="option create">
              <Icon name="plus" /> Create tag "{query.trim()}"
            </Combobox.Item>
          {/if}
        </Combobox.Content>
      </Combobox.Portal>
    {/if}
  </Combobox.Root>
</div>

<style>
  .tagbox {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 6px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--bg);
  }

  .tagbox:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }

  .tagbox :global(.tag-input) {
    flex: 1;
    min-width: 90px;
    height: 30px;
    padding: 0 6px;
    border: 0;
    background: none;
    outline: none;
  }

  .tagchip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    height: 30px;
    padding: 0 4px 0 10px;
    border-radius: 8px;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .tagchip button {
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    border-radius: 6px;
    color: inherit;
  }

  .tagchip :global(svg) {
    width: 14px;
    height: 14px;
  }

  :global(.listbox) {
    z-index: 60;
    min-width: 200px;
    max-height: 240px;
    overflow: auto;
    padding: 4px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
    box-shadow: var(--shadow);
  }

  :global(.listbox .option) {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 10px;
    border-radius: 8px;
    cursor: pointer;
  }

  :global(.listbox .option[data-highlighted]) {
    background: var(--surface-2);
  }

  :global(.listbox .create) {
    color: var(--accent);
    font-weight: 600;
  }
</style>
