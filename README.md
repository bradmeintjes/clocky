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

## Google Drive sync

Sign-in is optional: without it Clocky runs local-only. Signing in uses Google Identity Services in the browser (no server) with the `drive.appdata` scope, so Clocky only sees its own hidden folder in your Drive. The OAuth client ID is in `src/lib/sync/auth.ts`; it is public by design.

One-time Google Cloud setup (already done for this deployment):

1. Create a project at console.cloud.google.com and enable the **Google Drive API**.
2. OAuth consent screen: External, Testing mode, add yourself as a test user. Scopes: `.../auth/drive.appdata` and `.../auth/userinfo.email`.
3. Credentials, Create OAuth client ID, type **Web application**. Authorised JavaScript origins: `https://bradmeintjes.github.io` and `http://localhost:5173`. No redirect URIs are needed.

Access tokens last an hour and aren't refreshed silently (that would need a server or a pop-up on every expiry), so when one expires the app shows "Sign in again to sync"; tracking keeps working meanwhile.

How sync works is described in `docs/PLAN.md` section 4. The engine is `src/lib/sync/engine.ts` and is tested against an in-memory Drive.

## Icons

The app icon is a folded-ribbon lowercase "t". Home-screen icons use the dark version (teal top, lime hook on #0B112A); the in-app logo and the favicon follow light and dark mode (the light version is lime over teal on #F8FAFC, master `docs/icon-light.svg`). The master is `docs/icon.svg`. `public/favicon.svg` is the rounded version for browser tabs, and `favicon.ico` is generated from it:

```sh
npx @vite-pwa/assets-generator --preset minimal-2023 public/favicon.svg
```

The PNG icons (`pwa-*.png`, `apple-touch-icon-180x180.png`) are rendered from `docs/icon.svg` at full bleed, since iOS and Android apply their own rounding. `maskable-icon-512x512.png` draws the glyph smaller so it stays inside Android's safe zone. Any SVG-to-PNG tool works; render them after running the command above, which would otherwise overwrite them. `scripts/logo.py` regenerates the SVGs.
