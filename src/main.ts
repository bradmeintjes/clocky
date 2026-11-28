import { mount } from 'svelte'
import { registerSW } from 'virtual:pwa-register'
import './app.css'
import App from './App.svelte'
import { requestPersistence } from './lib/storage'
import { sync } from './lib/sync/sync.svelte'
import { prefs } from './lib/settings.svelte'

registerSW({ immediate: true })

// Installed on iOS: the status bar is drawn over the app (see App.svelte).
if ((navigator as Navigator & { standalone?: boolean }).standalone) document.documentElement.classList.add('ios-standalone')
void requestPersistence()

// System bar colour follows the app's light/dark background.
const dark = matchMedia('(prefers-color-scheme: dark)')
const syncThemeColor = () =>
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark.matches ? '#0b112a' : '#f8fafc')
syncThemeColor()
dark.addEventListener('change', syncThemeColor)

// Preferences first (week start shapes the first screen), then the app and sync.
export default prefs.load().then(() => {
  mount(App, { target: document.getElementById('app')! })
  void sync.init()
})
