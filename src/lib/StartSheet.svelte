<script lang="ts">
  import { start } from './actions'
  import Icon from './Icon.svelte'
  import { projects, running, tags } from './queries'
  import { formatHM, workedMs } from './time'
  import ProjectSelect from './ui/ProjectSelect.svelte'
  import Sheet from './ui/Sheet.svelte'
  import TagInput from './ui/TagInput.svelte'
  import { ui } from './ui-state.svelte'

  let projectId = $state<string | undefined>()
  let task = $state('')
  let tagIds = $state<string[]>([])
  let busy = $state(false)

  const run = $derived($running)
  const runName = $derived(run ? $projects?.find((p) => p.id === run.projectId)?.name : '')

  $effect(() => {
    if (!ui.startOpen) return
    projectId = ui.startProjectId ?? $projects?.find((p) => !p.archived)?.id
    task = ''
    tagIds = []
  })

  async function go(ev: SubmitEvent) {
    ev.preventDefault()
    if (!projectId || busy) return
    busy = true
    try {
      await start({ projectId, task, tagIds })
      ui.startOpen = false
    } finally {
      busy = false
    }
  }
</script>

<Sheet bind:open={ui.startOpen} title="Start timer">
  <form id="start-form" class="form" onsubmit={go}>
    {#if run}
      <div class="notice">
        <Icon name="info" />
        <span><b>{runName}</b> is running ({formatHM(workedMs(run, ui.now))}). Starting a new timer stops it first.</span>
      </div>
    {/if}
    <div class="field">
      <label for="st-proj">Project</label>
      <ProjectSelect id="st-proj" bind:value={projectId} />
    </div>
    <div class="field">
      <label for="st-task">Task <span class="muted">(optional)</span></label>
      <input class="input" id="st-task" bind:value={task} placeholder="What are you working on?" autocomplete="off" />
    </div>
    <div class="field">
      <label for="st-tags">Tags</label>
      <TagInput id="st-tags" bind:value={tagIds} tags={$tags ?? []} />
    </div>
    <p class="small muted">You can fill in everything later, including a description.</p>
  </form>
  {#snippet footer()}
    <button class="btn go big" type="submit" form="start-form" disabled={!projectId || busy}>
      <Icon name="play" />
      {run ? 'Stop current and start' : 'Start'}
    </button>
  {/snippet}
</Sheet>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  p {
    margin: 0;
  }
</style>
