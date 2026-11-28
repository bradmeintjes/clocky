<script lang="ts">
  // "Still working?" prompt for a long-running timer (PLAN §5). Measured from the latest
  // start or resume; dismissing keeps it quiet until the next start or resume.
  import { Dialog } from 'bits-ui'
  import { db } from './db'
  import { isPaused, lastResume, stopTimerAt } from './data/entries'
  import { ValidationError } from './data/projects'
  import { projects, running } from './queries'
  import { prefs } from './settings.svelte'
  import { HOUR, formatHM } from './time'
  import { ui } from './ui-state.svelte'
  import { clockTime, dateKey, zonedTime } from './zone'

  const KEY = 'nudge.dismissed'
  let dismissedFor = $state<number | null>(null)
  let notifiedFor: number | null = null
  db.meta.get(KEY).then((m) => (dismissedFor = (m?.value as number) ?? null))

  const r = $derived($running)
  const since = $derived(r && !isPaused(r) ? lastResume(r) : null)
  const threshold = $derived(prefs.value.nudgeHours * HOUR)
  const due = $derived(since !== null && ui.now - since >= threshold && dismissedFor !== since)
  const project = $derived($projects?.find((p) => p.id === r?.projectId))

  let open = $state(false)
  let date = $state('')
  let time = $state('')
  let error = $state('')
  let busy = $state(false)

  // Open once per start/resume, prefilled with the last start or resume plus the threshold.
  let shownFor: number | null = null
  $effect(() => {
    if (!due || !r || since === null) return
    if (shownFor !== since) {
      shownFor = since
      date = dateKey(since + threshold, r.tz)
      time = clockTime(since + threshold, r.tz)
      error = ''
      open = true
    }
  })

  // System notification while the app is in the background, if allowed.
  $effect(() => {
    if (!due || since === null || notifiedFor === since || !prefs.value.notify) return
    if (!document.hidden || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    notifiedFor = since
    const body = `${project?.name ?? 'Your timer'} has been running for ${formatHM(ui.now - since)}. Tap to set an end time.`
    navigator.serviceWorker?.ready
      .then((reg) => reg.showNotification('Still working?', { body, tag: 'clocky-nudge', icon: `${import.meta.env.BASE_URL}pwa-192x192.png` }))
      .catch(() => new Notification('Still working?', { body, tag: 'clocky-nudge' }))
  })

  async function keepGoing() {
    if (since === null) return
    dismissedFor = since
    open = false
    await db.meta.put({ key: KEY, value: since })
  }

  async function stop(ev: SubmitEvent) {
    ev.preventDefault()
    if (!r) return
    error = ''
    const end = zonedTime(date, time, r.tz)
    if (end === null) {
      error = 'Enter a valid date and time.'
      return
    }
    busy = true
    try {
      await stopTimerAt(end)
      open = false
      ui.showToast(`Stopped at ${clockTime(end, r.tz)}`)
    } catch (e) {
      error = e instanceof ValidationError ? e.message : 'Could not stop the timer.'
    } finally {
      busy = false
    }
  }

  // Closing the prompt any other way counts as "keep going".
  function onOpenChange(v: boolean) {
    if (!v && open) void keepGoing()
  }
</script>

<Dialog.Root bind:open {onOpenChange}>
  <Dialog.Portal>
    <Dialog.Overlay class="scrim" />
    <Dialog.Content class="dialog nudge">
      <Dialog.Title class="dialog-title">Still working?</Dialog.Title>
      {#if r && since !== null}
        <Dialog.Description class="muted">
          {project?.name ?? 'Your timer'} has been running for <b class="mono">{formatHM(ui.now - since)}</b>
          since {clockTime(since, r.tz)}. If you stopped earlier, set the end time.
        </Dialog.Description>
        <form class="nudge-form" onsubmit={stop}>
          <div class="field">
            <label for="nd-date">Date</label>
            <input id="nd-date" class="input" type="date" bind:value={date} />
          </div>
          <div class="field">
            <label for="nd-time">End time</label>
            <input id="nd-time" class="input mono" inputmode="numeric" maxlength="5" placeholder="HH:MM" bind:value={time} />
          </div>
          {#if error}<p class="error" role="alert">{error}</p>{/if}
          <p class="small muted">Setting an end time marks the entry as manual.</p>
          <div class="nudge-actions">
            <button type="button" class="btn" onclick={keepGoing}>Keep going</button>
            <button type="submit" class="btn primary" disabled={busy}>Stop at this time</button>
          </div>
        </form>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  .nudge-form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .nudge-form .error,
  .nudge-form .small,
  .nudge-actions {
    grid-column: 1 / -1;
    margin: 0;
  }

  .nudge-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 4px;
  }

  .nudge-actions .btn {
    padding: 0 10px;
  }
</style>
