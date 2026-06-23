import './app.css'
import { mount } from 'svelte'
import App from './App.svelte'

mount(App, {
  target: document.getElementById('root')!,
})

// Register the offline app-shell service worker (production builds only — the
// Vite dev server serves unhashed modules that must not be cached).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[SW] registration failed:', err)
    })
  })
}
