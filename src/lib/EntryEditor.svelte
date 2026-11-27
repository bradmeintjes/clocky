<script lang="ts">
  import { remove } from './actions'
  import { db } from './db'
  import { addManualEntry, updateEntry } from './data/entries'
  import { ValidationError } from './data/projects'
  import { fromFields, toFields, type TimeFields } from './entry-form'
  import Icon from './Icon.svelte'
  import { projects, tags } from './queries'
  import { breakMs, formatHM, MIN, workedMs } from './time'
  import type { Entry } from './types'
  import ProjectSelect from './ui/ProjectSelect.svelte'
  import Sheet from './ui/Sheet.svelte'
  import TagInput from './ui/TagInput.svelte'
  import { ui } from './ui-state.svelte'
  import { clockTime, localZone } from './zone'

  let original = $state<Entry | null>(null)
  let projectId = $state<string | undefined>()
  let task = $state('')
  let description = $state('')
  let tagIds = $state<string[]>([])
  let times = $state<TimeFields>({ date: '', start: '', end: '', breaks: [] })
  let tz = $state(localZone())
  let error = $state('')
  let busy = $state(false)
  let loaded = $state(false)

  const mode = $derived(ui.editorMode)
  const running = $derived(original?.end === null)
  const project = $derived($projects?.find((p) => p.id === projectId))

  // Load the entry (or defaults for a new one) each time the sheet opens.
  $effect(() => {
    if (!ui.editorOpen) {
      loaded = false
      return
    }
    error = ''
    const id = ui.editorEntryId
    if (id) {
      db.entries.get(id).then((e) => {
        if (!e) return
        original = e
        projectId = e.projectId
        task = e.task
        description = e.description
        tagIds = [...e.tagIds]
        tz = e.tz
        times = toFields(e)
        loaded = true
      })
    } else {
      const now = Date.now()
      const end = now - (now % (5 * MIN))
      const zone = localZone()
      original = null
      projectId = ui.editorProjectId ?? $projects?.find((p) => !p.archived)?.id
      task = ''
      description = ''
      tagIds = []
      tz = zone
      times = toFields({ start: end - 60 * MIN, end, breaks: [], tz: zone })
      loaded = true
    }
  })

  // Live preview of the parsed times, for the summary and the manual badge.
  const parsed = $derived.by(() => {
    try {
      return fromFields(times, tz)
    } catch {
      return null
    }
  })
  // Fields show whole minutes, so compare what the user sees, not the stored
  // milliseconds; otherwise every timer entry would look edited.
  const originalFields = $derived(original ? toFields(original) : null)
  const timesEdited = $derived(!!originalFields && JSON.stringify(times) !== JSON.stringify(originalFields))

  /** Parsed times, keeping the exact stored value for any field left as it was. */
  function resolveTimes() {
    const t = fromFields(times, tz)
    const o = original
    const of = originalFields
    if (!o || !of || times.date !== of.date) return t
    if (times.start === of.start) t.start = o.start
    if (times.end !== null && times.end === of.end) t.end = o.end
    t.breaks = t.breaks.map((b, i) => {
      const ob = o.breaks[i]
      const ofb = of.breaks[i]
      if (!ob || !ofb) return b
      return [times.breaks[i].start === ofb.start ? ob[0] : b[0], times.breaks[i].end === ofb.end ? ob[1] : b[1]]
    })
    return t
  }
  const manual = $derived(mode === 'new' || !!original?.manual || timesEdited)
  const preview = $derived(parsed ? { ...parsed, end: parsed.end } : null)
  const worked = $derived(preview ? workedMs(preview, ui.now) : 0)
  const breaks = $derived(preview ? breakMs(preview, ui.now) : 0)

  const title = $derived(mode === 'new' ? 'Add time' : mode === 'after' ? 'Session saved' : running ? 'Running entry' : 'Edit entry')

  // Only offered for stopped entries; a running timer takes breaks with Pause.
  function addBreak() {
    times.breaks.push({ start: times.start, end: times.start })
  }

  async function save(ev?: SubmitEvent) {
    ev?.preventDefault()
    if (busy || !projectId) return
    busy = true
    error = ''
    try {
      const t = resolveTimes()
      if (mode === 'new') {
        if (t.end === null) throw new ValidationError('Enter an end time.')
        await addManualEntry({ projectId, task, description, tagIds, start: t.start, end: t.end, breaks: t.breaks, tz })
      } else if (original) {
        const changes = { projectId, task, description, tagIds, ...(timesEdited ? t : {}) }
        await updateEntry(original.id, changes)
      }
      ui.editorOpen = false
    } catch (e) {
      error = e instanceof ValidationError ? e.message : 'Could not save the entry.'
    } finally {
      busy = false
    }
  }

  async function del() {
    if (!original) return
    ui.editorOpen = false
    await remove(original.id)
  }
</script>

{#snippet coreFields()}
  <div class="field">
    <label for="ed-proj">Project</label>
    <ProjectSelect id="ed-proj" bind:value={projectId} />
  </div>
  <div class="field">
    <label for="ed-task">Task</label>
    <input class="input" id="ed-task" bind:value={task} placeholder="What are you working on?" autocomplete="off" />
  </div>
  <div class="field">
    <label for="ed-tags">Tags</label>
    <TagInput id="ed-tags" bind:value={tagIds} tags={$tags ?? []} />
  </div>
{/snippet}

{#snippet timeFields()}
  <div class="stack">
    <div class="row-between">
      <span class="lbl">Time</span>
      {#if manual}
        <span class="badge-manual" title="Added by hand or times edited">Manual</span>
      {:else if running}
        <span class="badge-live"><span class="pulse"></span>Live</span>
      {:else}
        <span class="small muted">From timer</span>
      {/if}
    </div>
    <div class="grid3">
      <div class="field">
        <label for="ed-date" class="small muted">Date</label>
        <input class="input" type="date" id="ed-date" bind:value={times.date} />
      </div>
      <div class="field">
        <label for="ed-start" class="small muted">Start</label>
        <input class="input mono" id="ed-start" inputmode="numeric" maxlength="5" placeholder="HH:MM" bind:value={times.start} />
      </div>
      <div class="field">
        <label for="ed-end" class="small muted">End</label>
        {#if times.end === null}
          <input class="input" id="ed-end" value="Running" disabled />
        {:else}
          <input class="input mono" id="ed-end" inputmode="numeric" maxlength="5" placeholder="HH:MM" bind:value={times.end} />
        {/if}
      </div>
    </div>
    {#each times.breaks as b, i (i)}
      <div class="brk">
        <span class="ico"><Icon name="coffee" /></span>
        <input class="input mono" inputmode="numeric" maxlength="5" placeholder="HH:MM" aria-label="Break {i + 1} start" bind:value={b.start} />
        <span class="muted">to</span>
        {#if b.end === null}
          <input class="input" value="Now" disabled aria-label="Break {i + 1} end" />
        {:else}
          <input class="input mono" inputmode="numeric" maxlength="5" placeholder="HH:MM" aria-label="Break {i + 1} end" bind:value={b.end} />
        {/if}
        <button type="button" class="iconbtn" aria-label="Remove break {i + 1}" onclick={() => times.breaks.splice(i, 1)}><Icon name="x" /></button>
      </div>
    {/each}
    {#if times.end !== null}
      <button type="button" class="btn ghost sm addbrk" onclick={addBreak}><Icon name="plus" /> Add break</button>
    {/if}
    <div class="summary">
      <span>Worked <b class="mono">{formatHM(worked)}</b></span>
      <span>Breaks <b class="mono">{formatHM(breaks)}</b></span>
      <span class="small muted">Breaks don't count toward worked time.</span>
    </div>
    <p class="small muted">Changing a date or time marks the entry as manual.</p>
  </div>
{/snippet}

{#snippet descField(autofocus: boolean)}
  <div class="field">
    <label for="ed-desc">Description</label>
    <!-- svelte-ignore a11y_autofocus -->
    <textarea class="input" id="ed-desc" bind:value={description} placeholder="What did you get done?" {autofocus}></textarea>
  </div>
{/snippet}

<Sheet bind:open={ui.editorOpen} {title}>
  {#if loaded}
    <form id="entry-form" class="form" onsubmit={save} style="--pc:{project?.color ?? 'var(--accent)'}">
      {#if mode === 'after' && original?.end}
        <div class="notice live">
          <Icon name="check" />
          <span>
            Stopped at <b class="mono">{clockTime(original.end, tz)}</b>. Worked <b class="mono">{formatHM(workedMs(original))}</b>
            on {project?.name}{original.breaks.length
              ? `, with ${original.breaks.length} break${original.breaks.length > 1 ? 's' : ''} left out`
              : ''}. Add a note while it's fresh.
          </span>
        </div>
        {@render descField(true)}
        <details class="more">
          <summary><Icon name="chev" /> Task, tags and times</summary>
          <div class="stack">
            {@render coreFields()}
            {@render timeFields()}
          </div>
        </details>
      {:else}
        {@render coreFields()}
        {@render timeFields()}
        {@render descField(false)}
      {/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </form>
  {/if}
  {#snippet footer()}
    {#if mode === 'new'}
      <button class="btn" type="button" onclick={() => (ui.editorOpen = false)}>Cancel</button>
      <button class="btn primary" type="submit" form="entry-form" disabled={busy}>Add entry</button>
    {:else}
      {#if original && !running}
        <button class="btn danger del" type="button" aria-label="Delete entry" title="Delete entry" onclick={del}><Icon name="trash" /></button>
      {/if}
      <button class="btn primary" type="submit" form="entry-form" disabled={busy}>{mode === 'after' ? 'Done' : 'Save'}</button>
    {/if}
  {/snippet}
</Sheet>

<style>
  .form,
  .stack {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .form {
    gap: 18px;
  }

  textarea.input {
    height: auto;
    min-height: 84px;
    padding: 10px 12px;
    line-height: 1.45;
    resize: vertical;
  }

  .grid3 {
    display: grid;
    grid-template-columns: 1.3fr 1fr 1fr;
    gap: 10px;
  }

  @media (max-width: 380px) {
    .grid3 {
      grid-template-columns: 1fr 1fr;
    }

    .grid3 .field:first-child {
      grid-column: 1 / -1;
    }
  }

  .brk {
    display: grid;
    grid-template-columns: auto 1fr auto 1fr auto;
    gap: 8px;
    align-items: center;
  }

  .ico {
    color: var(--pause);
    display: grid;
  }

  .addbrk {
    align-self: flex-start;
  }

  .summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 16px;
    font-size: 0.875rem;
    color: var(--ink-2);
  }

  .summary b {
    color: var(--ink);
  }

  p {
    margin: 0;
  }

  .notice.live {
    background: var(--live-soft);
  }

  .notice.live :global(svg) {
    color: var(--live);
  }

  details.more {
    border-top: 1px solid var(--line);
    padding-top: 14px;
  }

  details.more summary {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    color: var(--ink-2);
    cursor: pointer;
    list-style: none;
  }

  details.more summary::-webkit-details-marker {
    display: none;
  }

  details.more[open] summary {
    margin-bottom: 14px;
  }

  details.more[open] summary :global(svg) {
    transform: rotate(90deg);
  }

  .del {
    flex: 0 0 auto !important;
  }
</style>
