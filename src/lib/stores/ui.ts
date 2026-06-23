import { writable } from 'svelte/store'

const storedDark = typeof localStorage !== 'undefined'
  ? localStorage.getItem('clint_dark_mode') === 'true'
  : false

export const activeTab = writable('pos')
export const darkMode = writable(storedDark)
export const notifications = writable<any[]>([])
export const terminalLocked = writable(false)
export const showNotifications = writable(false)
export const mobileMenuOpen = writable(false)
export const settingsInitialTab = writable<string | undefined>(undefined)

// Persist darkMode to localStorage
darkMode.subscribe(val => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('clint_dark_mode', String(val))
    document.documentElement.classList.toggle('dark', val)
  }
})
