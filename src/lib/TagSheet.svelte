<script lang="ts">
  import Sheet from './ui/Sheet.svelte'
  import { ValidationError } from './data/projects'
  import { deleteTag, getOrCreateTag, mergeTags, renameTag } from './data/tags'
  import type { Tag } from './types'

  let {
    open = $bindable(false),
    tag = null,
    tags = [],
    usage = 0,
  }: { open?: boolean; tag?: Tag | null; tags?: Tag[]; usage?: number } = $props()

  let name = $state('')
  let mergeInto = $state('')
  let confirmDelete = $state(false)
  let error = $state('')
  let busy = $state(false)

  const others = $derived(tags.filter((t) => t.id !== tag?.id))
  const uses = $derived(`${usage} entr${usage === 1 ? 'y' : 'ies'}`)

  $effect(() => {
    if (!open) return
    name = tag?.name ?? ''
    mergeInto = ''
    confirmDelete = false
    error = ''
  })

  async function run(action: () => Promise<unknown>) {
    if (busy) return
    busy = true
    error = ''
    try {
      await action()
      open = false
    } catch (e) {
      error = e instanceof ValidationError ? e.message : 'Something went wrong. Try again.'
    } finally {
      busy = false
    }
  }

  function save(ev: SubmitEvent) {
    ev.preventDefault()
    run(() => (tag ? renameTag(tag.id, name) : getOrCreateTag(name)))
  }
</script>

<Sheet bind:open title={tag ? 'Edit tag' : 'New tag'}>
  <form id="tag-form" class="form" onsubmit={save}>
    <div class="field">
      <label for="tg-name">Name</label>
      <!-- svelte-ignore a11y_autofocus -->
      <input class="input" id="tg-name" bind:value={name} placeholder="e.g. design" autocomplete="off" autofocus />
    </div>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </form>

  {#if tag}
    <div class="field">
      <label for="tg-merge">Merge into another tag</label>
      <div class="row">
        <select class="input" id="tg-merge" bind:value={mergeInto} disabled={!others.length}>
          <option value="">{others.length ? 'Choose a tag' : 'No other tags'}</option>
          {#each others as t (t.id)}<option value={t.id}>{t.name}</option>{/each}
        </select>
        <button class="btn" type="button" disabled={!mergeInto || busy} onclick={() => run(() => mergeTags(tag.id, mergeInto))}>
          Merge
        </button>
      </div>
      <span class="small muted">Moves "{tag.name}" on {uses} to the chosen tag, then removes "{tag.name}".</span>
    </div>

    <div class="field">
      {#if confirmDelete}
        <p class="small">Delete "{tag.name}"? It will be removed from {uses}.</p>
        <div class="row">
          <button class="btn" type="button" onclick={() => (confirmDelete = false)}>Keep it</button>
          <button class="btn danger" type="button" disabled={busy} onclick={() => run(() => deleteTag(tag.id))}>Delete tag</button>
        </div>
      {:else}
        <button class="btn danger" type="button" onclick={() => (confirmDelete = true)}>Delete tag</button>
      {/if}
    </div>
  {/if}

  {#snippet footer()}
    <button class="btn" type="button" onclick={() => (open = false)}>Cancel</button>
    <button class="btn primary" type="submit" form="tag-form" disabled={busy}>{tag ? 'Save' : 'Create tag'}</button>
  {/snippet}
</Sheet>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .row {
    display: flex;
    gap: 10px;
  }

  .row .input {
    flex: 1;
  }

  p {
    margin: 0;
  }
</style>
