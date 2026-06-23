import { BASE_URL, ANON_KEY } from '../utils/constants';
import { getToken, getTerminalId } from './storage';
import * as Network from 'expo-network';

const TIMEOUT = 15000;

async function getHeaders(): Promise<Record<string, string>> {
  const token = (await getToken()) || ANON_KEY;
  const terminalId = await getTerminalId();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Device-Type': 'Handheld',
    'X-Terminal-ID': terminalId,
  };
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw e;
  }
}

async function safeJson(res: Response, fallback: any = null) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    if (fallback !== null) return fallback;
    throw new Error(`Server returned non-JSON response (${res.status})`);
  }
}

export const api = {
  // Check if online
  isOnline: async (): Promise<boolean> => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      return networkState.isConnected === true && networkState.isInternetReachable !== false;
    } catch {
      return true; // Assume online if check fails
    }
  },

  // Health Check
  health: async () => {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/health`, {
        headers: await getHeaders(),
      });
      return await safeJson(res, { status: 'error' });
    } catch {
      return { status: 'error' };
    }
  },

  // Auth
  login: async (email: string, password: string) => {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ email, password }),
      });
      return await safeJson(res, { error: 'Login failed' });
    } catch (e: any) {
      return { error: e?.message || 'Login failed - check network connection' };
    }
  },

  // User Profile
  getUserProfile: async (userId: string) => {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/user/${userId}`, {
        headers: await getHeaders(),
      });
      if (!res.ok) return null;
      return await safeJson(res, null);
    } catch {
      return null;
    }
  },

  // Stock / Products
  getStock: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(
        `${BASE_URL}/stock?merchantId=${merchantId}`,
        { headers: await getHeaders() }
      );
      return await safeJson(res, []);
    } catch {
      return [];
    }
  },

  // Process Payment
  processPayment: async (payload: {
    merchantId: string;
    items: { id: string; name: string; price: number; quantity: number }[];
    paymentMethod: 'Cash' | 'Card' | 'Split';
    amountTendered?: number;
    cashierName?: string;
    terminalId?: string;
    shiftId?: string;
    customerId?: string;
    pointsToRedeem?: number;
    appliedPromotions?: any[];
    promoDiscount?: number;
    idempotencyKey?: string;
  }) => {
    const iKey = payload.idempotencyKey || generateUUID();
    const { idempotencyKey: _ik, ...body } = payload;
    try {
      const headers: any = await getHeaders();
      headers['X-Idempotency-Key'] = iKey;
      const res = await fetchWithTimeout(
        `${BASE_URL}/process-payment`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        },
        25000
      );
      const data = await safeJson(res, { success: false, error: 'No response' });
      if (!res.ok && !data.error) data.error = `Server returned ${res.status}`;
      data._idempotencyKey = iKey;
      return data;
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || 'Payment request failed',
        _idempotencyKey: iKey,
        _retriable: true,
      };
    }
  },

  // Transactions
  getTransactions: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(
        `${BASE_URL}/transactions?merchantId=${merchantId}`,
        { headers: await getHeaders() }
      );
      return await safeJson(res, []);
    } catch {
      return [];
    }
  },

  // Shifts
  startShift: async (userId: string, merchantId: string, userName?: string) => {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/shifts/start`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ userId, merchantId, userName }),
      });
      return await safeJson(res, { success: false });
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  endShift: async (shiftId: string) => {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/shifts/end`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ shiftId }),
      });
      return await safeJson(res, { success: false });
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  getActiveShift: async (userId: string) => {
    try {
      const res = await fetchWithTimeout(
        `${BASE_URL}/shifts/active/${userId}`,
        { headers: await getHeaders() }
      );
      return await safeJson(res, { active: false });
    } catch {
      return { active: false };
    }
  },

  getShiftReport: async (shiftId: string) => {
    try {
      const res = await fetchWithTimeout(
        `${BASE_URL}/shift-report/${encodeURIComponent(shiftId)}`,
        { headers: await getHeaders() }
      );
      return await safeJson(res, null);
    } catch {
      return null;
    }
  },

  // Restaurant: Tables
  getTables: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(
        `${BASE_URL}/tables/${encodeURIComponent(merchantId)}`,
        { headers: await getHeaders() }
      );
      return await safeJson(res, []);
    } catch {
      return [];
    }
  },

  updateTableStatus: async (
    merchantId: string,
    tableId: string,
    data: { status: string; orderId?: string; guestCount?: number; serverName?: string }
  ) => {
    try {
      const res = await fetchWithTimeout(
        `${BASE_URL}/tables/${encodeURIComponent(merchantId)}/${encodeURIComponent(tableId)}/status`,
        {
          method: 'POST',
          headers: await getHeaders(),
          body: JSON.stringify(data),
        }
      );
      return await safeJson(res, { success: false });
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  // KOT (Kitchen Order Tickets)
  createKOT: async (data: {
    merchantId: string;
    tableId?: string;
    tableName?: string;
    items: any[];
    orderType?: string;
    serverName?: string;
    notes?: string;
    guestCount?: number;
  }) => {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/kot`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data),
      });
      return await safeJson(res, { success: false });
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  getKOTs: async (merchantId: string, status?: string) => {
    try {
      const params = new URLSearchParams({ merchantId });
      if (status) params.append('status', status);
      const res = await fetchWithTimeout(`${BASE_URL}/kot?${params.toString()}`, {
        headers: await getHeaders(),
      });
      return await safeJson(res, []);
    } catch {
      return [];
    }
  },

  updateKOTStatus: async (
    kotId: string,
    data: { status?: string; itemIndex?: number; itemStatus?: string }
  ) => {
    try {
      const res = await fetchWithTimeout(
        `${BASE_URL}/kot/${encodeURIComponent(kotId)}/status`,
        {
          method: 'POST',
          headers: await getHeaders(),
          body: JSON.stringify(data),
        }
      );
      return await safeJson(res, { success: false });
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  // Bill
  getTableBill: async (merchantId: string, tableId: string) => {
    try {
      const res = await fetchWithTimeout(
        `${BASE_URL}/bill/${encodeURIComponent(merchantId)}/${encodeURIComponent(tableId)}`,
        { headers: await getHeaders() }
      );
      return await safeJson(res, null);
    } catch {
      return null;
    }
  },

  settleBill: async (data: {
    merchantId: string;
    tableId?: string;
    paymentMethod: string;
    amountTendered?: number;
    tip?: number;
    discount?: number;
    cashierName?: string;
    shiftId?: string;
    lineItems: any[];
    subtotal: number;
    guestCount?: number;
  }) => {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/settle-bill`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data),
      });
      return await safeJson(res, { success: false });
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  // Loyalty
  getLoyaltyProfile: async (identifier: string) => {
    try {
      const res = await fetchWithTimeout(
        `${BASE_URL}/loyalty/${identifier}`,
        { headers: await getHeaders() }
      );
      return await safeJson(res, null);
    } catch {
      return null;
    }
  },

  // Customers
  getCustomers: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(
        `${BASE_URL}/customers?merchantId=${merchantId}`,
        { headers: await getHeaders() }
      );
      return await safeJson(res, []);
    } catch {
      return [];
    }
  },

  // Terminal Ping (heartbeat)
  pingTerminal: async (merchantId: string, terminalData: any) => {
    try {
      const res = await fetchWithTimeout(
        `${BASE_URL}/merchants/${merchantId}/terminals/ping`,
        {
          method: 'POST',
          headers: await getHeaders(),
          body: JSON.stringify(terminalData),
        },
        10000
      );
      return await safeJson(res, { success: false });
    } catch {
      return { success: false };
    }
  },

  // Audit Events
  saveAuditEvent: async (data: any) => {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/audit-events`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data),
      });
      return await safeJson(res, { success: false });
    } catch {
      return { success: false };
    }
  },

  // Refunds
  processRefund: async (data: {
    merchantId: string;
    originalTxnId: string;
    items: any[];
    reason: string;
    refundAmount: number;
    cashierName?: string;
    terminalId?: string;
  }) => {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/refunds`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data),
      });
      return await safeJson(res, { success: false });
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },
};

// Simple UUID generator
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export { generateUUID };
