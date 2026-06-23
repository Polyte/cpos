// Roxton POS - Offline Sync Queue Manager
// Handles IndexedDB transaction buffering and automatic sync when online

import { api } from './api';
import {
  getPendingTransactions,
  markSynced,
  markFailed,
  getPendingCount,
  queueTransaction,
  getPendingAuditEvents,
  markAuditSynced,
  type PendingTransaction,
  type LocalAuditEvent
} from './LocalDB';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncAt: Date | null;
  lastError: string | null;
}

type SyncListener = (state: SyncState) => void;

class SyncManagerInstance {
  private syncing = false;
  private forceOffline = false;
  private listeners: SyncListener[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private state: SyncState = {
    status: 'idle',
    pendingCount: 0,
    lastSyncAt: null,
    lastError: null
  };

  constructor() {
    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.onOnline());
      window.addEventListener('offline', () => this.onOffline());
    }
  }

  /** Start periodic sync polling */
  start(intervalMs = 10000) {
    this.stop();
    this.refreshCount();
    this.intervalId = setInterval(() => this.syncPending(), intervalMs);
    // Immediate sync attempt
    this.syncPending();
  }

  /** Stop periodic sync */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Subscribe to state changes */
  subscribe(listener: SyncListener): () => void {
    this.listeners.push(listener);
    listener(this.state); // Emit current state immediately
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit() {
    for (const listener of this.listeners) {
      listener({ ...this.state });
    }
  }

  private async refreshCount() {
    try {
      this.state.pendingCount = await getPendingCount();
      this.emit();
    } catch {
      // IndexedDB not available
    }
  }

  private onOnline() {
    this.state.status = 'idle';
    this.emit();
    // Flush pending transactions
    this.syncPending();
  }

  private onOffline() {
    this.state.status = 'offline';
    this.emit();
  }

  /** Force offline mode for testing/simulation */
  setForceOffline(value: boolean) {
    this.forceOffline = value;
    if (value) {
      this.onOffline();
    } else {
      this.onOnline();
    }
  }

  /** Queue a transaction for offline storage + attempt immediate sync */
  async queue(txn: any): Promise<void> {
    await queueTransaction({
      id: txn.id,
      merchantId: txn.merchantId,
      amount: txn.amount,
      method: txn.method,
      items: txn.items,
      cashierName: txn.cashierName
    });
    await this.refreshCount();

    // If online, attempt immediate sync
    if (this.isOnline()) {
      this.syncPending();
    }
  }

  /** Sync all pending transactions and audit logs to the server */
  async syncPending(): Promise<void> {
    if (this.syncing || !this.isOnline()) return;

    this.syncing = true;
    this.state.status = 'syncing';
    this.emit();

    try {
      const pendingTxns = await getPendingTransactions();
      const pendingAudit = await getPendingAuditEvents();

      if (pendingTxns.length === 0 && pendingAudit.length === 0) {
        this.state.status = 'idle';
        this.state.pendingCount = 0;
        this.syncing = false;
        this.emit();
        return;
      }

      let lastError: string | null = null;

      // 1. Sync Audit Events First (Forensic priority)
      for (const event of pendingAudit) {
        try {
          const res = await api.saveAuditEvent(event);
          if (res.success || res.id) {
            await markAuditSynced(event.id);
          }
        } catch (e: any) {
          console.warn('[Sync] Audit sync failure:', e.message);
        }
      }

      // 2. Sync Transactions
      for (const txn of pendingTxns) {
        try {
          const result = await api.saveTransaction({
            id: txn.id,
            amount: txn.amount,
            method: txn.method,
            items: txn.items,
            merchantId: txn.merchantId,
            cashierName: txn.cashierName,
            offlineQueued: true,
            queuedAt: new Date(txn.timestamp).toISOString()
          });

          if (result.success || result.id) {
            await markSynced(txn.id);
          } else {
            lastError = result.error || 'Unknown server error';
            await markFailed(txn.id, lastError);
          }
        } catch (e: any) {
          lastError = e?.message || 'Network error during sync';
          await markFailed(txn.id, lastError);
        }
      }

      this.state.lastSyncAt = new Date();
      this.state.lastError = lastError;
      this.state.status = lastError ? 'error' : 'idle';
    } catch (e: any) {
      this.state.status = 'error';
      this.state.lastError = e?.message || 'Sync failed';
    } finally {
      this.syncing = false;
      await this.refreshCount();
    }
  }

  /** Get current state snapshot */
  getState(): SyncState {
    return { ...this.state };
  }

  /** Check if we're online */
  isOnline(): boolean {
    if (this.forceOffline) return false;
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }
}

// Singleton
export const syncManager = new SyncManagerInstance();
