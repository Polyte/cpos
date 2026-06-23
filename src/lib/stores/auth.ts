import { writable, derived } from 'svelte/store'

export const isAuthenticated = writable(false)
export const userProfile = writable<any>(null)
export const role = writable<string>('Cashier')
export const profile = writable<string>('Retail')
export const activeShift = writable<any>(null)
export const loading = writable(true)
