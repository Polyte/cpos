// Roxton POS - IndexedDB Offline Storage via Dexie.js
// Provides local persistence for transactions, sync queue, and audit trail

import Dexie, { type Table } from 'dexie';

export interface PendingTransaction {
  id: string;
  merchantId: string;
  amount: number;
  method: string;
  items: any[];
  cashierName: string;
  timestamp: number;
  synced: number; // 0 = pending, 1 = synced
  retries: number;
  lastError?: string;
}

export interface SyncLogEntry {
  id: string;
  txnId: string;
  status: 'queued' | 'syncing' | 'synced' | 'failed';
  timestamp: number;
  error?: string;
}

export interface CachedProduct {
  id: string;
  merchantId: string;
  name: string;
  price: number;
  category: string;
  barcode: string;
  cachedAt: number;
}

export interface LocalAuditEvent {
  id: string;
  merchantId: string;
  userId: string;
  action: string;
  category?: string;
  details: any;
  timestamp: string;
  hash: string;
  synced: number; // 0 = pending, 1 = synced
}

class RoxtonDB extends Dexie {
  pendingTransactions!: Table<PendingTransaction, string>;
  syncLog!: Table<SyncLogEntry, string>;
  cachedProducts!: Table<CachedProduct, string>;
  auditTrail!: Table<LocalAuditEvent, string>;

  constructor() {
    super('RoxtonPOS');
    this.version(2).stores({
      pendingTransactions: 'id, merchantId, synced, timestamp',
      syncLog: 'id, txnId, status, timestamp',
      cachedProducts: 'id, merchantId, barcode, cachedAt',
      auditTrail: 'id, merchantId, userId, action, synced, timestamp'
    });
  }
}

export const db = new RoxtonDB();

// Helper functions
export async function queueAuditEvent(event: Omit<LocalAuditEvent, 'synced'>): Promise<void> {
  await db.auditTrail.put({
    ...event,
    synced: 0
  });
}

export async function getPendingAuditEvents(): Promise<LocalAuditEvent[]> {
  return db.auditTrail.where('synced').equals(0).toArray();
}

export async function markAuditSynced(id: string): Promise<void> {
  await db.auditTrail.update(id, { synced: 1 });
}

// Helper functions
export async function getPendingCount(): Promise<number> {
  try {
    return await db.pendingTransactions.where('synced').equals(0).count();
  } catch {
    return 0;
  }
}

export async function queueTransaction(txn: Omit<PendingTransaction, 'synced' | 'retries' | 'timestamp'>): Promise<void> {
  await db.pendingTransactions.put({
    ...txn,
    synced: 0,
    retries: 0,
    timestamp: Date.now()
  });
  await db.syncLog.put({
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    txnId: txn.id,
    status: 'queued',
    timestamp: Date.now()
  });
}

export async function getPendingTransactions(): Promise<PendingTransaction[]> {
  return db.pendingTransactions.where('synced').equals(0).sortBy('timestamp');
}

export async function markSynced(id: string): Promise<void> {
  await db.pendingTransactions.update(id, { synced: 1 });
  await db.syncLog.put({
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    txnId: id,
    status: 'synced',
    timestamp: Date.now()
  });
}

export async function markFailed(id: string, error: string): Promise<void> {
  const txn = await db.pendingTransactions.get(id);
  if (txn) {
    await db.pendingTransactions.update(id, {
      retries: txn.retries + 1,
      lastError: error
    });
  }
  await db.syncLog.put({
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    txnId: id,
    status: 'failed',
    timestamp: Date.now(),
    error
  });
}

export async function getRecentSyncLog(limit = 20): Promise<SyncLogEntry[]> {
  return db.syncLog.orderBy('timestamp').reverse().limit(limit).toArray();
}

export async function cacheProducts(products: CachedProduct[]): Promise<void> {
  await db.cachedProducts.bulkPut(products);
}

export async function getCachedProducts(merchantId: string): Promise<CachedProduct[]> {
  return db.cachedProducts.where('merchantId').equals(merchantId).toArray();
}
