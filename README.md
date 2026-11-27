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

The app icon is a white "C" ring with a matte orange dot on black. The master is `docs/icon.svg`. `public/favicon.svg` is the rounded version for browser tabs, and `favicon.ico` is generated from it:

```sh
npx @vite-pwa/assets-generator --preset minimal-2023 public/favicon.svg
```

The PNG icons (`pwa-*.png`, `apple-touch-icon-180x180.png`) are rendered from `docs/icon.svg` at full bleed, since iOS and Android apply their own rounding. `maskable-icon-512x512.png` scales the glyph to 80% so it stays inside Android's safe zone. Any SVG-to-PNG tool works; render them after running the command above, which would otherwise overwrite them.
