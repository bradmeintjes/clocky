// Hash routes (#/projects, #/export, #/settings), since GitHub Pages has no SPA fallback.

export type Route =
  | { name: 'projects' }
  | { name: 'project'; id: string }
  | { name: 'export' }
  | { name: 'settings' }

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  switch (parts[0]) {
    case 'project':
      return parts[1] ? { name: 'project', id: decodeURIComponent(parts[1]) } : { name: 'projects' }
    case 'export':
      return { name: 'export' }
    case 'settings':
      return { name: 'settings' }
    default:
      return { name: 'projects' }
  }
}
