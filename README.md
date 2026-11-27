# Clocky

A small, personal time tracker. Track time against a project and task, attach proof of work, and export a clean timesheet.

Live app: https://bradmeintjes.github.io/clocky/

The build plan is in [docs/PLAN.md](docs/PLAN.md).

## Development

Needs Node 22 or later.

```sh
npm install
npm run dev      # http://localhost:5173/clocky/
npm run check    # svelte-check and TypeScript
npm test         # unit tests (Vitest)
npm run build    # production build in dist/
npm run preview  # serve the build, with the service worker
```

Stack: Svelte 5, TypeScript, Vite, Dexie (IndexedDB), Bits UI with plain CSS, and `vite-plugin-pwa`.

## Deployment

Every push to `main` builds the app and deploys it to GitHub Pages (`.github/workflows/deploy.yml`). Pull requests run type checks, unit tests and a build (`.github/workflows/ci.yml`).

One-time setup: in the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.

## Icons

The app icons in `public/` are generated from `public/favicon.svg`:

```sh
npx @vite-pwa/assets-generator --preset minimal-2023 public/favicon.svg
```
