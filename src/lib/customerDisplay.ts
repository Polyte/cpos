// Clinton POS - Customer Display Channel
//
// Lightweight pub/sub used to mirror the active cart from the cashier's
// POSInterface to a customer-facing display screen (opened at #/display).
//
// Uses BroadcastChannel for instant same-origin tab-to-tab messaging, and
// mirrors the latest snapshot into localStorage so a display opened *after*
// items were added still hydrates with the current cart.

export interface CustomerDisplayLine {
  id: string;
  name: string;
  quantity: number;
  price: number;
  lineTotal: number;
}

export interface CustomerDisplayState {
  items: CustomerDisplayLine[];
  subtotal: number;
  promoDiscount: number;
  pointsDiscount: number;
  vat: number;
  grandTotal: number;
  customerName: string | null;
  terminalId: string | null;
  status: 'idle' | 'active' | 'paid';
  updatedAt: number;
}

const STORAGE_KEY = 'clintpos_customer_display';
const CHANNEL_NAME = 'clintpos-customer-display';

export const emptyDisplayState: CustomerDisplayState = {
  items: [],
  subtotal: 0,
  promoDiscount: 0,
  pointsDiscount: 0,
  vat: 0,
  grandTotal: 0,
  customerName: null,
  terminalId: null,
  status: 'idle',
  updatedAt: 0,
};

// A single long-lived channel per document. Creating/closing a channel on every
// publish can drop messages before they're delivered, so we keep one open.
let sharedChannel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (sharedChannel) return sharedChannel;
  try {
    sharedChannel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    sharedChannel = null;
  }
  return sharedChannel;
}

/** Publish the latest cart snapshot to any open customer display. */
export function publishDisplayState(state: CustomerDisplayState): void {
  const payload = { ...state, updatedAt: Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
  const channel = getChannel();
  if (channel) channel.postMessage(payload);
}

/** Read the last published snapshot (used to hydrate on display open). */
export function readDisplayState(): CustomerDisplayState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...emptyDisplayState, ...JSON.parse(raw) };
  } catch {}
  return emptyDisplayState;
}

/**
 * Subscribe to live updates. Returns an unsubscribe function.
 * Fires immediately with the persisted snapshot, then on every broadcast
 * (and cross-tab storage events as a fallback).
 */
export function subscribeDisplayState(
  listener: (state: CustomerDisplayState) => void
): () => void {
  listener(readDisplayState());

  const channel = getChannel();
  const onMessage = (e: MessageEvent) => listener(e.data as CustomerDisplayState);
  if (channel) channel.addEventListener('message', onMessage);

  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        listener(JSON.parse(e.newValue) as CustomerDisplayState);
      } catch {}
    }
  };
  window.addEventListener('storage', onStorage);

  return () => {
    if (channel) channel.removeEventListener('message', onMessage);
    window.removeEventListener('storage', onStorage);
  };
}
