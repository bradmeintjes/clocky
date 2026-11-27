<script lang="ts">
  import ColorPicker from './ui/ColorPicker.svelte'
  import Sheet from './ui/Sheet.svelte'
  import Switch from './ui/Switch.svelte'
  import { createProject, suggestColor, updateProject, ValidationError } from './data/projects'
  import { DEFAULT_COLOR } from './palette'
  import type { Project } from './types'

  let {
    open = $bindable(false),
    project = null,
    oncreated,
  }: { open?: boolean; project?: Project | null; oncreated?: (p: Project) => void } = $props()

  let name = $state('')
  let color = $state(DEFAULT_COLOR)
  let archived = $state(false)
  let error = $state('')
  let saving = $state(false)

  // Reset the form each time the sheet opens.
  $effect(() => {
    if (!open) return
    error = ''
    name = project?.name ?? ''
    archived = !!project?.archived
    if (project) color = project.color
    else suggestColor().then((c) => (color = c))
  })

  async function save(ev?: SubmitEvent) {
    ev?.preventDefault()
    if (saving) return
    saving = true
    error = ''
    try {
      if (project) {
        await updateProject(project.id, { name, color, archived })
      } else {
        const created = await createProject({ name, color })
        oncreated?.(created)
      }
      open = false
    } catch (e) {
      error = e instanceof ValidationError ? e.message : 'Could not save the project.'
    } finally {
      saving = false
    }
  }
</script>

<Sheet bind:open title={project ? 'Edit project' : 'New project'}>
  <form id="project-form" class="form" onsubmit={save}>
    <div class="field">
      <label for="pj-name">Name</label>
      <!-- svelte-ignore a11y_autofocus -->
      <input class="input" id="pj-name" bind:value={name} placeholder="e.g. Website redesign" autocomplete="off" autofocus />
    </div>
    <div class="field">
      <span class="lbl">Colour</span>
      <ColorPicker bind:value={color} />
    </div>
    {#if project}
      <div class="switchrow">
        <span>
          <span class="t">Archived</span><br />
          <span class="small muted">Hidden from the project list and pickers. Still exported when it has time in the period.</span>
        </span>
        <Switch bind:checked={archived} label="Archived" />
      </div>
    {/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </form>
  {#snippet footer()}
    <button class="btn" type="button" onclick={() => (open = false)}>Cancel</button>
    <button class="btn primary" type="submit" form="project-form" disabled={saving}>
      {project ? 'Save' : 'Create project'}
    </button>
  {/snippet}
</Sheet>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .t {
    font-weight: 500;
  }
</style>
