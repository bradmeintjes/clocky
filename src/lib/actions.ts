// Timer actions as the UI uses them: data change plus toast and follow-up sheet.
import { db } from './db'
import { deleteEntry, pauseTimer, restoreEntry, resumeTimer, startTimer, stopTimer, type EntryFields } from './data/entries'
import { ui } from './ui-state.svelte'

async function projectName(id: string) {
  return (await db.projects.get(id))?.name ?? 'project'
}

export async function start(fields: EntryFields) {
  const { stopped } = await startTimer(fields)
  const name = await projectName(fields.projectId)
  ui.showToast(stopped ? `Stopped ${await projectName(stopped.projectId)} and started ${name}` : `Timer started on ${name}`)
}

export async function stop() {
  const e = await stopTimer()
  // Open straight onto the description, so adding proof of work is one step.
  if (e) ui.openEntry(e.id, 'after')
}

export const pause = () => pauseTimer()
export const resume = () => resumeTimer()

export async function remove(id: string) {
  const e = await deleteEntry(id)
  if (e) ui.showToast('Entry deleted', () => restoreEntry(id))
}
