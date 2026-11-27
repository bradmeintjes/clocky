import { mount } from 'svelte'
import { registerSW } from 'virtual:pwa-register'
import './app.css'
import App from './App.svelte'
import { requestPersistence } from './lib/storage'

registerSW({ immediate: true })

// Installed on iOS: the status bar is drawn over the app (see App.svelte).
if ((navigator as Navigator & { standalone?: boolean }).standalone) document.documentElement.classList.add('ios-standalone')
void requestPersistence()

export default mount(App, { target: document.getElementById('app')! })
