// App-wide UI state: which sheet is open, the ticking clock, and the toast.

export type EditorMode = 'edit' | 'after' | 'new'

class Ui {
  /** Current time, ticking every second while a timer runs. */
  now = $state(Date.now())

  startOpen = $state(false)
  startProjectId = $state<string | undefined>()

  editorOpen = $state(false)
  editorEntryId = $state<string | null>(null)
  editorProjectId = $state<string | undefined>()
  editorMode = $state<EditorMode>('edit')

  toast = $state<{ message: string; undo?: () => void; id: number } | null>(null)

  openStart(projectId?: string) {
    this.startProjectId = projectId
    this.startOpen = true
  }

  openEntry(entryId: string, mode: EditorMode = 'edit') {
    this.editorEntryId = entryId
    this.editorMode = mode
    this.editorOpen = true
  }

  newEntry(projectId?: string) {
    this.editorEntryId = null
    this.editorProjectId = projectId
    this.editorMode = 'new'
    this.editorOpen = true
  }

  showToast(message: string, undo?: () => void) {
    const id = Date.now()
    this.toast = { message, undo, id }
    setTimeout(() => {
      if (this.toast?.id === id) this.toast = null
    }, 6000)
  }
}

export const ui = new Ui()
