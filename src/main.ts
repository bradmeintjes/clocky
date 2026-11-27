import { mount } from 'svelte'
import { registerSW } from 'virtual:pwa-register'
import './app.css'
import App from './App.svelte'
import { requestPersistence } from './lib/storage'

registerSW({ immediate: true })
void requestPersistence()

export default mount(App, { target: document.getElementById('app')! })
