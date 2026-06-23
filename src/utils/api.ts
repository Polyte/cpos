import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { supabase } from './supabaseClient';

export { supabase };

const project = projectId || 'ujgeqvqkvxuhrciketvo';
const ANON_KEY = publicAnonKey;

// Backend server URL — this points to the Hono edge function (now backed by Turso)
const BASE_URL = `https://${project}.supabase.co/functions/v1/make-server-69ad2d15`;
const SERVER_URL = BASE_URL;

// --- Network Monitoring ---
type NetworkEventListener = (event: any) => void;
const networkListeners: Set<NetworkEventListener> = new Set();

export const subscribeToNetworkEvents = (listener: NetworkEventListener) => {
  networkListeners.add(listener);
  return () => networkListeners.delete(listener);
};

const broadcastNetworkEvent = (event: any) => {
  networkListeners.forEach(l => l(event));
};

// Timeout-aware fetch wrapper — prevents indefinite hangs
const DEFAULT_TIMEOUT = 15000;
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT): Promise<Response> {
  // Enhanced forensic logging for TypeError: Failed to fetch
  try {
    if (!navigator.onLine) {
      const offlineErr = new Error(`Browser is offline. Cannot fetch ${url}`);
      (offlineErr as any).isOffline = true;
      broadcastNetworkEvent({ type: 'OFFLINE', url, timestamp: Date.now() });
      throw offlineErr;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      credentials: options.credentials || 'omit'
    });
    
    clearTimeout(timeoutId);
    return res;
  } catch (e: any) {
    const isTimeout = e.name === 'AbortError';
    const isNetworkError = e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError');
    
    const event = {
      type: isTimeout ? 'TIMEOUT' : isNetworkError ? 'NETWORK_FAILURE' : 'UNKNOWN_ERROR',
      url,
      method: options.method || 'GET',
      error: e.message,
      isTimeout,
      isNetworkError,
      isOffline: !navigator.onLine,
      timestamp: Date.now()
    };

    console.error(`[Forensic Fetch Failure]`, event);
    broadcastNetworkEvent(event);
    
    // Enrich error for forensic visibility
    if (isTimeout) {
      throw new Error(`Connection timed out after ${timeoutMs}ms for ${url}`);
    }
    if (isNetworkError) {
      throw new Error(`Network forensic failure: Check CORS or Gateway routing for ${url}. Error: ${e.message}`);
    }
    throw e;
  }
}

// Safe JSON parser — handles HTML error pages from Cloudflare/Supabase 500s
async function safeJson(res: Response, fallback: any = null) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error(`[API] Non-JSON response (${res.status}):`, text.substring(0, 200));
    if (fallback !== null) return fallback;
    throw new Error(`Server returned non-JSON response (${res.status})`);
  }
}

function getStoredToken(): string {
  try { return localStorage.getItem('clintpos_auth_token') || ANON_KEY; } catch { return ANON_KEY; }
}

async function getHeaders() {
  const token = getStoredToken();
  const nodeId = localStorage.getItem('clintpos_node_id') || `NODE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const sessionId = sessionStorage.getItem('clintpos_session_id') || `SESS-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;

  if (!localStorage.getItem('clintpos_node_id')) localStorage.setItem('clintpos_node_id', nodeId);
  if (!sessionStorage.getItem('clintpos_session_id')) sessionStorage.setItem('clintpos_session_id', sessionId);

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Forensic-Node-ID': nodeId,
    'X-Forensic-Session-ID': sessionId,
  };
}

export const api = {
  health: async () => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/health`, { headers: await getHeaders() });
      return await safeJson(res, { status: 'error' });
    } catch (e) {
      console.error('[API] Health check failed:', e);
      return { status: 'error' };
    }
  },

  // Merchants
  getMerchants: async () => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants`, { headers: await getHeaders() });
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] getMerchants error:', e);
      return [];
    }
  },
  createMerchant: async (data: any) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      });
      return await safeJson(res, { error: 'Failed to create merchant' });
    } catch (e) {
      console.error('[API] createMerchant error:', e);
      throw e;
    }
  },
  getTrialStatus: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/trial`, { headers: await getHeaders() });
      return await safeJson(res, null);
    } catch (e) {
      console.error('[API] getTrialStatus error:', e);
      return null;
    }
  },
  getMerchantConfig: async (merchantId: string, type: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/${type}`, { headers: await getHeaders() });
      return await safeJson(res, {});
    } catch (e) {
      console.error('[API] getMerchantConfig error:', e);
      return {};
    }
  },
  updateMerchantConfig: async (merchantId: string, type: string, data: any) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/${type}`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] updateMerchantConfig error:', e);
      throw e;
    }
  },

  // Users
  getUserProfile: async (userId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/user/${userId}`, { headers: await getHeaders() });
      if (!res.ok) return null;
      return await safeJson(res, null);
    } catch (e) {
      console.error('[API] getUserProfile error:', e);
      return null;
    }
  },
  getUsers: async (merchantId?: string) => {
    try {
      const url = merchantId ? `${SERVER_URL}/users?merchantId=${merchantId}` : `${SERVER_URL}/users`;
      const res = await fetchWithTimeout(url, { headers: await getHeaders() });
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] getUsers error:', e);
      return [];
    }
  },
  login: async (email: string, password: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ email, password })
      });
      return await safeJson(res, { error: 'Login failed' });
    } catch (e: any) {
      console.error('[API] login error:', e);
      return { error: e?.message || 'Login failed' };
    }
  },
  signup: async (data: any) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/signup`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      });
      return await safeJson(res, { error: 'Signup failed' });
    } catch (e) {
      console.error('[API] signup error:', e);
      throw e;
    }
  },
  updateUser: async (id: string, data: any) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/users/${id}`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] updateUser error:', e);
      throw e;
    }
  },
  deleteUser: async (id: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/users/${id}`, {
        method: 'DELETE',
        headers: await getHeaders()
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] deleteUser error:', e);
      throw e;
    }
  },

  // Loyalty
  getLoyaltyProfile: async (identifier: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/loyalty/${identifier}`, { headers: await getHeaders() });
      return await safeJson(res, { id: identifier, points: 0, tier: 'Bronze' });
    } catch (e) {
      console.error('[API] getLoyaltyProfile error:', e);
      throw e;
    }
  },
  earnPoints: async (identifier: string, amount: number, merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/loyalty/earn`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ identifier, amount, merchantId })
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] earnPoints error:', e);
      return { success: false };
    }
  },
  redeemPoints: async (identifier: string, points: number, merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/loyalty/redeem`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ identifier, points, merchantId })
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] redeemPoints error:', e);
      return { success: false };
    }
  },

  // Stock & Transactions
  getStock: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/stock?merchantId=${merchantId}`, { headers: await getHeaders() });
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] getStock error:', e);
      return [];
    }
  },
  saveStock: async (data: any) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/stock`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] saveStock error:', e);
      throw e;
    }
  },
  deleteStock: async (merchantId: string, itemId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/stock/${itemId}?merchantId=${merchantId}`, {
        method: 'DELETE',
        headers: await getHeaders()
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] deleteStock error:', e);
      throw e;
    }
  },
  getTransactions: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/transactions?merchantId=${merchantId}`, { headers: await getHeaders() });
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] getTransactions error:', e);
      return [];
    }
  },
  saveTransaction: async (data: any) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/transactions`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] saveTransaction error:', e);
      throw e;
    }
  },

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
    const iKey = payload.idempotencyKey || crypto.randomUUID();
    // Strip idempotencyKey from body (sent as header instead)
    const { idempotencyKey: _ik, ...body } = payload;
    const doAttempt = async (attempt: number): Promise<any> => {
      try {
        const headers: any = await getHeaders();
        headers['X-Idempotency-Key'] = iKey;
        const res = await fetchWithTimeout(`${SERVER_URL}/process-payment`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        }, 25000);
        const data = await safeJson(res, { success: false, error: 'No response from payment server' });
        if (!res.ok && !data.error) {
          data.error = `Server returned ${res.status}`;
        }
        data._idempotencyKey = iKey;
        return data;
      } catch (e: any) {
        // Only retry on network errors (timeout / fetch failure), not business errors
        const isNetwork = e?.name === 'AbortError' || e?.message?.includes('timed out') || e?.message?.includes('Failed to fetch');
        if (isNetwork && attempt < 2) {
          const delay = 1500 * Math.pow(2, attempt) + Math.random() * 500;
          console.warn(`[API] processPayment retry ${attempt + 1}/2 after ${Math.round(delay)}ms — ${e?.message}`);
          await new Promise(r => setTimeout(r, delay));
          return doAttempt(attempt + 1);
        }
        console.error('[API] processPayment error:', e);
        return { success: false, error: e?.message || 'Payment request failed — check network connection', _idempotencyKey: iKey, _retriable: true };
      }
    };
    return doAttempt(0);
  },
  
  getAuditLogs: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/audit-logs`, { headers: await getHeaders() });
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] getAuditLogs error:', e);
      return [];
    }
  },

  // Others
  seed: async () => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/seed`, { method: 'POST', headers: await getHeaders() }, 30000);
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] seed error:', e);
      throw e;
    }
  },
  pingTerminal: async (merchantId: string, terminalData: any) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/terminals/ping`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(terminalData)
      }, 20000);
      return await safeJson(res, { success: false });
    } catch (e: any) {
      // Heartbeat failures are non-critical — log quietly
      console.warn('[API] pingTerminal timeout (non-critical):', e?.message || e);
      return { success: false };
    }
  },
  getNotifications: async () => {
    const url = `${SERVER_URL}/notifications`;
    try {
      const headers = await getHeaders();
      const res = await fetchWithTimeout(url, { 
        headers,
        mode: 'cors',
        credentials: 'omit'
      });
      if (!res.ok) {
        console.warn(`[API] getNotifications returned ${res.status}: ${res.statusText}`);
        return [];
      }
      const data = await safeJson(res, []);
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      // TypeError: Failed to fetch usually means CORS or network error
      console.error(`[API] getNotifications fetch error at ${url}:`, e);
      return [];
    }
  },
  markNotificationRead: async (id: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/notifications/${encodeURIComponent(id)}/read`, {
        method: 'POST',
        headers: await getHeaders(),
        mode: 'cors',
        credentials: 'omit'
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] markNotificationRead error:', e);
      return { success: false };
    }
  },
  getSignedUrl: async (path: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/signed-url`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ path })
      });
      return await safeJson(res, { error: 'Failed to get signed URL' });
    } catch (e) {
      console.error('[API] getSignedUrl error:', e);
      throw e;
    }
  },
  approveMerchant: async (merchantId: string, terminalsCount: number = 1) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/approve-merchant`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ merchantId, terminalsCount })
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] approveMerchant error:', e);
      throw e;
    }
  },
  getTerminals: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/terminals`, { headers: await getHeaders() });
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] getTerminals error:', e);
      return [];
    }
  },
  discoverTerminal: async (merchantId: string, ip: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/terminals/discover`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ ip })
      }, 20000);
      return await safeJson(res, { success: false, error: 'Discovery failed' });
    } catch (e: any) {
      console.error('[API] discoverTerminal error:', e);
      return { success: false, error: e?.message || 'Discovery request failed' };
    }
  },
  batchDiscoverTerminals: async (merchantId: string, startIp: string, endIp: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/terminals/batch-discover`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ startIp, endIp })
      }, 30000);
      return await safeJson(res, { success: false, error: 'Batch discovery failed' });
    } catch (e: any) {
      console.error('[API] batchDiscoverTerminals error:', e);
      return { success: false, error: e?.message || 'Batch discovery request failed' };
    }
  },
  decommissionTerminal: async (merchantId: string, terminalId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/terminals/${terminalId}`, {
        method: 'DELETE',
        headers: await getHeaders(),
      });
      return await safeJson(res, { success: false, error: 'Decommission failed' });
    } catch (e: any) {
      console.error('[API] decommissionTerminal error:', e);
      return { success: false, error: e?.message || 'Decommission request failed' };
    }
  },
  getUsageMetrics: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/usage`, { headers: await getHeaders() });
      return await safeJson(res, null);
    } catch (e: any) {
      console.error('[API] getUsageMetrics error:', e);
      return null;
    }
  },
  updateTerminalFirmware: async (merchantId: string, terminalId: string, targetVersion: string = '5.2.0') => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/terminals/${terminalId}/firmware-update`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ targetVersion })
      }, 20000);
      return await safeJson(res, { success: false, error: 'Firmware update failed' });
    } catch (e: any) {
      console.error('[API] updateTerminalFirmware error:', e);
      return { success: false, error: e?.message || 'Firmware update request failed' };
    }
  },
  replaceTerminal: async (merchantId: string, terminalId: string, replacement: any) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/terminals/${terminalId}/replace`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ replacement })
      }, 20000);
      return await safeJson(res, { success: false, error: 'Replacement failed' });
    } catch (e: any) {
      console.error('[API] replaceTerminal error:', e);
      return { success: false, error: e?.message || 'Terminal replacement request failed' };
    }
  },
  bulkFirmwareUpdate: async (merchantId: string, targetVersion: string = '5.2.0') => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/terminals/bulk-firmware-update`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ targetVersion })
      }, 30000);
      return await safeJson(res, { success: false, error: 'Bulk firmware update failed' });
    } catch (e: any) {
      console.error('[API] bulkFirmwareUpdate error:', e);
      return { success: false, error: e?.message || 'Bulk firmware update request failed' };
    }
  },
  scheduleFirmwareRollout: async (merchantId: string, data: { targetVersion: string; scheduledAt: string; windowMinutes?: number; terminalIds?: string[]; notes?: string }) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/terminals/schedule-firmware`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      }, 20000);
      return await safeJson(res, { success: false, error: 'Schedule failed' });
    } catch (e: any) {
      console.error('[API] scheduleFirmwareRollout error:', e);
      return { success: false, error: e?.message || 'Failed to schedule rollout' };
    }
  },
  getScheduledRollouts: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/terminals/scheduled-rollouts`, { headers: await getHeaders() });
      return await safeJson(res, { success: false, rollouts: [] });
    } catch (e: any) {
      console.error('[API] getScheduledRollouts error:', e);
      return { success: false, rollouts: [] };
    }
  },
  cancelScheduledRollout: async (merchantId: string, rolloutId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/terminals/scheduled-rollouts/${rolloutId}`, {
        method: 'DELETE',
        headers: await getHeaders(),
      });
      return await safeJson(res, { success: false, error: 'Cancel failed' });
    } catch (e: any) {
      console.error('[API] cancelScheduledRollout error:', e);
      return { success: false, error: e?.message || 'Failed to cancel rollout' };
    }
  },
  getTerminalHealth: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/terminals/health`, { headers: await getHeaders() });
      return await safeJson(res, { success: false, terminals: [], summary: null });
    } catch (e: any) {
      console.error('[API] getTerminalHealth error:', e);
      return { success: false, terminals: [], summary: null };
    }
  },
  executeDueRollouts: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/terminals/execute-due-rollouts`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({})
      }, 30000);
      return await safeJson(res, { success: false, executed: 0 });
    } catch (e: any) {
      console.error('[API] executeDueRollouts error:', e);
      return { success: false, executed: 0 };
    }
  },
  getRolloutDetail: async (merchantId: string, rolloutId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/terminals/rollouts/${rolloutId}`, { headers: await getHeaders() });
      return await safeJson(res, { success: false, rollout: null });
    } catch (e: any) {
      console.error('[API] getRolloutDetail error:', e);
      return { success: false, rollout: null };
    }
  },
  getHealthAlertConfig: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/terminals/health-alerts/config`, { headers: await getHeaders() });
      return await safeJson(res, { success: false, config: null });
    } catch (e: any) {
      console.error('[API] getHealthAlertConfig error:', e);
      return { success: false, config: null };
    }
  },
  saveHealthAlertConfig: async (merchantId: string, config: any) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/terminals/health-alerts/config`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(config)
      });
      return await safeJson(res, { success: false });
    } catch (e: any) {
      console.error('[API] saveHealthAlertConfig error:', e);
      return { success: false, error: e?.message };
    }
  },
  getHealthAlerts: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/terminals/health-alerts`, { headers: await getHeaders() });
      return await safeJson(res, { success: false, alerts: [], alertCount: 0 });
    } catch (e: any) {
      console.error('[API] getHealthAlerts error:', e);
      return { success: false, alerts: [], alertCount: 0 };
    }
  },
  retryRollout: async (merchantId: string, rolloutId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/terminals/rollouts/${rolloutId}/retry`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({})
      }, 30000);
      return await safeJson(res, { success: false });
    } catch (e: any) {
      console.error('[API] retryRollout error:', e);
      return { success: false, error: e?.message };
    }
  },
  recordHealthSnapshot: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/terminals/health-snapshot`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({})
      });
      return await safeJson(res, { success: false });
    } catch (e: any) {
      console.error('[API] recordHealthSnapshot error:', e);
      return { success: false };
    }
  },
  getHealthHistory: async (merchantId: string, terminalId?: string, days: number = 7) => {
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (terminalId) params.set('terminalId', terminalId);
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/terminals/health-history?${params}`, { headers: await getHeaders() });
      return await safeJson(res, { success: false, history: [] });
    } catch (e: any) {
      console.error('[API] getHealthHistory error:', e);
      return { success: false, history: [] };
    }
  },
  snoozeTerminal: async (merchantId: string, terminalId: string, durationMinutes: number, reason?: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/terminals/${terminalId}/snooze`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ durationMinutes, reason: reason || '' })
      });
      return await safeJson(res, { success: false });
    } catch (e: any) {
      console.error('[API] snoozeTerminal error:', e);
      return { success: false, error: e?.message };
    }
  },
  unsnoozeTerminal: async (merchantId: string, terminalId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/terminals/${terminalId}/snooze`, {
        method: 'DELETE',
        headers: await getHeaders(),
      });
      return await safeJson(res, { success: false });
    } catch (e: any) {
      console.error('[API] unsnoozeTerminal error:', e);
      return { success: false, error: e?.message };
    }
  },
  getSnoozedTerminals: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/terminals/snoozed`, { headers: await getHeaders() });
      return await safeJson(res, { success: false, snoozed: [] });
    } catch (e: any) {
      console.error('[API] getSnoozedTerminals error:', e);
      return { success: false, snoozed: [] };
    }
  },
  getJobCards: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/job-cards`, { headers: await getHeaders() });
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] getJobCards error:', e);
      return [];
    }
  },
  saveJobCard: async (data: any) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/job-cards`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] saveJobCard error:', e);
      throw e;
    }
  },
  getTickets: async () => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/tickets`, { headers: await getHeaders() });
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] getTickets error:', e);
      return [];
    }
  },
  saveTicket: async (data: any) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/tickets`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] saveTicket error:', e);
      throw e;
    }
  },
  addTicketComment: async (ticketId: string, comment: any) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(comment)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] addTicketComment error:', e);
      throw e;
    }
  },
  updateDocumentStatus: async (merchantId: string, documentPath: string, status: string, reason?: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/update-document-status`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ merchantId, documentPath, status, reason })
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] updateDocumentStatus error:', e);
      throw e;
    }
  },
  downloadAllDocuments: async (merchantId: string) => {
    try {
      const headers = await getHeaders();
      const res = await fetchWithTimeout(`${SERVER_URL}/download-all-documents`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ merchantId })
      }, 60000);
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/zip')) {
        const blob = await res.blob();
        return { success: true, blob };
      }
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] downloadAllDocuments error:', e);
      throw e;
    }
  },
  regeneratePassword: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/regenerate-password`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ merchantId })
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] regeneratePassword error:', e);
      throw e;
    }
  },

  // Shifts
  startShift: async (userId: string, merchantId: string, userName?: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/shifts/start`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ userId, merchantId, userName })
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] startShift error:', e);
      throw e;
    }
  },
  endShift: async (shiftId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/shifts/end`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ shiftId })
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] endShift error:', e);
      throw e;
    }
  },
  getShifts: async (merchantId?: string, userId?: string) => {
    try {
      let url = `${SERVER_URL}/shifts`;
      const params = new URLSearchParams();
      if (merchantId) params.append('merchantId', merchantId);
      if (userId) params.append('userId', userId);
      if (params.toString()) url += `?${params.toString()}`;
      const res = await fetchWithTimeout(url, { headers: await getHeaders() });
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] getShifts error:', e);
      return [];
    }
  },
  getActiveShift: async (userId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/shifts/active/${userId}`, { headers: await getHeaders() });
      return await safeJson(res, { active: false });
    } catch (e) {
      console.error('[API] getActiveShift error:', e);
      return { active: false };
    }
  },
  uploadFile: async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetchWithTimeout(`${SERVER_URL}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getStoredToken()}` },
        body: formData
      }, 60000);
      return await safeJson(res, { error: 'Upload failed' });
    } catch (e) {
      console.error('[API] uploadFile error:', e);
      throw e;
    }
  },
  submitOnboarding: async (data: any) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/onboarding`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] submitOnboarding error:', e);
      throw e;
    }
  },
  applyMerchant: async (data: any) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
        body: JSON.stringify(data)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] applyMerchant error:', e);
      throw e;
    }
  },

  // Forensic Audit Events
  saveAuditEvent: async (data: any) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/audit-events`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] saveAuditEvent error:', e);
      return { success: false };
    }
  },
  getAuditEvents: async (merchantId?: string, category?: string) => {
    try {
      const params = new URLSearchParams();
      if (merchantId) params.append('merchantId', merchantId);
      if (category) params.append('category', category);
      const res = await fetchWithTimeout(`${SERVER_URL}/audit-events?${params.toString()}`, { headers: await getHeaders() });
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] getAuditEvents error:', e);
      return [];
    }
  },

  // Shift Reports
  getShiftReport: async (shiftId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/shift-report/${encodeURIComponent(shiftId)}`, { headers: await getHeaders() });
      return await safeJson(res, null);
    } catch (e) {
      console.error('[API] getShiftReport error:', e);
      return null;
    }
  },

  // Network Swarm
  getNetworkSwarm: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/network-swarm/${encodeURIComponent(merchantId)}`, { headers: await getHeaders() });
      return await safeJson(res, { nodes: [], links: [] });
    } catch (e) {
      console.error('[API] getNetworkSwarm error:', e);
      return { nodes: [], links: [] };
    }
  },

  // --- New Feature APIs ---

  // Refund Processing
  processRefund: async (data: { merchantId: string; originalTxnId: string; items: any[]; reason: string; refundAmount: number; cashierName?: string; terminalId?: string }) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/refunds`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] processRefund error:', e);
      throw e;
    }
  },

  // Stock Alerts
  getStockAlerts: async (merchantId: string, threshold: number = 10) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/stock-alerts?merchantId=${merchantId}&threshold=${threshold}`, { headers: await getHeaders() });
      return await safeJson(res, { alerts: [], count: 0 });
    } catch (e) {
      console.error('[API] getStockAlerts error:', e);
      return { alerts: [], count: 0 };
    }
  },

  // Cash Drawer
  cashDrawer: async (data: { action: 'open' | 'close' | 'reconcile'; merchantId: string; userId?: string; terminalId?: string; amount?: number; notes?: string }) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/cash-drawer`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] cashDrawer error:', e);
      throw e;
    }
  },

  // Report Export
  exportReport: async (merchantId: string, reportType: string, format: string = 'csv') => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/export-report`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ merchantId, reportType, format })
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] exportReport error:', e);
      throw e;
    }
  },

  // Customer Management
  getCustomers: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/customers?merchantId=${merchantId}`, { headers: await getHeaders() });
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] getCustomers error:', e);
      return [];
    }
  },
  saveCustomer: async (data: any) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/customers`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] saveCustomer error:', e);
      throw e;
    }
  },
  getCustomer: async (id: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/customers/${encodeURIComponent(id)}`, { headers: await getHeaders() });
      return await safeJson(res, null);
    } catch (e) {
      console.error('[API] getCustomer error:', e);
      return null;
    }
  },

  // Purchase Orders
  getPurchaseOrders: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/purchase-orders?merchantId=${merchantId}`, { headers: await getHeaders() });
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] getPurchaseOrders error:', e);
      return [];
    }
  },
  savePurchaseOrder: async (data: any) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/purchase-orders`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] savePurchaseOrder error:', e);
      throw e;
    }
  },
  receivePurchaseOrder: async (poId: string, merchantId: string, receivedItems?: any[]) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/purchase-orders/receive`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ poId, merchantId, receivedItems })
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] receivePurchaseOrder error:', e);
      throw e;
    }
  },

  // Z-Report (End of Day)
  getZReport: async (merchantId: string, date?: string) => {
    try {
      const params = new URLSearchParams({ merchantId });
      if (date) params.append('date', date);
      const res = await fetchWithTimeout(`${SERVER_URL}/z-report?${params.toString()}`, { headers: await getHeaders() });
      return await safeJson(res, null);
    } catch (e) {
      console.error('[API] getZReport error:', e);
      return null;
    }
  },

  // Receipt Config
  getReceiptConfig: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/receipt-config/${encodeURIComponent(merchantId)}`, { headers: await getHeaders() });
      return await safeJson(res, null);
    } catch (e) {
      console.error('[API] getReceiptConfig error:', e);
      return null;
    }
  },
  saveReceiptConfig: async (merchantId: string, data: any) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/receipt-config/${encodeURIComponent(merchantId)}`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] saveReceiptConfig error:', e);
      throw e;
    }
  },

  // SSE Stream URL builder for audit events
  // Note: EventSource doesn't support custom headers, so we pass auth as a query param
  getAuditStreamUrl: async (merchantId?: string, category?: string) => {
    const params = new URLSearchParams();
    if (merchantId) params.append('merchantId', merchantId);
    if (category && category !== 'ALL') params.append('category', category);
    params.append('since', new Date(Date.now() - 30000).toISOString());
    params.append('token', getStoredToken());
    return `${SERVER_URL}/audit-events/stream?${params.toString()}`;
  },

  // Close Day (End-of-Day Wizard)
  getOpenShifts: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/close-day/open-shifts?merchantId=${encodeURIComponent(merchantId)}`, { headers: await getHeaders() });
      return await safeJson(res, { shifts: [] });
    } catch (e) {
      console.error('[API] getOpenShifts error:', e);
      return { shifts: [] };
    }
  },
  forceCloseShifts: async (merchantId: string, closedBy: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/close-day/force-close-shifts`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ merchantId, closedBy })
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] forceCloseShifts error:', e);
      throw e;
    }
  },
  saveZReportSnapshot: async (data: any) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/z-report/snapshot`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] saveZReportSnapshot error:', e);
      throw e;
    }
  },
  getZReportSnapshots: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/z-report/snapshots?merchantId=${encodeURIComponent(merchantId)}`, { headers: await getHeaders() });
      return await safeJson(res, { snapshots: [] });
    } catch (e) {
      console.error('[API] getZReportSnapshots error:', e);
      return { snapshots: [] };
    }
  },
  verifySupervisorPin: async (supervisorId: string, pin: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/verify-supervisor-pin`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ supervisorId, pin })
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] verifySupervisorPin error:', e);
      throw e;
    }
  },

  // --- Restaurant: Tables ---
  getTables: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/tables/${encodeURIComponent(merchantId)}`, { headers: await getHeaders() });
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] getTables error:', e);
      return [];
    }
  },
  saveTables: async (merchantId: string, tables: any[]) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/tables/${encodeURIComponent(merchantId)}`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(tables)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] saveTables error:', e);
      throw e;
    }
  },
  updateTableStatus: async (merchantId: string, tableId: string, data: { status: string; orderId?: string; guestCount?: number; serverName?: string }) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/tables/${encodeURIComponent(merchantId)}/${encodeURIComponent(tableId)}/status`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] updateTableStatus error:', e);
      throw e;
    }
  },

  // --- Admin: Cross-Tenant Dashboard ---
  getAdminDashboard: async () => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/admin/cross-tenant-dashboard`, { headers: await getHeaders() }, 60000);
      return await safeJson(res, null);
    } catch (e) {
      console.error('[API] getAdminDashboard error:', e);
      return null;
    }
  },

  // --- Restaurant: Kitchen Order Tickets ---
  createKOT: async (data: { merchantId: string; tableId?: string; tableName?: string; items: any[]; orderType?: string; serverName?: string; notes?: string; guestCount?: number }) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/kot`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] createKOT error:', e);
      throw e;
    }
  },
  getKOTs: async (merchantId: string, status?: string) => {
    try {
      const params = new URLSearchParams({ merchantId });
      if (status) params.append('status', status);
      const res = await fetchWithTimeout(`${SERVER_URL}/kot?${params.toString()}`, { headers: await getHeaders() });
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] getKOTs error:', e);
      return [];
    }
  },
  updateKOTStatus: async (kotId: string, data: { status?: string; itemIndex?: number; itemStatus?: string }) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/kot/${encodeURIComponent(kotId)}/status`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] updateKOTStatus error:', e);
      throw e;
    }
  },

  // --- Restaurant: Bill ---
  getTableBill: async (merchantId: string, tableId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/bill/${encodeURIComponent(merchantId)}/${encodeURIComponent(tableId)}`, { headers: await getHeaders() });
      return await safeJson(res, null);
    } catch (e) {
      console.error('[API] getTableBill error:', e);
      return null;
    }
  },
  settleBill: async (data: {
    merchantId: string; tableId?: string; paymentMethod: string;
    amountTendered?: number; tip?: number; discount?: number;
    cashierName?: string; shiftId?: string; lineItems: any[];
    subtotal: number; guestCount?: number;
  }) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/settle-bill`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] settleBill error:', e);
      throw e;
    }
  },

  // --- Restaurant: Split Bill ---
  splitBill: async (data: {
    merchantId: string; tableId?: string; splits: any[];
    tip?: number; discount?: number; cashierName?: string;
    shiftId?: string; lineItems: any[]; subtotal: number;
    guestCount?: number; splitMethod?: string;
  }) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/split-bill`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] splitBill error:', e);
      throw e;
    }
  },

  // --- Admin: Cross-Tenant Export ---
  exportCrossTenantReport: async (data: {
    format: 'csv' | 'pdf'; dateFrom?: string; dateTo?: string;
    tenantFilter?: string; reportType?: string;
  }) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/admin/export-report`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      }, 30000);
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] exportCrossTenantReport error:', e);
      throw e;
    }
  },

  // --- Admin: SSE Live Stream URL ---
  getLiveStreamUrl: async () => {
    const params = new URLSearchParams();
    params.append('since', new Date(Date.now() - 60000).toISOString());
    params.append('token', getStoredToken());
    return `${SERVER_URL}/admin/live-stream?${params.toString()}`;
  },

  // --- Device Management ---
  setKV: async (key: string, value: any) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/kv`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ key, value })
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] setKV error:', e);
      throw e;
    }
  },

  getDevices: async () => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/devices`, { headers: await getHeaders() });
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] getDevices error:', e);
      return [];
    }
  },

  migrateUserPins: async () => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/migrate-user-pins`, {
        method: 'POST',
        headers: await getHeaders()
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] migrateUserPins error:', e);
      throw e;
    }
  },

  // --- Applications (Admin) ---
  getApplications: async () => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/applications`, { headers: await getHeaders() });
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] getApplications error:', e);
      return [];
    }
  },
  getApplication: async (id: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/applications/${encodeURIComponent(id)}`, { headers: await getHeaders() });
      return await safeJson(res, null);
    } catch (e) {
      console.error('[API] getApplication error:', e);
      return null;
    }
  },
  rejectApplication: async (id: string, reason: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/applications/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ reason })
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] rejectApplication error:', e);
      throw e;
    }
  },
  approveApplication: async (id: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/applications/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        headers: await getHeaders()
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] approveApplication error:', e);
      throw e;
    }
  },

  // --- Batches (Settlement) ---
  getBatches: async (merchantId?: string) => {
    try {
      const params = merchantId ? `?merchantId=${merchantId}` : '';
      const res = await fetchWithTimeout(`${SERVER_URL}/batches${params}`, { headers: await getHeaders() });
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] getBatches error:', e);
      return [];
    }
  },

  // --- Email Notification Queue ---
  getEmailNotifications: async () => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/email-notifications`, { headers: await getHeaders() });
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] getEmailNotifications error:', e);
      return [];
    }
  },

  // --- Batch Settlement ---
  settleBatch: async (batchId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/batches/settle`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ batchId })
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] settleBatch error:', e);
      throw e;
    }
  },

  // --- Billing ---
  getBillingPlans: async () => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/billing/plans`, { headers: await getHeaders() });
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] getBillingPlans error:', e);
      return [];
    }
  },

  getBillingSubscriptions: async (merchantId?: string) => {
    try {
      const params = merchantId ? `?merchantId=${encodeURIComponent(merchantId)}` : '';
      const res = await fetchWithTimeout(`${SERVER_URL}/billing/subscriptions${params}`, { headers: await getHeaders() });
      return await safeJson(res, merchantId ? null : []);
    } catch (e) {
      console.error('[API] getBillingSubscriptions error:', e);
      return merchantId ? null : [];
    }
  },

  createSubscription: async (merchantId: string, planId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/billing/subscriptions`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ merchantId, planId })
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] createSubscription error:', e);
      throw e;
    }
  },

  cancelSubscription: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/billing/cancel`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ merchantId })
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] cancelSubscription error:', e);
      throw e;
    }
  },

  cancelSubscriptionWithReason: async (merchantId: string, data: { reason: string; feedback: string; acceptRetention?: boolean }) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/billing/cancel-with-reason`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ merchantId, ...data })
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] cancelSubscriptionWithReason error:', e);
      throw e;
    }
  },

  getBillingInvoices: async (merchantId?: string) => {
    try {
      const params = merchantId ? `?merchantId=${encodeURIComponent(merchantId)}` : '';
      const res = await fetchWithTimeout(`${SERVER_URL}/billing/invoices${params}`, { headers: await getHeaders() });
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] getBillingInvoices error:', e);
      return [];
    }
  },

  // --- Billing: Downgrade & Cancellation Flow ---
  downgradePreview: async (merchantId: string, newPlanId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/billing/downgrade-preview`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ merchantId, newPlanId })
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] downgradePreview error:', e);
      return { success: false, error: (e as any)?.message };
    }
  },

  downgradePlan: async (merchantId: string, newPlanId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/billing/downgrade`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ merchantId, newPlanId })
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] downgradePlan error:', e);
      throw e;
    }
  },

  cancelPreview: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/billing/cancel-preview`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ merchantId })
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] cancelPreview error:', e);
      return { success: false, error: (e as any)?.message };
    }
  },

  cancelWithReason: async (merchantId: string, data: { reason: string; feedback?: string; cancelImmediately?: boolean; acceptRetention?: boolean }) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/billing/cancel-with-reason`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ merchantId, ...data })
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] cancelWithReason error:', e);
      throw e;
    }
  },

  reverseCancellation: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/billing/cancel-reverse`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ merchantId })
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] reverseCancellation error:', e);
      throw e;
    }
  },

  // --- Alert Webhooks ---
  getAlertWebhooks: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/alert-webhooks`, { headers: await getHeaders() });
      return await safeJson(res, { success: false, webhooks: [] });
    } catch (e) {
      console.error('[API] getAlertWebhooks error:', e);
      return { success: false, webhooks: [] };
    }
  },

  createAlertWebhook: async (merchantId: string, data: { name: string; url: string; type: string; severityFilter?: string[]; headers?: Record<string, string>; enabled?: boolean }) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/alert-webhooks`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] createAlertWebhook error:', e);
      throw e;
    }
  },

  updateAlertWebhook: async (merchantId: string, webhookId: string, data: any) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/alert-webhooks/${webhookId}`, {
        method: 'PUT',
        headers: await getHeaders(),
        body: JSON.stringify(data)
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] updateAlertWebhook error:', e);
      throw e;
    }
  },

  deleteAlertWebhook: async (merchantId: string, webhookId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/alert-webhooks/${webhookId}`, {
        method: 'DELETE',
        headers: await getHeaders(),
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] deleteAlertWebhook error:', e);
      throw e;
    }
  },

  testAlertWebhook: async (merchantId: string, webhookId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${merchantId}/alert-webhooks/${webhookId}/test`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({})
      }, 20000);
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] testAlertWebhook error:', e);
      return { success: false, error: (e as any)?.message };
    }
  },

  // --- Merchant Status & Export ---
  updateMerchantStatus: async (merchantId: string, status: string, reason?: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${encodeURIComponent(merchantId)}/status`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ status, reason })
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] updateMerchantStatus error:', e);
      throw e;
    }
  },

  exportMerchantData: async (merchantId: string, type: string, format: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${encodeURIComponent(merchantId)}/export`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ type, format })
      }, 30000);
      
      if (format === 'csv') {
        // Return the blob for CSV
        const blob = await res.blob();
        return { success: true, blob, filename: `${merchantId}_${type}_${new Date().toISOString().split('T')[0]}.csv` };
      } else {
        return await safeJson(res, { success: false });
      }
    } catch (e) {
      console.error('[API] exportMerchantData error:', e);
      throw e;
    }
  },

  // --- Google Places Autocomplete ---
  placesAutocomplete: async (input: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/places/autocomplete?input=${encodeURIComponent(input)}`, { headers: await getHeaders() });
      return await safeJson(res, { predictions: [] });
    } catch (e) {
      console.error('[API] placesAutocomplete error:', e);
      return { predictions: [] };
    }
  },

  placeDetails: async (placeId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/places/details?place_id=${encodeURIComponent(placeId)}`, { headers: await getHeaders() });
      return await safeJson(res, null);
    } catch (e) {
      console.error('[API] placeDetails error:', e);
      return null;
    }
  },

  // --- Printer Management ---
  getPrinters: async (merchantId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${encodeURIComponent(merchantId)}/printers`, { headers: await getHeaders() });
      return await safeJson(res, { success: false, printers: [] });
    } catch (e) {
      console.error('[API] getPrinters error:', e);
      return { success: false, printers: [] };
    }
  },
  createPrinter: async (merchantId: string, data: any) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${encodeURIComponent(merchantId)}/printers`, {
        method: 'POST', headers: await getHeaders(), body: JSON.stringify(data),
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] createPrinter error:', e);
      return { success: false, error: 'Network error' };
    }
  },
  updatePrinter: async (merchantId: string, printerId: string, data: any) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${encodeURIComponent(merchantId)}/printers/${encodeURIComponent(printerId)}`, {
        method: 'PUT', headers: await getHeaders(), body: JSON.stringify(data),
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] updatePrinter error:', e);
      return { success: false, error: 'Network error' };
    }
  },
  deletePrinter: async (merchantId: string, printerId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${encodeURIComponent(merchantId)}/printers/${encodeURIComponent(printerId)}`, {
        method: 'DELETE', headers: await getHeaders(),
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] deletePrinter error:', e);
      return { success: false, error: 'Network error' };
    }
  },
  testPrinter: async (merchantId: string, printerId: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/merchants/${encodeURIComponent(merchantId)}/printers/${encodeURIComponent(printerId)}/test`, {
        method: 'POST', headers: await getHeaders(),
      });
      return await safeJson(res, { success: false });
    } catch (e) {
      console.error('[API] testPrinter error:', e);
      return { success: false, error: 'Network error' };
    }
  },
};