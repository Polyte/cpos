import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { supabase } from './auth';

export { supabase };

const project = projectId || 'tktryrmospxbbuylweui';
const ANON_KEY = publicAnonKey;

// Backend server URL — this points to the Hono edge function (now backed by Turso)
const BASE_URL = `https://${project}.supabase.co/functions/v1/make-server-69ad2d15`;
// Keep the deployed endpoint as the default, but allow local/staging deployments
// to provide their own endpoint without changing source code.
const SERVER_URL = (import.meta.env.VITE_API_URL || BASE_URL).replace(/\/$/, '');

const LOCAL_DEMO_USERS: Record<string, { name: string; role: string; profile: string; merchantId: string | null }> = {
  'admin@roxton.com': { name: 'Clinton Matos', role: 'Admin', profile: 'Retail', merchantId: null },
  'retail.manager@roxton.com': { name: 'Sarah Ndlovu', role: 'Manager', profile: 'Retail', merchantId: 'merchant:M1' },
  'retail.supervisor@roxton.com': { name: 'James Botha', role: 'Supervisor', profile: 'Retail', merchantId: 'merchant:M1' },
  'retail.cashier@roxton.com': { name: 'Thandi Moyo', role: 'Cashier', profile: 'Retail', merchantId: 'merchant:M1' },
  'retail.stock@roxton.com': { name: 'David Patel', role: 'StockController', profile: 'Retail', merchantId: 'merchant:M1' },
  'manager@roxton.com': { name: 'Sarah Ndlovu', role: 'Manager', profile: 'Retail', merchantId: 'merchant:M1' },
  'supervisor@roxton.com': { name: 'James Botha', role: 'Supervisor', profile: 'Retail', merchantId: 'merchant:M1' },
  'cashier@roxton.com': { name: 'Thandi Moyo', role: 'Cashier', profile: 'Retail', merchantId: 'merchant:M1' },
  'fuel.manager@roxton.com': { name: 'Pieter van Wyk', role: 'Manager', profile: 'Forecourt', merchantId: 'merchant:M2' },
  'fuel.supervisor@roxton.com': { name: 'Nomsa Khumalo', role: 'Supervisor', profile: 'Forecourt', merchantId: 'merchant:M2' },
  'fuel.attendant@roxton.com': { name: 'Sipho Dlamini', role: 'Cashier', profile: 'Forecourt', merchantId: 'merchant:M2' },
  'workshop.manager@roxton.com': { name: 'Johan Kruger', role: 'Manager', profile: 'Workshop', merchantId: 'merchant:M3' },
  'workshop.mechanic@roxton.com': { name: 'Bongani Nkosi', role: 'StockController', profile: 'Workshop', merchantId: 'merchant:M3' },
  'workshop.reception@roxton.com': { name: 'Lisa Chen', role: 'Cashier', profile: 'Workshop', merchantId: 'merchant:M3' },
  'chef@roxton.com': { name: 'Marco Rossi', role: 'Manager', profile: 'Restaurant', merchantId: 'merchant:M4' },
  'restaurant.supervisor@roxton.com': { name: 'Ayesha Khan', role: 'Supervisor', profile: 'Restaurant', merchantId: 'merchant:M4' },
  'waiter@roxton.com': { name: 'Luke van der Berg', role: 'Cashier', profile: 'Restaurant', merchantId: 'merchant:M4' },
};

const image = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=640&q=82`;

const LOCAL_DEMO_STOCK = [
  { id: 'P1', merchantId: 'merchant:M1', name: 'Fair Cape UHT Full Cream Milk 1L', category: 'Dairy', selling: 19.95, cost: 15, stock: 100, barcode: '6001234567890', unit: 'Carton', image: image('photo-1550583724-b2692b85b150') },
  { id: 'P2', merchantId: 'merchant:M1', name: 'Sasko Premium Sliced Bread', category: 'Bakery', selling: 19.95, cost: 13, stock: 50, barcode: '6009876543210', unit: 'Loaf', image: image('photo-1509440159596-0249088772ff') },
  { id: 'P5', merchantId: 'merchant:M1', name: 'Nulaid Large Eggs 6-Pack', category: 'Dairy', selling: 34.95, cost: 25, stock: 80, barcode: '6001234567901', unit: 'Pack', image: image('photo-1582722872445-44dc5f7e3c8f') },
  { id: 'P6', merchantId: 'merchant:M1', name: 'Parmalat Processed Cheese 900g', category: 'Dairy', selling: 104.95, cost: 78, stock: 25, barcode: '6001234567902', unit: 'Pack', image: image('photo-1486297678162-eb2a19b0a32d') },
  { id: 'P7', merchantId: 'merchant:M1', name: 'Sparletta Creme Soda 2L', category: 'Beverages', selling: 19.95, cost: 13, stock: 200, barcode: '6001234567903', unit: 'Bottle', image: image('photo-1544145945-f90425340c7e') },
  { id: 'P8', merchantId: 'merchant:M1', name: 'Sunflower Oil 750ml', category: 'Cooking', selling: 39.95, cost: 28, stock: 90, barcode: '6001234567904', unit: 'Bottle', image: image('photo-1474979266404-7eaacbcd87c5') },
  { id: 'P9', merchantId: 'merchant:M1', name: 'Tastic Parboiled Rice 2kg', category: 'Dry Goods', selling: 34.95, cost: 25, stock: 70, barcode: '6001234567905', unit: 'Bag', image: image('photo-1586201375761-83865001e31c') },
  { id: 'P10', merchantId: 'merchant:M1', name: 'OMO Auto Washing Powder 2kg', category: 'Household', selling: 89.95, cost: 65, stock: 45, barcode: '6001234567906', unit: 'Box', image: image('photo-1583947215259-38e31be8751f') },
  { id: 'P11', merchantId: 'merchant:M1', name: 'ARO 1-Ply Toilet Tissue 24-Pack', category: 'Household', selling: 115.95, cost: 82, stock: 55, barcode: '6001234567907', unit: 'Pack', image: image('photo-1584556812952-905ffd0c611a') },
  { id: 'P12', merchantId: 'merchant:M1', name: 'Rainbow Frozen Chicken Portions 2kg', category: 'Meat', selling: 84.99, cost: 62, stock: 40, barcode: '6001234567908', unit: 'Bag', image: image('photo-1604503468506-a8da13d82791') },
  { id: 'P13', merchantId: 'merchant:M1', name: 'Nestlé Milo Malt Drink 500g', category: 'Beverages', selling: 89.95, cost: 67, stock: 45, barcode: '6001234567909', unit: 'Tin', image: image('photo-1544145945-f90425340c7e') },
  { id: 'P14', merchantId: 'merchant:M1', name: 'Freshpak Rooibos Tea 80s', category: 'Beverages', selling: 59.25, cost: 42, stock: 60, barcode: '6001234567910', unit: 'Box', image: image('photo-1544787219-7f47ccb76574') },
  { id: 'P15', merchantId: 'merchant:M1', name: 'Simba Ghost Pops Maize Snack', category: 'Snacks', selling: 12.95, cost: 8, stock: 120, barcode: '6001234567911', unit: 'Bag', image: image('photo-1621939514649-280e2aa2f4a') },
  { id: 'P16', merchantId: 'merchant:M1', name: 'Doritos Sweet Chilli 120g', category: 'Snacks', selling: 20.95, cost: 14, stock: 100, barcode: '6001234567912', unit: 'Bag', image: image('photo-1621447504864-d8686e12698c') },
  { id: 'P3', merchantId: 'merchant:M2', name: '95 Unleaded', category: 'Fuel', selling: 23.4, cost: 18.5, stock: 50000, barcode: 'FUEL-95', unit: 'Litre', image: image('photo-1545454675-3531b543be5d') },
  { id: 'F1', merchantId: 'merchant:M2', name: '93 Unleaded', category: 'Fuel', selling: 22.9, cost: 18.1, stock: 40000, barcode: 'FUEL-93', unit: 'Litre', image: image('photo-1545454675-3531b543be5d') },
  { id: 'F2', merchantId: 'merchant:M2', name: 'Diesel 50ppm', category: 'Fuel', selling: 21.8, cost: 17.2, stock: 60000, barcode: 'FUEL-D50', unit: 'Litre', image: image('photo-1545454675-3531b543be5d') },
  { id: 'F3', merchantId: 'merchant:M2', name: 'Castrol GTX 5W-30 1L', category: 'Lubricants', selling: 189, cost: 130, stock: 50, barcode: 'LUB-CGX-01', unit: 'Bottle', image: image('photo-1530124566582-a618bc2615dc') },
  { id: 'F5', merchantId: 'merchant:M2', name: 'Red Bull Energy Drink 250ml', category: 'Convenience', selling: 19.95, cost: 13, stock: 120, barcode: 'CONV-ED-01', unit: 'Can', image: image('photo-1622543925917-763c34d1a86e') },
  { id: 'F6', merchantId: 'merchant:M2', name: 'Energade Blueberry 500ml', category: 'Convenience', selling: 19.95, cost: 12, stock: 200, barcode: 'CONV-BW-01', unit: 'Bottle', image: image('photo-1564419320461-6870880221ad') },
  { id: 'F7', merchantId: 'merchant:M2', name: 'Steak & Cheese Pie', category: 'Hot Food', selling: 35, cost: 18, stock: 30, barcode: 'HF-PIE-01', unit: 'Each', image: image('photo-1601050690597-df0568f70950') },
  { id: 'F11', merchantId: 'merchant:M2', name: 'Liqui-Fruit Red Grape Juice 300ml', category: 'Convenience', selling: 14.95, cost: 9, stock: 100, barcode: 'CONV-LF-01', unit: 'Bottle', image: image('photo-1544145945-f90425340c7e') },
  { id: 'F12', merchantId: 'merchant:M2', name: 'Simba Original Chips 120g', category: 'Snacks', selling: 22.95, cost: 15, stock: 80, barcode: 'CONV-SM-01', unit: 'Bag', image: image('photo-1621447504864-d8686e12698c') },
  { id: 'F13', merchantId: 'merchant:M2', name: 'Bakers Tennis Biscuits 200g', category: 'Snacks', selling: 25.95, cost: 17, stock: 75, barcode: 'CONV-BK-01', unit: 'Pack', image: image('photo-1558961363-fa8fdf82db35') },
  { id: 'W1', merchantId: 'merchant:M3', name: 'SEB Corolla Spin-on Oil Filter', category: 'Workshop', selling: 120, cost: 65, stock: 30, barcode: 'PART-OF-01', unit: 'Each', image: image('photo-1486262715619-67b85e0b08d3') },
  { id: 'W3', merchantId: 'merchant:M3', name: 'NGK Spark Plug Set (4)', category: 'Workshop', selling: 320, cost: 180, stock: 20, barcode: 'PART-SP-01', unit: 'Set', image: image('photo-1530124566582-a618bc2615dc') },
  { id: 'W7', merchantId: 'merchant:M3', name: 'Ingle 652MF 80Ah Car Battery', category: 'Workshop', selling: 1583, cost: 1100, stock: 6, barcode: 'PART-BAT-01', unit: 'Each', image: image('photo-1609521263047-f8f205293f24') },
  { id: 'W8', merchantId: 'merchant:M3', name: 'Castrol GTX 20W-50 Motor Oil 5L', category: 'Workshop', selling: 599, cost: 420, stock: 12, barcode: 'PART-OIL-01', unit: 'Bottle', image: image('photo-1530124566582-a618bc2615dc') },
  { id: 'W9', merchantId: 'merchant:M3', name: 'Bosch AeroEco Wiper Blade 14in', category: 'Workshop', selling: 230, cost: 160, stock: 18, barcode: 'PART-WIP-01', unit: 'Each', image: image('photo-1530124566582-a618bc2615dc') },
  { id: 'W10', merchantId: 'merchant:M3', name: 'Tolsen Tyre Pressure Gauge 170 PSI', category: 'Workshop', selling: 399, cost: 280, stock: 10, barcode: 'PART-TPG-01', unit: 'Each', image: image('photo-1530124566582-a618bc2615dc') },
  { id: 'R1', merchantId: 'merchant:M4', name: 'Classic Eggs Benedict', category: 'Food', selling: 74, cost: 28, stock: 40, barcode: 'REST-RIB-01', unit: 'Plate', image: image('photo-1544025162-d76694265947') },
  { id: 'R2', merchantId: 'merchant:M4', name: 'Chicken Burger', category: 'Food', selling: 74, cost: 28, stock: 35, barcode: 'REST-PL-01', unit: 'Plate', image: image('photo-1551183053-bf91a1d81141') },
  { id: 'R5', merchantId: 'merchant:M4', name: 'Beef Burger', category: 'Food', selling: 99, cost: 38, stock: 45, barcode: 'REST-BB-01', unit: 'Plate', image: image('photo-1568901346375-23c9450c58cd') },
  { id: 'R6', merchantId: 'merchant:M4', name: 'Smashed Avo & Poached Egg', category: 'Food', selling: 74, cost: 28, stock: 60, barcode: 'REST-MP-01', unit: 'Plate', image: image('photo-1574071318508-1cdbab80d002') },
  { id: 'R9', merchantId: 'merchant:M4', name: 'Bottomless Filter Coffee', category: 'Beverage', selling: 49, cost: 12, stock: 120, barcode: 'REST-CL-01', unit: 'Cup', image: image('photo-1515003197210-e0cd71810b5f') },
  { id: 'R12', merchantId: 'merchant:M4', name: 'Cappuccino', category: 'Beverage', selling: 45, cost: 12, stock: 200, barcode: 'REST-ES-01', unit: 'Cup', image: image('photo-1495474472287-4d71bcdd2085') },
  { id: 'R15', merchantId: 'merchant:M4', name: 'Chicken Mayo Toasted Sandwich', category: 'Food', selling: 68, cost: 25, stock: 35, barcode: 'REST-CS-02', unit: 'Plate', image: image('photo-1544025162-d76694265947') },
  { id: 'R16', merchantId: 'merchant:M4', name: 'Famous Giant Muffin', category: 'Food', selling: 52, cost: 18, stock: 25, barcode: 'REST-MP-02', unit: 'Each', image: image('photo-1551024506-0bccd828d307') },
  { id: 'R17', merchantId: 'merchant:M4', name: 'Rooibos Tea', category: 'Beverage', selling: 30, cost: 8, stock: 120, barcode: 'REST-RT-01', unit: 'Cup', image: image('photo-1544787219-7f47ccb76574') },
  { id: 'R18', merchantId: 'merchant:M4', name: 'Caribbean Mocha', category: 'Beverage', selling: 59, cost: 18, stock: 100, barcode: 'REST-CM-01', unit: 'Cup', image: image('photo-1495474472287-4d71bcdd2085') },
  { id: 'R19', merchantId: 'merchant:M4', name: 'Guava & Grapefruit Fruity Fizz', category: 'Beverage', selling: 66, cost: 20, stock: 80, barcode: 'REST-GF-01', unit: 'Glass', image: image('photo-1544145945-f90425340c7e') },
  { id: 'R20', merchantId: 'merchant:M4', name: 'Triple Chocolate Brownie', category: 'Food', selling: 40, cost: 14, stock: 30, barcode: 'REST-TB-01', unit: 'Each', image: image('photo-1575377427642-087cf684f29d') },
  { id: 'R21', merchantId: 'merchant:M4', name: 'Buffalo Chicken & Blue Cheese Eggs Benedict', category: 'Food', selling: 84, cost: 32, stock: 25, barcode: 'REST-BC-01', unit: 'Plate', image: image('photo-1544025162-d76694265947') },
  { id: 'R22', merchantId: 'merchant:M4', name: 'Muesli & Yoghurt Pot', category: 'Food', selling: 69, cost: 24, stock: 25, barcode: 'REST-MY-01', unit: 'Pot', image: image('photo-1512621776951-a57141f2eefd') },
];

function localDemoLogin(email: string, password: string) {
  if (!import.meta.env.DEV) return null;
  const normalizedEmail = email.trim().toLowerCase();
  const demoUser = LOCAL_DEMO_USERS[normalizedEmail];
  if (!demoUser || password !== 'password123') return null;

  const user = { id: `local-${normalizedEmail}`, email: normalizedEmail, ...demoUser, status: 'Active' };
  return { success: true, token: `local-dev-${btoa(normalizedEmail)}`, user, local: true };
}

function localDemoPayment(payload: any, idempotencyKey: string) {
  const subtotal = (payload.items || []).reduce(
    (sum: number, item: any) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0
  );
  const promoDiscount = Number(payload.promoDiscount) || 0;
  const pointsDiscount = (Number(payload.pointsToRedeem) || 0) * 0.1;
  const taxableAmount = Math.max(0, subtotal - promoDiscount - pointsDiscount);
  const vat = taxableAmount * 0.15;
  const grandTotal = Math.round((taxableAmount + vat) * 100) / 100;
  const tendered = Number(payload.amountTendered) || 0;
  const change = payload.paymentMethod === 'Cash' ? Math.round((tendered - grandTotal) * 100) / 100 : 0;
  const txnId = `LOCAL-${Date.now()}`;
  const date = new Date().toISOString();
  const items = (payload.items || []).map((item: any) => ({
    ...item,
    quantity: Number(item.quantity) || 1,
    lineTotal: (Number(item.price) || 0) * (Number(item.quantity) || 1),
  }));
  const transaction = {
    id: txnId, receiptNo: `RX-LOCAL-${Date.now()}`, merchantId: payload.merchantId,
    amount: grandTotal, subtotal, vat, promoDiscount, pointsDiscount,
    method: payload.paymentMethod, status: 'Approved', items,
    cashierName: payload.cashierName || 'Demo Cashier', terminalId: payload.terminalId || 'POS-LOCAL',
    shiftId: payload.shiftId || null, date, processedAt: date,
    ...(payload.paymentMethod === 'Cash' ? { amountTendered: tendered, change } : {}),
    ...(payload.paymentMethod === 'Card' ? { authCode: 'LOCAL01', cardRef: '****0000' } : {}),
  };
  return {
    success: true,
    transaction,
    receipt: { ...transaction, paymentMethod: payload.paymentMethod, grandTotal, change, date },
    _idempotencyKey: idempotencyKey,
    _local: true,
  };
}

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
    // A local demo session is intentionally self-contained so the UI remains
    // usable when the optional remote backend is unavailable during development.
    if (userId.startsWith('local-')) {
      try {
        const storedUser = localStorage.getItem('clintpos_auth_user');
        return storedUser ? JSON.parse(storedUser) : null;
      } catch {
        return null;
      }
    }
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
      // Do not hide invalid credentials. The fallback is only for an unreachable
      // backend and only accepts the documented demo password.
      const localSession = localDemoLogin(email, password);
      if (localSession) {
        console.warn('[API] Remote auth unavailable; using local demo session.');
        return localSession;
      }
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
      const data = await safeJson(res, []);
      if (import.meta.env.DEV && (!Array.isArray(data) || data.length === 0)) {
        return LOCAL_DEMO_STOCK.filter(item => item.merchantId === merchantId);
      }
      return data;
    } catch (e) {
      console.error('[API] getStock error:', e);
      if (import.meta.env.DEV) return LOCAL_DEMO_STOCK.filter(item => item.merchantId === merchantId);
      return [];
    }
  },
  lookupBarcode: async (barcode: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/product-lookup?barcode=${encodeURIComponent(barcode)}`, {
        headers: await getHeaders()
      }, 15000);
      return await safeJson(res, { success: false, error: 'Barcode lookup failed' });
    } catch (e: any) {
      console.error('[API] barcode lookup error:', e);
      return { success: false, error: e?.message || 'Barcode lookup failed' };
    }
  },
  searchProductCloud: async (query: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/product-cloud?query=${encodeURIComponent(query)}&limit=2000`, {
        headers: await getHeaders()
      });
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] product cloud search error:', e);
      return [];
    }
  },
  getProductCloud: async () => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/product-cloud?limit=2000`, { headers: await getHeaders() });
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] product cloud load error:', e);
      return [];
    }
  },
  enrichProductCloud: async (limit = 100) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/product-cloud/enrich-barcodenest`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ limit })
      }, 120000);
      return await safeJson(res, { success: false, error: 'BarcodeNest enrichment failed' });
    } catch (e: any) {
      console.error('[API] product cloud enrichment error:', e);
      return { success: false, error: e?.message || 'BarcodeNest enrichment failed' };
    }
  },
  importLoyaltyHubCatalog: async (offset = 0, limit = 500) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/product-cloud/import-loyaltyhub-catalog`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ offset, limit }),
      }, 120000);
      return await safeJson(res, { success: false, error: 'LoyaltyHub import failed' });
    } catch (e: any) {
      return { success: false, error: e?.message || 'LoyaltyHub import failed' };
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
    try {
      if (localStorage.getItem('clintpos_auth_token')?.startsWith('local-dev-')) {
        return localDemoPayment(payload, iKey);
      }
    } catch {}
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
        const localToken = (() => {
          try { return localStorage.getItem('clintpos_auth_token')?.startsWith('local-dev-'); } catch { return false; }
        })();
        if (localToken) {
          console.warn('[API] Payment gateway unavailable; completing local demo payment.');
          return localDemoPayment(payload, iKey);
        }
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
  getRestaurantMenu: async (merchantId: string) => {
    try {
      // This is a public QR-menu read. Avoid auth/session headers so mobile
      // browsers do not need a custom-header CORS preflight just to view it.
      const res = await fetchWithTimeout(`${SERVER_URL}/restaurant/menu/${encodeURIComponent(merchantId)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Menu request failed (${res.status})`);
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] getRestaurantMenu error:', e);
      return [];
    }
  },
  submitRestaurantOrder: async (data: { merchantId: string; tableId: string; customerName?: string; items: any[]; notes?: string; paymentMethod?: string }) => {
    const res = await fetchWithTimeout(`${SERVER_URL}/restaurant/orders`, { method: 'POST', headers: await getHeaders(), body: JSON.stringify(data) }, 30000);
    return await safeJson(res, { success: false, error: 'Could not submit order' });
  },
  requestRestaurantPayment: async (orderId: string, paymentMethod: string) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/restaurant/orders/${encodeURIComponent(orderId)}/payment-request`, { method: 'POST', headers: await getHeaders(), body: JSON.stringify({ paymentMethod }) });
      return await safeJson(res, { success: false, error: 'Could not send payment request' });
    } catch (e: any) {
      return { success: false, error: e?.message || 'Could not send payment request' };
    }
  },
  createRestaurantRequest: async (data: { merchantId: string; tableId: string; type: string; note?: string }) => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/restaurant/requests`, { method: 'POST', headers: await getHeaders(), body: JSON.stringify(data) });
      return await safeJson(res, { success: false, error: 'Could not send request' });
    } catch (e: any) {
      return { success: false, error: e?.message || 'Could not send request' };
    }
  },
  getRestaurantOrders: async (merchantId: string, status?: string) => {
    try {
      const query = new URLSearchParams({ merchantId });
      if (status) query.set('status', status);
      const res = await fetchWithTimeout(`${SERVER_URL}/restaurant/orders?${query}`, { headers: await getHeaders() });
      return await safeJson(res, []);
    } catch (e) {
      console.error('[API] getRestaurantOrders error:', e);
      return [];
    }
  },
  approveRestaurantOrder: async (orderId: string) => {
    const res = await fetchWithTimeout(`${SERVER_URL}/restaurant/orders/${encodeURIComponent(orderId)}/approve`, { method: 'POST', headers: await getHeaders() });
    return await safeJson(res, { success: false, error: 'Could not approve order' });
  },
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
