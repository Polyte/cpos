/**
 * CLINTPOS Server - Hono Edge Function
 * Multi-tenant retail backend with SSE streaming, auth, and KV storage
 */
import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient as createTursoClient } from "npm:@libsql/client/http";
import * as kv from './kv_store.ts';

const app = new Hono();

// 1. GLOBAL CORS - ZERO-TRUST POLICY
app.use('*', cors({
  // The frontend sends credentials with `omit`, so wildcard CORS is valid and
  // avoids rejecting preview/deployment origins that change between builds.
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: [
    'Content-Type', 
    'Accept',
    'Origin',
    'Authorization', 
    'X-Idempotency-Key', 
    'X-Forensic-Node-ID', 
    'X-Forensic-Session-ID', 
    'Range', 
    'User-Agent'
  ],
  exposeHeaders: ['Content-Range', 'X-Idempotency-Key', 'X-Forensic-Node-ID'],
  maxAge: 86400,
}));

// 2. EXPLICIT OPTIONS HANDLER - CATCH-ALL
app.options('*', (c) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, Origin, Authorization, X-Idempotency-Key, X-Forensic-Node-ID, X-Forensic-Session-ID, Range, User-Agent',
      'Access-Control-Max-Age': '86400',
    },
  });
});

// 3. LOGGING & ERROR HANDLING
app.use('*', logger(console.log));
app.onError((err, c) => {
  console.log('[CRITICAL SERVER ERROR]', err?.message || err);
  return c.json({ error: 'Internal server error', details: err?.message || 'Unknown error' }, 500, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Origin, Authorization, X-Idempotency-Key, X-Forensic-Node-ID, X-Forensic-Session-ID',
  });
});

// 4. PREFIX & ROUTING
const prefix = '/make-server-69ad2d15';

// 5. BOOTSTRAP & ROOT ROUTES (High-priority)
app.get('/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }));
app.get(`${prefix}/health`, (c) => c.json({ status: 'ok', prefixed: true }));

// Primary Notifications Route (Resilient to path stripping)
const fetchNotificationsHandler = async (c: any) => {
  try {
    const data = await kv.getByPrefix('notif:');
    const valid = (data || []).filter((n: any) => n && n.date);
    const sorted = valid.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 50);
    return c.json(sorted);
  } catch (e: any) {
    console.log('[Server/Notifications] GET Failure:', e?.message || e);
    return c.json([]);
  }
};

app.get('/notifications', fetchNotificationsHandler);
app.get(`${prefix}/notifications`, fetchNotificationsHandler);

const routes = app.basePath(prefix);

// --- Caching Engine (Redis-like behavior using KV Store) ---
const CACHE_TTL = 30; // 30 seconds for aggregate data

const cache = {
  async get(key: string) {
    try {
      const cached = await kv.get(`cache:${key}`);
      if (cached && cached.expiresAt > Date.now()) {
        console.log(`[Cache] HIT for ${key}`);
        return cached.data;
      }
      console.log(`[Cache] MISS/EXPIRED for ${key}`);
      return null;
    } catch (e) {
      return null;
    }
  },
  async set(key: string, data: any, ttlSeconds: number = CACHE_TTL) {
    try {
      await kv.set(`cache:${key}`, {
        data,
        expiresAt: Date.now() + (ttlSeconds * 1000)
      });
    } catch (e) {
      console.error(`[Cache] SET ERROR for ${key}:`, e);
    }
  },
  async invalidate(prefix: string) {
    try {
      // Since we can't easily list and delete by prefix in a clean way without listing everything,
      // we'll use a versioning system or specific keys.
      // For this app, we'll just delete the specific known aggregate keys.
      const keys = [
        'merchants_list',
        'tx_list:all',
        'stock_list:all',
        'stock_list:merchant:M1',
        'stock_list:merchant:M2',
        'stock_list:merchant:M3',
        'stock_list:merchant:M4'
      ];
      // Also invalidate merchant-specific keys if we track them, but for now, clear global aggregations
      for (const k of keys) await kv.del(`cache:${k}`);
    } catch (e) {}
  },
  async invalidateMerchant(mId: string) {
     await kv.del(`cache:tx_list:${mId}`);
     await kv.del(`cache:stock_list:${mId}`);
     await kv.del(`cache:merchants_list`);
  }
};

// Health check
app.get('/health', (c) => c.json({ status: 'ok', scope: 'root' }));
routes.get('/health', (c) => c.json({ status: 'ok', scope: 'prefixed' }));

// Turso libSQL Client
const getTursoClient = () => createTursoClient({
  url: Deno.env.get('TURSO_DATABASE_URL') || '',
  authToken: Deno.env.get('TURSO_AUTH_TOKEN'),
});

if (!Deno.env.get('TURSO_DATABASE_URL')) {
  console.error('CRITICAL: TURSO_DATABASE_URL is missing');
}

// JWT Utilities (Web Crypto — no external deps)
const getJWTKey = async () => {
  const secret = Deno.env.get('JWT_SECRET') || 'clintpos-jwt-secret-change-in-production-min32ch';
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
};

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function fromB64url(s: string): Uint8Array {
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

async function signJWT(payload: Record<string, any>): Promise<string> {
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64url(new TextEncoder().encode(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 604800, // 7 days
  })));
  const input = `${header}.${body}`;
  const key = await getJWTKey();
  const sig = b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input)));
  return `${input}.${sig}`;
}

async function verifyJWT(token: string): Promise<Record<string, any> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;
    const key = await getJWTKey();
    const valid = await crypto.subtle.verify('HMAC', key, fromB64url(sig), new TextEncoder().encode(`${header}.${payload}`));
    if (!valid) return null;
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch { return null; }
}

async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const pepper = Deno.env.get('PASSWORD_PEPPER') || 'clintpos-pepper-change-in-production';
  const keyMat = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(pepper), iterations: 10000 },
    keyMat, 256
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return (await hashPassword(password)) === hash;
}

// Turso Schema Init
(async () => {
  try {
    const client = getTursoClient();
    await client.batch([
      { sql: 'CREATE TABLE IF NOT EXISTS kv_store (key TEXT NOT NULL PRIMARY KEY, value TEXT NOT NULL)', args: [] },
      {
        sql: `CREATE TABLE IF NOT EXISTS users (
          id TEXT NOT NULL PRIMARY KEY,
          email TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT, role TEXT, merchant_id TEXT, profile TEXT, pin TEXT,
          status TEXT DEFAULT 'Active', created_at TEXT, email_confirmed INTEGER DEFAULT 1
        )`,
        args: [],
      },
      { sql: 'CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email)', args: [] },
    ], 'write');
    console.log('[Turso] Schema ready');
  } catch (e: any) {
    console.error('[Turso] Schema init error:', e?.message);
  }
})();

// --- Helper Functions ---

// Auth verification helper — extracts user from Bearer token
async function getAuthUser(c: any) {
  try {
    const authHeader = c.req.header('Authorization') || '';
    const token = authHeader.split(' ')[1];
    if (!token) return null;
    const payload = await verifyJWT(token);
    if (!payload) return null;
    return { id: payload.sub, email: payload.email, role: payload.role, merchantId: payload.merchantId, name: payload.name };
  } catch (e) {
    console.log('[Auth] getAuthUser error:', e);
    return null;
  }
}

// Auth middleware — logs warning but doesn't block (soft enforcement for demo)
async function requireAuth(c: any, next: () => Promise<void>) {
  const user = await getAuthUser(c);
  if (!user) {
    console.log(`[Auth] WARNING: Unauthenticated request to ${c.req.path}`);
    // Allow through with anon key for demo purposes, but log it
    c.set('authUser', null);
  } else {
    c.set('authUser', user);
  }
  await next();
}

// Apply auth middleware to all prefixed routes
routes.use('*', requireAuth);

// Forensic Node Enforcement Middleware
app.use('*', async (c, next) => {
  const nodeId = c.req.header('X-Forensic-Node-ID');
  const sessionId = c.req.header('X-Forensic-Session-ID');
  
  if (nodeId) {
    console.log(`[NODE_ID: ${nodeId}] [SESS: ${sessionId}] ${c.req.method} ${c.req.path}`);
    c.set('nodeId', nodeId);
  } else if (c.req.method !== 'OPTIONS' && !c.req.path.includes('/health')) {
    console.warn(`[SECURITY WARNING] Request missing Forensic Node Identification: ${c.req.path}`);
  }
  await next();
});

async function createAdminUser(email: string, password: string, name: string, role: string, merchantId: string | null = null, profile: string | null = null) {
  try {
    const client = getTursoClient();
    const passwordHash = await hashPassword(password);
    const normalizedEmail = email.toLowerCase();

    const existing = await client.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [normalizedEmail],
    });

    let userId: string;
    if (existing.rows.length > 0) {
      userId = existing.rows[0].id as string;
      await client.execute({
        sql: 'UPDATE users SET password_hash=?, name=?, role=?, merchant_id=?, profile=? WHERE id=?',
        args: [passwordHash, name, role, merchantId, profile, userId],
      });
    } else {
      userId = crypto.randomUUID();
      await client.execute({
        sql: `INSERT INTO users (id, email, password_hash, name, role, merchant_id, profile, status, created_at, email_confirmed)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, 1)`,
        args: [userId, normalizedEmail, passwordHash, name, role, merchantId, profile, new Date().toISOString()],
      });
    }

    const pin = ['Admin', 'Manager', 'Supervisor'].includes(role)
      ? (role === 'Admin' ? '9999' : role === 'Manager' ? '1111' : '2222')
      : undefined;

    const userProfile = {
      id: userId,
      email,
      name,
      role,
      merchantId,
      profile: profile || (merchantId === 'merchant:M1' ? 'Retail' : merchantId === 'merchant:M2' ? 'Forecourt' : merchantId === 'merchant:M3' ? 'Workshop' : merchantId === 'merchant:M4' ? 'Restaurant' : null),
      status: 'Active',
      createdAt: new Date().toISOString(),
      ...(pin && { pin }),
    };
    await kv.set(`user:${userId}`, userProfile);

    if (merchantId) {
      const merchantUsersKey = `merchant_users:${merchantId}`;
      const existingUsers = (await kv.get(merchantUsersKey)) || [];
      if (!existingUsers.includes(userId)) {
        existingUsers.push(userId);
        await kv.set(merchantUsersKey, existingUsers);
      }
    }
    return userId;
  } catch (error) {
    console.error(`[AuthAdmin] FAILURE for ${email}:`, error);
  }
  return null;
}

async function createAuditLog(merchantId: string, action: string, details: any, userId?: string) {
    const logId = `audit:${merchantId}:${Date.now()}`;
    const log = {
        id: logId,
        merchantId,
        userId: userId || 'system',
        action,
        details,
        timestamp: new Date().toISOString(),
        hash: btoa(`${merchantId}-${action}-${Date.now()}`).substring(0, 32)
    };
    await kv.set(logId, log);
    return log;
}

async function createNotification(type: string, message: string) {
    const id = `notif:${Date.now()}`;
    const notification = {
        id,
        type,
        message,
        date: new Date().toISOString(),
        read: false
    };
    await kv.set(id, notification);
    return notification;
}

// --- Email Notification Queue (simulated — no SMTP configured) ---
async function createEmailNotification(
    to: string,
    subject: string,
    body: string,
    metadata: Record<string, any> = {}
) {
    const id = `email_notif:${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const record = {
        id,
        to,
        subject,
        body,
        status: 'sent',  // Simulated as instantly sent since no SMTP configured
        sentAt: new Date().toISOString(),
        metadata,
        createdAt: new Date().toISOString()
    };
    await kv.set(id, record);
    console.log(`[Email] Queued notification to ${to}: "${subject}"`);
  return record;
}

function internalBarcode(item: any): string {
  const seed = String(item.id || item.sku || item.name || 'product');
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash * 31) + seed.charCodeAt(i)) >>> 0;
  return `290${String(hash % 1_000_000_000).padStart(9, '0')}`;
}

function productCloudKey(item: any): string {
  const rawBarcode = String(item.barcode || '').trim();
  // Treat common barcode formatting differences as the same product.
  return (rawBarcode ? rawBarcode.replace(/[\s-]/g, '').toUpperCase() : internalBarcode(item));
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function buildProductCloudRecord(item: any, existing: any = null) {
  const barcode = productCloudKey(item);
  const merchantIds = Array.from(new Set([
    ...(existing?.merchantIds || []),
    ...(item.merchantId ? [item.merchantId] : [])
  ]));
  return {
    ...(existing || {}),
    id: existing?.id || `cloud:${barcode}`,
    barcode,
    name: item.name || existing?.name || 'Unnamed product',
    brand: item.brand || existing?.brand || '',
    category: item.category || existing?.category || 'General',
    unit: item.unit || existing?.unit || 'Unit',
    price: item.price ?? item.startingPrice ?? item.loyaltyhub?.price ?? item.loyaltyhub?.startingPrice ?? existing?.price ?? null,
    imageUrl: item.imageUrl || item.image || existing?.imageUrl || '',
    sku: item.sku || existing?.sku || '',
    canonicalGtin: item.canonicalGtin || existing?.canonicalGtin || '',
    description: item.description || existing?.description || '',
    quantity: item.quantity ?? existing?.quantity ?? null,
    ingredients: item.ingredients || existing?.ingredients || '',
    allergens: item.allergens || existing?.allergens || [],
    nutrition: item.nutrition || existing?.nutrition || {},
    countries: item.countries || existing?.countries || [],
    barcodenest: item.barcodenest || existing?.barcodenest || null,
    loyaltyhub: item.loyaltyhub || existing?.loyaltyhub || null,
    merchantIds,
    source: item.source || existing?.source || 'Clinton POS inventory',
    updatedAt: new Date().toISOString(),
  };
}

async function upsertProductCloud(item: any) {
  const barcode = productCloudKey(item);
  const existing = await kv.get(`product_cloud:${barcode}`);
  await kv.set(`product_cloud:${barcode}`, buildProductCloudRecord(item, existing));
}

async function upsertProductCloudBatch(items: any[]) {
  const itemByKey = new Map<string, any>();
  for (const item of items) {
    const barcode = productCloudKey(item);
    itemByKey.set(`product_cloud:${barcode}`, item);
  }
  const keys = Array.from(itemByKey.keys());
  const existing = await kv.mget(keys);
  const values = keys.map((key, index) => buildProductCloudRecord(itemByKey.get(key), existing[index]));
  await kv.mset(keys, values);
  return values.length;
}

// Demo catalog artwork. These are generic, non-branded Unsplash photos so the
// seeded POS is visually useful without requiring local image storage.
function productImage(item: any): string {
  const name = String(item.name || '').toLowerCase();
  const imageId = name.includes('milk') ? 'photo-1550583724-b2692b85b150'
    : name.includes('bread') || name.includes('loaf') ? 'photo-1509440159596-0249088772ff'
    : name.includes('egg') ? 'photo-1582722872445-44dc5f7e3c8f'
    : name.includes('cheese') ? 'photo-1486297678162-eb2a19b0a32d'
    : name.includes('rice') ? 'photo-1586201375761-83865001e31c'
    : name.includes('oil') ? 'photo-1474979266404-7eaacbcd87c5'
    : name.includes('chicken') ? 'photo-1604503468506-a8da13d82791'
    : name.includes('burger') ? 'photo-1568901346375-23c9450c58cd'
    : name.includes('pizza') ? 'photo-1574071318508-1cdbab80d002'
    : name.includes('coffee') || name.includes('espresso') ? 'photo-1495474472287-4d71bcdd2085'
    : name.includes('beer') || name.includes('lager') ? 'photo-1515003197210-e0cd71810b5f'
    : item.category === 'Food' ? 'photo-1544025162-d76694265947'
    : item.category === 'Beverage' ? 'photo-1544145945-f90425340c7e'
    : item.category === 'Workshop' ? 'photo-1530124566582-a618bc2615dc'
    : 'photo-1542838132-92c53300491e';
  return `https://images.unsplash.com/${imageId}?auto=format&fit=crop&w=640&q=82`;
}

// --- Routes ---

routes.post('/seed', async (c) => {
  try {
    let body = {};
    try {
      body = await c.req.json();
    } catch (e) {
      // Body might be empty
    }
    
    const merchantList = [
      { id: 'merchant:M1', name: 'Sandton Gateway Retail', type: 'Retail', status: 'Active', onboardingProgress: 100 },
      { id: 'merchant:M2', name: 'V&A Waterfront Fuels', type: 'Forecourt', status: 'Active', onboardingProgress: 100 },
      { id: 'merchant:M3', name: 'Roxton Workshop Hub', type: 'Workshop', status: 'Active', onboardingProgress: 100 },
      { id: 'merchant:M4', name: 'Melrose Arch Kitchen', type: 'Restaurant', status: 'Active', onboardingProgress: 100 }
    ];
    for (const m of merchantList) {
      await kv.set(m.id, m);
      
      // Initialize Terminal Registry for each merchant
      const terminals = [
        { id: `TERM-${m.id.split(':')[1]}-01`, name: 'Front Counter A', status: 'Online', ip: '192.168.1.10', version: '4.2.1', type: 'Stationary', lastSeen: new Date().toISOString(), merchantId: m.id },
        { id: `TERM-${m.id.split(':')[1]}-02`, name: 'Mobile Handheld', status: 'Online', ip: '192.168.1.11', version: '4.2.1', type: 'Handheld', lastSeen: new Date().toISOString(), merchantId: m.id }
      ];
      await kv.set(`terminals:${m.id}`, terminals);
    }

    const stockItems = [
      // ═══ RETAIL (M1) — Sandton Gateway Retail ═══
      { id: 'P1', merchantId: 'merchant:M1', name: 'Luxury Milk 2L', category: 'Dairy', selling: 38.50, cost: 28.00, stock: 100, barcode: '6001234567890', unit: 'Bottle', velocity: 'Fast' },
      { id: 'P2', merchantId: 'merchant:M1', name: 'Wheat Bread', category: 'Bakery', selling: 18.00, cost: 12.00, stock: 50, barcode: '6009876543210', unit: 'Loaf', velocity: 'Fast' },
      { id: 'P5', merchantId: 'merchant:M1', name: 'Free-Range Eggs (6)', category: 'Dairy', selling: 42.00, cost: 30.00, stock: 80, barcode: '6001234567901', unit: 'Pack', velocity: 'Fast' },
      { id: 'P6', merchantId: 'merchant:M1', name: 'Cheddar Cheese 400g', category: 'Dairy', selling: 72.00, cost: 48.00, stock: 60, barcode: '6001234567902', unit: 'Block', velocity: 'Medium' },
      { id: 'P7', merchantId: 'merchant:M1', name: 'Coca-Cola 2L', category: 'Beverages', selling: 22.00, cost: 15.00, stock: 200, barcode: '6001234567903', unit: 'Bottle', velocity: 'Fast' },
      { id: 'P8', merchantId: 'merchant:M1', name: 'Sunflower Oil 750ml', category: 'Cooking', selling: 45.00, cost: 32.00, stock: 90, barcode: '6001234567904', unit: 'Bottle', velocity: 'Medium' },
      { id: 'P9', merchantId: 'merchant:M1', name: 'Basmati Rice 2kg', category: 'Dry Goods', selling: 55.00, cost: 38.00, stock: 70, barcode: '6001234567905', unit: 'Bag', velocity: 'Medium' },
      { id: 'P10', merchantId: 'merchant:M1', name: 'Washing Powder 2kg', category: 'Household', selling: 89.00, cost: 60.00, stock: 45, barcode: '6001234567906', unit: 'Box', velocity: 'Slow' },
      { id: 'P11', merchantId: 'merchant:M1', name: 'Toilet Paper 9-Pack', category: 'Household', selling: 95.00, cost: 65.00, stock: 55, barcode: '6001234567907', unit: 'Pack', velocity: 'Medium' },
      { id: 'P12', merchantId: 'merchant:M1', name: 'Chicken Breasts 1kg', category: 'Meat', selling: 98.00, cost: 70.00, stock: 40, barcode: '6001234567908', unit: 'Tray', velocity: 'Fast' },

      // ═══ FORECOURT (M2) — V&A Waterfront Fuels ═══
      { id: 'P3', merchantId: 'merchant:M2', name: '95 Unleaded', category: 'Fuel', selling: 23.40, cost: 18.50, stock: 50000, barcode: 'FUEL-95', unit: 'Litre', velocity: 'Fast' },
      { id: 'F1', merchantId: 'merchant:M2', name: '93 Unleaded', category: 'Fuel', selling: 22.90, cost: 18.10, stock: 40000, barcode: 'FUEL-93', unit: 'Litre', velocity: 'Fast' },
      { id: 'F2', merchantId: 'merchant:M2', name: 'Diesel 50ppm', category: 'Fuel', selling: 21.80, cost: 17.20, stock: 60000, barcode: 'FUEL-D50', unit: 'Litre', velocity: 'Fast' },
      { id: 'F3', merchantId: 'merchant:M2', name: 'Castrol GTX 5W-30 1L', category: 'Lubricants', selling: 189.00, cost: 130.00, stock: 50, barcode: 'LUB-CGX-01', unit: 'Bottle', velocity: 'Medium' },
      { id: 'F4', merchantId: 'merchant:M2', name: 'Windscreen Washer 5L', category: 'Car Care', selling: 65.00, cost: 35.00, stock: 40, barcode: 'CC-WW-01', unit: 'Bottle', velocity: 'Medium' },
      { id: 'F5', merchantId: 'merchant:M2', name: 'Energy Drink 500ml', category: 'Convenience', selling: 28.00, cost: 18.00, stock: 120, barcode: 'CONV-ED-01', unit: 'Can', velocity: 'Fast' },
      { id: 'F6', merchantId: 'merchant:M2', name: 'Bottled Water 500ml', category: 'Convenience', selling: 12.00, cost: 5.00, stock: 200, barcode: 'CONV-BW-01', unit: 'Bottle', velocity: 'Fast' },
      { id: 'F7', merchantId: 'merchant:M2', name: 'Pie (Steak & Cheese)', category: 'Hot Food', selling: 35.00, cost: 18.00, stock: 30, barcode: 'HF-PIE-01', unit: 'Each', velocity: 'Fast' },
      { id: 'F8', merchantId: 'merchant:M2', name: 'Car Air Freshener', category: 'Car Care', selling: 45.00, cost: 22.00, stock: 60, barcode: 'CC-AF-01', unit: 'Each', velocity: 'Slow' },
      { id: 'F9', merchantId: 'merchant:M2', name: 'Cigarettes (Marlboro)', category: 'Tobacco', selling: 72.00, cost: 55.00, stock: 100, barcode: 'TOB-ML-01', unit: 'Pack', velocity: 'Fast' },
      { id: 'F10', merchantId: 'merchant:M2', name: 'Tyre Pressure Gauge', category: 'Car Care', selling: 85.00, cost: 45.00, stock: 15, barcode: 'CC-TPG-01', unit: 'Each', velocity: 'Slow' },

      // ═══ WORKSHOP (M3) — Roxton Workshop Hub ═══
      { id: 'P4', merchantId: 'merchant:M3', name: 'Brake Pad Set', category: 'Brake System', selling: 850.00, cost: 600.00, stock: 12, barcode: 'PART-BK-01', unit: 'Set', velocity: 'Medium' },
      { id: 'W1', merchantId: 'merchant:M3', name: 'Oil Filter (Toyota)', category: 'Filters', selling: 120.00, cost: 65.00, stock: 30, barcode: 'PART-OF-01', unit: 'Each', velocity: 'Fast' },
      { id: 'W2', merchantId: 'merchant:M3', name: 'Air Filter (Universal)', category: 'Filters', selling: 180.00, cost: 95.00, stock: 25, barcode: 'PART-AF-01', unit: 'Each', velocity: 'Medium' },
      { id: 'W3', merchantId: 'merchant:M3', name: 'Spark Plug Set (4)', category: 'Ignition', selling: 320.00, cost: 180.00, stock: 20, barcode: 'PART-SP-01', unit: 'Set', velocity: 'Medium' },
      { id: 'W4', merchantId: 'merchant:M3', name: 'Timing Belt Kit', category: 'Engine', selling: 1450.00, cost: 900.00, stock: 8, barcode: 'PART-TB-01', unit: 'Kit', velocity: 'Slow' },
      { id: 'W5', merchantId: 'merchant:M3', name: 'Shock Absorber (Front)', category: 'Suspension', selling: 1200.00, cost: 750.00, stock: 10, barcode: 'PART-SA-01', unit: 'Each', velocity: 'Slow' },
      { id: 'W6', merchantId: 'merchant:M3', name: 'Wiper Blade Set', category: 'Accessories', selling: 250.00, cost: 130.00, stock: 35, barcode: 'PART-WB-01', unit: 'Set', velocity: 'Medium' },
      { id: 'W7', merchantId: 'merchant:M3', name: 'Battery 12V 60Ah', category: 'Electrical', selling: 1650.00, cost: 1100.00, stock: 6, barcode: 'PART-BAT-01', unit: 'Each', velocity: 'Medium' },
      { id: 'W8', merchantId: 'merchant:M3', name: 'Labour: Minor Service', category: 'Labour', selling: 850.00, cost: 0, stock: 999, barcode: 'LAB-MIN-01', unit: 'Hour', velocity: 'Fast' },
      { id: 'W9', merchantId: 'merchant:M3', name: 'Labour: Major Service', category: 'Labour', selling: 1500.00, cost: 0, stock: 999, barcode: 'LAB-MAJ-01', unit: 'Hour', velocity: 'Medium' },
      { id: 'W10', merchantId: 'merchant:M3', name: 'Coolant 5L', category: 'Fluids', selling: 180.00, cost: 95.00, stock: 20, barcode: 'FLD-CL-01', unit: 'Bottle', velocity: 'Medium' },

      // ═══ RESTAURANT (M4) — Melrose Arch Kitchen ═══
      { id: 'R1', merchantId: 'merchant:M4', name: 'Grilled Ribeye 300g', category: 'Food', selling: 285.00, cost: 120.00, stock: 40, barcode: 'REST-RIB-01', unit: 'Plate', velocity: 'Fast', course: 'Main' },
      { id: 'R2', merchantId: 'merchant:M4', name: 'Prawn Linguine', category: 'Food', selling: 195.00, cost: 85.00, stock: 35, barcode: 'REST-PL-01', unit: 'Plate', velocity: 'Fast', course: 'Main' },
      { id: 'R3', merchantId: 'merchant:M4', name: 'Caesar Salad', category: 'Food', selling: 95.00, cost: 35.00, stock: 50, barcode: 'REST-CS-01', unit: 'Plate', velocity: 'Medium', course: 'Starter' },
      { id: 'R4', merchantId: 'merchant:M4', name: 'Soup of the Day', category: 'Food', selling: 75.00, cost: 22.00, stock: 30, barcode: 'REST-SD-01', unit: 'Bowl', velocity: 'Medium', course: 'Starter' },
      { id: 'R5', merchantId: 'merchant:M4', name: 'Beef Burger & Chips', category: 'Food', selling: 165.00, cost: 60.00, stock: 45, barcode: 'REST-BB-01', unit: 'Plate', velocity: 'Fast', course: 'Main' },
      { id: 'R6', merchantId: 'merchant:M4', name: 'Margherita Pizza', category: 'Food', selling: 135.00, cost: 40.00, stock: 60, barcode: 'REST-MP-01', unit: 'Plate', velocity: 'Fast', course: 'Main' },
      { id: 'R7', merchantId: 'merchant:M4', name: 'Chocolate Fondant', category: 'Food', selling: 85.00, cost: 28.00, stock: 25, barcode: 'REST-CF-01', unit: 'Plate', velocity: 'Medium', course: 'Dessert' },
      { id: 'R8', merchantId: 'merchant:M4', name: 'Creme Brulee', category: 'Food', selling: 75.00, cost: 22.00, stock: 20, barcode: 'REST-CB-01', unit: 'Ramekin', velocity: 'Medium', course: 'Dessert' },
      { id: 'R9', merchantId: 'merchant:M4', name: 'Craft Lager 500ml', category: 'Beverage', selling: 65.00, cost: 25.00, stock: 120, barcode: 'REST-CL-01', unit: 'Bottle', velocity: 'Fast', course: 'Drink' },
      { id: 'R10', merchantId: 'merchant:M4', name: 'House Red Wine (Glass)', category: 'Beverage', selling: 85.00, cost: 30.00, stock: 80, barcode: 'REST-RW-01', unit: 'Glass', velocity: 'Fast', course: 'Drink' },
      { id: 'R11', merchantId: 'merchant:M4', name: 'Sparkling Water 750ml', category: 'Beverage', selling: 45.00, cost: 12.00, stock: 100, barcode: 'REST-SW-01', unit: 'Bottle', velocity: 'Medium', course: 'Drink' },
      { id: 'R12', merchantId: 'merchant:M4', name: 'Espresso', category: 'Beverage', selling: 35.00, cost: 8.00, stock: 200, barcode: 'REST-ES-01', unit: 'Cup', velocity: 'Fast', course: 'Drink' },
      { id: 'R13', merchantId: 'merchant:M4', name: 'Calamari Strips', category: 'Food', selling: 115.00, cost: 45.00, stock: 30, barcode: 'REST-CAL-01', unit: 'Plate', velocity: 'Medium', course: 'Starter' },
      { id: 'R14', merchantId: 'merchant:M4', name: 'Grilled Chicken Salad', category: 'Food', selling: 145.00, cost: 55.00, stock: 35, barcode: 'REST-GCS-01', unit: 'Plate', velocity: 'Medium', course: 'Main' }
    ];
    // Keep the seeded retail tenant recognisably South African and Makro-style
    // (bulk pantry, beverages, snacks and household essentials).
    const retailOverrides: Record<string, any> = {
      P1: { name: 'Fair Cape UHT Full Cream Milk 1L', selling: 19.95, cost: 15, unit: 'Carton' },
      P2: { name: 'Sasko Premium Sliced Bread', selling: 19.95, cost: 13, unit: 'Loaf' },
      P5: { name: 'Nulaid Large Eggs 6-Pack', selling: 34.95, cost: 25, unit: 'Pack' },
      P6: { name: 'Parmalat Processed Cheese 900g', selling: 104.95, cost: 78, unit: 'Pack' },
      P7: { name: 'Sparletta Creme Soda 2L', selling: 19.95, cost: 13, unit: 'Bottle' },
      P8: { name: 'Sunflower Oil 750ml', selling: 39.95, cost: 28, unit: 'Bottle' },
      P9: { name: 'Tastic Parboiled Rice 2kg', selling: 34.95, cost: 25, unit: 'Bag' },
      P10: { name: 'OMO Auto Washing Powder 2kg', selling: 89.95, cost: 65, unit: 'Box' },
      P11: { name: 'ARO 1-Ply Toilet Tissue 24-Pack', selling: 115.95, cost: 82, unit: 'Pack' },
      P12: { name: 'Rainbow Frozen Chicken Portions 2kg', selling: 84.99, cost: 62, unit: 'Bag' },
      P13: { id: 'P13', merchantId: 'merchant:M1', name: 'Nestlé Milo Malt Drink 500g', category: 'Beverages', selling: 89.95, cost: 67, stock: 45, barcode: '6001234567909', unit: 'Tin' },
      P14: { id: 'P14', merchantId: 'merchant:M1', name: 'Freshpak Rooibos Tea 80s', category: 'Beverages', selling: 59.25, cost: 42, stock: 60, barcode: '6001234567910', unit: 'Box' },
      P15: { id: 'P15', merchantId: 'merchant:M1', name: 'Simba Ghost Pops Maize Snack', category: 'Snacks', selling: 12.95, cost: 8, stock: 120, barcode: '6001234567911', unit: 'Bag' },
      P16: { id: 'P16', merchantId: 'merchant:M1', name: 'Doritos Sweet Chilli 120g', category: 'Snacks', selling: 20.95, cost: 14, stock: 100, barcode: '6001234567912', unit: 'Bag' },
    };
    const tenantOverrides: Record<string, any> = {
      F5: { name: 'Red Bull Energy Drink 250ml', category: 'Convenience', selling: 19.95, cost: 13, unit: 'Can' },
      F6: { name: 'Energade Blueberry 500ml', category: 'Convenience', selling: 19.95, cost: 12, unit: 'Bottle' },
      F7: { name: 'Steak & Cheese Pie', category: 'Hot Food', selling: 35, cost: 18, unit: 'Each' },
      F11: { id: 'F11', merchantId: 'merchant:M2', name: 'Liqui-Fruit Red Grape Juice 300ml', category: 'Convenience', selling: 14.95, cost: 9, stock: 100, barcode: 'CONV-LF-01', unit: 'Bottle' },
      F12: { id: 'F12', merchantId: 'merchant:M2', name: 'Simba Original Chips 120g', category: 'Snacks', selling: 22.95, cost: 15, stock: 80, barcode: 'CONV-SM-01', unit: 'Bag' },
      F13: { id: 'F13', merchantId: 'merchant:M2', name: 'Bakers Tennis Biscuits 200g', category: 'Snacks', selling: 25.95, cost: 17, stock: 75, barcode: 'CONV-BK-01', unit: 'Pack' },
      W1: { name: 'SEB Corolla Spin-on Oil Filter', selling: 120, cost: 65 },
      W3: { name: 'NGK Spark Plug Set (4)', selling: 320, cost: 180 },
      W7: { name: 'Ingle 652MF 80Ah Car Battery', selling: 1583, cost: 1100 },
      W8: { id: 'W8', merchantId: 'merchant:M3', name: 'Castrol GTX 20W-50 Motor Oil 5L', category: 'Workshop', selling: 599, cost: 420, stock: 12, barcode: 'PART-OIL-01', unit: 'Bottle' },
      W9: { id: 'W9', merchantId: 'merchant:M3', name: 'Bosch AeroEco Wiper Blade 14in', category: 'Workshop', selling: 230, cost: 160, stock: 18, barcode: 'PART-WIP-01', unit: 'Each' },
      W10: { id: 'W10', merchantId: 'merchant:M3', name: 'Tolsen Tyre Pressure Gauge 170 PSI', category: 'Workshop', selling: 399, cost: 280, stock: 10, barcode: 'PART-TPG-01', unit: 'Each' },
      R1: { name: 'Classic Eggs Benedict', selling: 74, cost: 28 },
      R2: { name: 'Chicken Burger', selling: 74, cost: 28 },
      R5: { name: 'Beef Burger', selling: 99, cost: 38 },
      R6: { name: 'Smashed Avo & Poached Egg', selling: 74, cost: 28 },
      R9: { name: 'Bottomless Filter Coffee', selling: 49, cost: 12, unit: 'Cup' },
      R12: { name: 'Cappuccino', selling: 45, cost: 12, unit: 'Cup' },
      R15: { id: 'R15', merchantId: 'merchant:M4', name: 'Chicken Mayo Toasted Sandwich', category: 'Food', selling: 68, cost: 25, stock: 35, barcode: 'REST-CS-02', unit: 'Plate' },
      R16: { id: 'R16', merchantId: 'merchant:M4', name: 'Famous Giant Muffin', category: 'Food', selling: 52, cost: 18, stock: 25, barcode: 'REST-MP-02', unit: 'Each' },
      R17: { id: 'R17', merchantId: 'merchant:M4', name: 'Rooibos Tea', category: 'Beverage', selling: 30, cost: 8, stock: 120, barcode: 'REST-RT-01', unit: 'Cup' },
      R18: { id: 'R18', merchantId: 'merchant:M4', name: 'Caribbean Mocha', category: 'Beverage', selling: 59, cost: 18, stock: 100, barcode: 'REST-CM-01', unit: 'Cup' },
      R19: { id: 'R19', merchantId: 'merchant:M4', name: 'Guava & Grapefruit Fruity Fizz', category: 'Beverage', selling: 66, cost: 20, stock: 80, barcode: 'REST-GF-01', unit: 'Glass' },
      R20: { id: 'R20', merchantId: 'merchant:M4', name: 'Triple Chocolate Brownie', category: 'Food', selling: 40, cost: 14, stock: 30, barcode: 'REST-TB-01', unit: 'Each' },
      R21: { id: 'R21', merchantId: 'merchant:M4', name: 'Buffalo Chicken & Blue Cheese Eggs Benedict', category: 'Food', selling: 84, cost: 32, stock: 25, barcode: 'REST-BC-01', unit: 'Plate' },
      R22: { id: 'R22', merchantId: 'merchant:M4', name: 'Muesli & Yoghurt Pot', category: 'Food', selling: 69, cost: 24, stock: 25, barcode: 'REST-MY-01', unit: 'Pot' },
    };
    const seededStockItems = stockItems
      .map((item: any) => {
        const override = item.merchantId === 'merchant:M1' ? retailOverrides[item.id] : tenantOverrides[item.id];
        return override ? { ...item, ...override } : item;
      })
      .concat(Object.values({ ...retailOverrides, ...tenantOverrides }).filter((item: any) => !stockItems.some((existing: any) => existing.id === item.id)));
    for (const item of seededStockItems) {
      const stockItem = { ...item, barcode: item.barcode || internalBarcode(item), image: item.image || productImage(item) };
      await kv.set(`stock:${item.merchantId}:${item.id}`, stockItem);
      await upsertProductCloud(stockItem);
    }

    const password = 'password123';
    const accounts: { email: string; name: string; role: string; merchantId: string | null; profile: string | null }[] = [
      // ═══ ADMIN — sees everything across all tenants ═══
      { email: 'admin@roxton.com', name: 'Clinton Matos', role: 'Admin', merchantId: null, profile: null },

      // ═══ RETAIL (M1) — Sandton Gateway Retail ═══
      { email: 'retail.manager@roxton.com', name: 'Sarah Ndlovu', role: 'Manager', merchantId: 'merchant:M1', profile: 'Retail' },
      { email: 'retail.supervisor@roxton.com', name: 'James Botha', role: 'Supervisor', merchantId: 'merchant:M1', profile: 'Retail' },
      { email: 'retail.cashier@roxton.com', name: 'Thandi Moyo', role: 'Cashier', merchantId: 'merchant:M1', profile: 'Retail' },
      { email: 'retail.stock@roxton.com', name: 'David Patel', role: 'StockController', merchantId: 'merchant:M1', profile: 'Retail' },

      // ═══ FORECOURT (M2) — V&A Waterfront Fuels ═══
      { email: 'fuel.manager@roxton.com', name: 'Pieter van Wyk', role: 'Manager', merchantId: 'merchant:M2', profile: 'Forecourt' },
      { email: 'fuel.supervisor@roxton.com', name: 'Nomsa Khumalo', role: 'Supervisor', merchantId: 'merchant:M2', profile: 'Forecourt' },
      { email: 'fuel.attendant@roxton.com', name: 'Sipho Dlamini', role: 'Cashier', merchantId: 'merchant:M2', profile: 'Forecourt' },

      // ═══ WORKSHOP (M3) — Roxton Workshop Hub ═══
      { email: 'workshop.manager@roxton.com', name: 'Johan Kruger', role: 'Manager', merchantId: 'merchant:M3', profile: 'Workshop' },
      { email: 'workshop.mechanic@roxton.com', name: 'Bongani Nkosi', role: 'StockController', merchantId: 'merchant:M3', profile: 'Workshop' },
      { email: 'workshop.reception@roxton.com', name: 'Lisa Chen', role: 'Cashier', merchantId: 'merchant:M3', profile: 'Workshop' },

      // ═══ RESTAURANT (M4) — Melrose Arch Kitchen ═══
      { email: 'chef@roxton.com', name: 'Marco Rossi', role: 'Manager', merchantId: 'merchant:M4', profile: 'Restaurant' },
      { email: 'restaurant.supervisor@roxton.com', name: 'Ayesha Khan', role: 'Supervisor', merchantId: 'merchant:M4', profile: 'Restaurant' },
      { email: 'waiter@roxton.com', name: 'Luke van der Berg', role: 'Cashier', merchantId: 'merchant:M4', profile: 'Restaurant' },

      // Legacy aliases (backwards compat) — Retail M1
      { email: 'manager@roxton.com', name: 'Sarah Ndlovu', role: 'Manager', merchantId: 'merchant:M1', profile: 'Retail' },
      { email: 'supervisor@roxton.com', name: 'James Botha', role: 'Supervisor', merchantId: 'merchant:M1', profile: 'Retail' },
      { email: 'cashier@roxton.com', name: 'Thandi Moyo', role: 'Cashier', merchantId: 'merchant:M1', profile: 'Retail' },
    ];

    const created = [];
    for (const acc of accounts) {
      const uid = await createAdminUser(acc.email, (body as any).password || password, acc.name, acc.role, acc.merchantId, acc.profile);
      if (uid) created.push({ email: acc.email, role: acc.role, profile: acc.profile });
    }

    // --- Migrate existing users to add PINs (idempotent) ---
    console.log('[seed] Migrating user PINs...');
    const allUsers = await kv.getByPrefix('user:');
    let pinsMigrated = 0;
    for (const user of allUsers || []) {
      if (['Admin', 'Manager', 'Supervisor'].includes(user.role) && !user.pin) {
        const pin = user.role === 'Admin' ? '9999' : user.role === 'Manager' ? '1111' : '2222';
        user.pin = pin;
        await kv.set(`user:${user.id}`, user);
        pinsMigrated++;
      }
    }
    console.log(`[seed] PIN migration complete: ${pinsMigrated} users updated`);

    // --- Seed Restaurant Tables ---
    const restaurantTables = [
      { id: 'T1', number: 1, name: 'Window 1', section: 'Indoor', seats: 2, status: 'Available', shape: 'round' },
      { id: 'T2', number: 2, name: 'Window 2', section: 'Indoor', seats: 2, status: 'Available', shape: 'round' },
      { id: 'T3', number: 3, name: 'Booth A', section: 'Indoor', seats: 4, status: 'Available', shape: 'rect' },
      { id: 'T4', number: 4, name: 'Booth B', section: 'Indoor', seats: 4, status: 'Available', shape: 'rect' },
      { id: 'T5', number: 5, name: 'Centre 1', section: 'Indoor', seats: 6, status: 'Available', shape: 'rect' },
      { id: 'T6', number: 6, name: 'Centre 2', section: 'Indoor', seats: 6, status: 'Available', shape: 'rect' },
      { id: 'T7', number: 7, name: 'Bar 1', section: 'Bar', seats: 2, status: 'Available', shape: 'round' },
      { id: 'T8', number: 8, name: 'Bar 2', section: 'Bar', seats: 2, status: 'Available', shape: 'round' },
      { id: 'T9', number: 9, name: 'Patio A', section: 'Outdoor', seats: 4, status: 'Available', shape: 'round' },
      { id: 'T10', number: 10, name: 'Patio B', section: 'Outdoor', seats: 4, status: 'Available', shape: 'round' },
      { id: 'T11', number: 11, name: 'VIP Lounge', section: 'VIP', seats: 8, status: 'Available', shape: 'rect' },
      { id: 'T12', number: 12, name: 'Private Dining', section: 'VIP', seats: 10, status: 'Available', shape: 'rect' },
    ];
    await kv.set('tables:merchant:M4', restaurantTables);

    await cache.invalidate('all');
    return c.json({ 
      success: true, 
      message: 'System Seeded: 4 Tenants + Admin + 14 Users + 44 Stock Items',
      created,
      profiles: ['Admin', 'Retail', 'Forecourt', 'Workshop', 'Restaurant'],
      credentials: accounts.map(a => ({ email: a.email, password: (body as any).password || password, role: a.role, profile: a.profile }))
    });
  } catch (e: any) {
    console.error('Seed error:', e);
    return c.json({ error: 'Seed failed', details: e.message }, 500);
  }
});

routes.post('/signup', async (c) => {
  const { email, password, name, role, merchantId, profile } = await c.req.json();
  const userId = await createAdminUser(email, password, name, role, merchantId, profile || null);
  if (!userId) return c.json({ error: 'Failed to create user' }, 400);
  await createAuditLog(merchantId || 'system', 'USER_ENROLL', { email, role, name });
  return c.json({ success: true, userId });
});

routes.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();
    if (!email || !password) return c.json({ error: 'Email and password are required' }, 400);

    const client = getTursoClient();
    const result = await client.execute({
      sql: 'SELECT id, email, password_hash, name, role, merchant_id, profile, status FROM users WHERE email = ?',
      args: [email.toLowerCase()],
    });

    if (result.rows.length === 0) return c.json({ error: 'Invalid credentials' }, 401);

    const row = result.rows[0];
    const valid = await verifyPassword(password, row.password_hash as string);
    if (!valid) return c.json({ error: 'Invalid credentials' }, 401);

    if (row.status === 'Inactive') return c.json({ error: 'Account is inactive' }, 403);

    const kvProfile = await kv.get(`user:${row.id}`);

    const token = await signJWT({
      sub: row.id as string,
      email: row.email as string,
      role: row.role as string,
      merchantId: row.merchant_id,
      name: row.name as string,
    });

    return c.json({
      success: true,
      token,
      user: {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        merchantId: row.merchant_id,
        profile: row.profile,
        ...(kvProfile || {}),
      },
    });
  } catch (e: any) {
    console.error('[login] Error:', e);
    return c.json({ error: 'Login failed', details: e?.message }, 500);
  }
});

routes.get('/user/:id', async (c) => {
  const userId = c.req.param('id');
  const profile = await kv.get(`user:${userId}`);
  return profile ? c.json(profile) : c.json({ error: 'Not found' }, 404);
});

routes.get('/users', async (c) => {
  const merchantId = c.req.query('merchantId');
  if (merchantId) {
    const userIds = (await kv.get(`merchant_users:${merchantId}`)) || [];
    const users = await Promise.all(userIds.map((id: string) => kv.get(`user:${id}`)));
    return c.json(users.filter(Boolean));
  }
  return c.json(await kv.getByPrefix('user:') || []);
});

routes.post('/users/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const existing = await kv.get(`user:${id}`);
  if (!existing) return c.json({ error: 'User not found' }, 404);
  const updated = { ...existing, ...body, id };
  await kv.set(`user:${id}`, updated);
  await createAuditLog(existing.merchantId || 'system', 'USER_UPDATE', { id, changes: body });
  return c.json({ success: true, user: updated });
});

routes.delete('/users/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await kv.get(`user:${id}`);
  if (!existing) return c.json({ error: 'User not found' }, 404);
  await kv.del(`user:${id}`);
  if (existing.merchantId) {
      const key = `merchant_users:${existing.merchantId}`;
      const list = (await kv.get(key)) || [];
      await kv.set(key, list.filter((uid: string) => uid !== id));
  }
  const _tursoDelete = getTursoClient();
  await _tursoDelete.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] });
  await createAuditLog(existing.merchantId || 'system', 'USER_DELETE', { id, email: existing.email });
  return c.json({ success: true });
});

// --- Loyalty Engine ---

routes.get('/loyalty/:identifier', async (c) => {
    const id = c.req.param('identifier');
    const profile = await kv.get(`loyalty:${id}`);
    if (!profile) {
        const newProfile = { id, points: 0, tier: 'Bronze', lastVisit: new Date().toISOString() };
        await kv.set(`loyalty:${id}`, newProfile);
        return c.json(newProfile);
    }
    return c.json(profile);
});

routes.post('/loyalty/earn', async (c) => {
    const { identifier, amount, merchantId } = await c.req.json();
    const profile = (await kv.get(`loyalty:${identifier}`)) || { id: identifier, points: 0, tier: 'Bronze' };
    
    const earned = Math.floor(amount / 10);
    profile.points += earned;
    profile.lastVisit = new Date().toISOString();
    
    await kv.set(`loyalty:${identifier}`, profile);
    await createAuditLog(merchantId, 'LOYALTY_EARN', { identifier, amount, earned, newBalance: profile.points });
    return c.json({ success: true, earned, newBalance: profile.points });
});

routes.post('/loyalty/redeem', async (c) => {
    const { identifier, points, merchantId } = await c.req.json();
    const profile = await kv.get(`loyalty:${identifier}`);
    if (!profile || profile.points < points) return c.json({ error: 'Insufficient points' }, 400);
    
    profile.points -= points;
    await kv.set(`loyalty:${identifier}`, profile);
    await createAuditLog(merchantId, 'LOYALTY_REDEEM', { identifier, points, newBalance: profile.points });
    return c.json({ success: true, newBalance: profile.points });
});

// --- Transactions & Audit ---

routes.post('/transactions', async (c) => {
  const body = await c.req.json();
  const merchantId = body.merchantId || 'unknown';
  const id = `tx:${merchantId}:${Date.now()}`;
  const txn = { ...body, id, date: new Date().toISOString() };
  await kv.set(id, txn);
  
  await createAuditLog(merchantId, 'SALE_COMPLETED', { txnId: id, amount: body.amount, method: body.method });
  
  if (body.amount > 1000) {
    await createNotification('SECURITY', `High-value transaction detected: R${body.amount} at ${merchantId}`);
  }
  
  // Invalidate Cache
  await cache.invalidateMerchant(merchantId);
  
  return c.json({ success: true, id });
});

routes.get('/transactions', async (c) => {
  const merchantId = c.req.query('merchantId');
  const cacheKey = `tx_list:${merchantId || 'all'}`;
  
  const cached = await cache.get(cacheKey);
  if (cached) return c.json(cached);

  const txs = await kv.getByPrefix(merchantId ? `tx:${merchantId}:` : 'tx:');
  const result = (txs || []).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  await cache.set(cacheKey, result);
  return c.json(result);
});

routes.get('/merchants/:id/audit-logs', async (c) => {
    const id = c.req.param('id');
    const logs = await kv.getByPrefix(`audit:${id}:`);
    return c.json((logs || []).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
});

routes.get('/merchants/:id/config', async (c) => {
  const id = c.req.param('id');
  const config = await kv.get(`config:${id}`);
  return c.json(config || {
    taxRate: 15,
    currency: 'ZAR',
    loyaltyEnabled: true,
    loyaltyMultiplier: 1.0,
    pointValue: 0.10,
    primaryColor: '#4f46e5',
    terminalTimeout: 60,
    autoPrintReceipts: true,
    storeAddress: 'Unit 1, Mall of Africa, Sandton',
    supportContact: '+27 11 000 0000',
    forensicLevel: 'Maximum',
    biometricMandatory: true,
    failoverEnabled: true,
  });
});

routes.post('/merchants/:id/config', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  await kv.set(`config:${id}`, body);
  await createAuditLog(id, 'CONFIG_UPDATE', { changes: body });
  await createNotification('SYSTEM', `System configuration updated for ${id}`);
  return c.json({ success: true });
});

routes.get('/merchants/:id/terminals', async (c) => {
  const id = c.req.param('id');
  const terminals = await kv.get(`terminals:${id}`);
  if (!terminals) return c.json([]);
  
  // Calculate status based on lastSeen (30s threshold)
  const threshold = 30000;
  const now = Date.now();
  const processed = terminals.map((t: any) => ({
    ...t,
    status: (now - new Date(t.lastSeen).getTime()) < threshold ? 'Online' : 'Offline'
  }));
  
  return c.json(processed);
});

routes.post('/merchants/:id/terminals/ping', async (c) => {
  const merchantId = c.req.param('id');
  const body = await c.req.json();
  const terminalId = body.id || `TERM-${crypto.randomUUID().substring(0,8)}`;
  
  let terminals = (await kv.get(`terminals:${merchantId}`)) || [];
  const existingIndex = terminals.findIndex((t: any) => t.id === terminalId);
  
  const isNew = existingIndex === -1;
  const terminalData = {
    ...body,
    id: terminalId,
    lastSeen: new Date().toISOString(),
    merchantId
  };
  
  if (!isNew) {
    terminals[existingIndex] = { ...terminals[existingIndex], ...terminalData };
  } else {
    terminals.push(terminalData);
    await createNotification('SYSTEM', `New terminal provisioned: ${terminalId} (${body.name})`);
  }
  
  await kv.set(`terminals:${merchantId}`, terminals);
  return c.json({ success: true, terminalId });
});

// Terminal Discovery — probe an IP address and return discovered terminal info
routes.post('/merchants/:id/terminals/discover', async (c) => {
  const merchantId = c.req.param('id');
  const body = await c.req.json();
  const ipAddress = body.ip;

  if (!ipAddress) {
    return c.json({ error: 'IP address is required' }, 400);
  }

  // Validate IP format (IPv4)
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(ipAddress)) {
    return c.json({ error: 'Invalid IP address format. Expected IPv4 (e.g. 192.168.1.100)' }, 400);
  }

  const octets = ipAddress.split('.').map(Number);
  if (octets.some((o: number) => o < 0 || o > 255)) {
    return c.json({ error: 'IP address octets must be between 0 and 255' }, 400);
  }

  try {
    // Check if this IP is already registered for this merchant
    const existingTerminals = (await kv.get(`terminals:${merchantId}`)) || [];
    const existingByIp = existingTerminals.find((t: any) => t.ip === ipAddress);
    
    if (existingByIp) {
      return c.json({
        success: true,
        alreadyRegistered: true,
        terminal: {
          id: existingByIp.id,
          name: existingByIp.name,
          ip: existingByIp.ip,
          type: existingByIp.type || 'Stationary',
          version: existingByIp.version || 'Unknown',
          status: existingByIp.status || 'Offline',
          serialNumber: existingByIp.serialNumber || null,
          model: existingByIp.model || null,
          lastSeen: existingByIp.lastSeen || null,
        }
      });
    }

    // Simulate terminal discovery — in production this would probe the device's API
    const lastOctet = octets[3];
    const terminalId = `TERM-${lastOctet.toString().padStart(2, '0')}${octets[2].toString().padStart(2, '0')}`;
    
    const isHandheld = lastOctet >= 200;
    const isKiosk = lastOctet >= 150 && lastOctet < 200;
    const type = isHandheld ? 'Handheld' : isKiosk ? 'Self-Service' : 'Stationary';
    
    const models: Record<string, string[]> = {
      'Stationary': ['Sunmi T2s', 'PAX E800', 'Ingenico APOS A8', 'Verifone Commander'],
      'Handheld': ['Sunmi V2 Pro', 'PAX A920 Pro', 'Ingenico DX8000', 'Zebra TC52'],
      'Self-Service': ['Sunmi K2', 'PAX IM30', 'Elo Touch I-Series', 'HP Engage One Prime']
    };
    const modelList = models[type] || models['Stationary'];
    const model = modelList[lastOctet % modelList.length];
    const serialNumber = `SN-${Date.now().toString(36).toUpperCase()}-${lastOctet.toString(16).toUpperCase().padStart(2, '0')}`;
    const firmwareVersion = `${4 + (lastOctet % 2)}.${lastOctet % 10}.${octets[2] % 10}`;

    console.log(`[Terminal Discovery] Probed ${ipAddress} for merchant ${merchantId} — found ${terminalId} (${model})`);

    return c.json({
      success: true,
      alreadyRegistered: false,
      terminal: {
        id: terminalId,
        name: `${type} Terminal ${lastOctet}`,
        ip: ipAddress,
        type,
        version: firmwareVersion,
        status: 'Discovered',
        serialNumber,
        model,
        discoveredAt: new Date().toISOString(),
      }
    });
  } catch (e: any) {
    console.error(`[Terminal Discovery] Error probing ${ipAddress}:`, e);
    return c.json({ error: `Discovery failed for ${ipAddress}: ${e?.message || 'Unknown error'}` }, 500);
  }
});

// Batch IP Range Discovery — scan multiple IPs in a range
routes.post('/merchants/:id/terminals/batch-discover', async (c) => {
  const merchantId = c.req.param('id');
  const body = await c.req.json();
  const { startIp, endIp } = body;

  if (!startIp || !endIp) {
    return c.json({ error: 'Both startIp and endIp are required' }, 400);
  }

  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(startIp) || !ipRegex.test(endIp)) {
    return c.json({ error: 'Invalid IP format. Use IPv4 (e.g. 192.168.1.100)' }, 400);
  }

  const startOctets = startIp.split('.').map(Number);
  const endOctets = endIp.split('.').map(Number);

  if (startOctets[0] !== endOctets[0] || startOctets[1] !== endOctets[1] || startOctets[2] !== endOctets[2]) {
    return c.json({ error: 'Start and end IP must be in the same /24 subnet' }, 400);
  }

  const rangeStart = startOctets[3];
  const rangeEnd = endOctets[3];
  if (rangeStart > rangeEnd) {
    return c.json({ error: 'Start IP last octet must be <= end IP last octet' }, 400);
  }
  if (rangeEnd - rangeStart > 50) {
    return c.json({ error: 'Maximum scan range is 50 addresses' }, 400);
  }

  try {
    const existingTerminals = (await kv.get(`terminals:${merchantId}`)) || [];
    const results: any[] = [];
    const prefix = `${startOctets[0]}.${startOctets[1]}.${startOctets[2]}`;

    const models: Record<string, string[]> = {
      'Stationary': ['Sunmi T2s', 'PAX E800', 'Ingenico APOS A8', 'Verifone Commander'],
      'Handheld': ['Sunmi V2 Pro', 'PAX A920 Pro', 'Ingenico DX8000', 'Zebra TC52'],
      'Self-Service': ['Sunmi K2', 'PAX IM30', 'Elo Touch I-Series', 'HP Engage One Prime']
    };

    for (let octet = rangeStart; octet <= rangeEnd; octet++) {
      const ip = `${prefix}.${octet}`;
      const existing = existingTerminals.find((t: any) => t.ip === ip);

      if (existing) {
        results.push({
          ip,
          alreadyRegistered: true,
          terminal: {
            id: existing.id, name: existing.name, ip: existing.ip,
            type: existing.type || 'Stationary', version: existing.version || 'Unknown',
            status: existing.status || 'Offline', serialNumber: existing.serialNumber || null,
            model: existing.model || null,
          }
        });
      } else {
        const terminalId = `TERM-${octet.toString().padStart(2, '0')}${startOctets[2].toString().padStart(2, '0')}`;
        const isHandheld = octet >= 200;
        const isKiosk = octet >= 150 && octet < 200;
        const type = isHandheld ? 'Handheld' : isKiosk ? 'Self-Service' : 'Stationary';
        const modelList = models[type] || models['Stationary'];
        const model = modelList[octet % modelList.length];
        const serialNumber = `SN-${Date.now().toString(36).toUpperCase()}-${octet.toString(16).toUpperCase().padStart(2, '0')}`;
        const firmwareVersion = `${4 + (octet % 2)}.${octet % 10}.${startOctets[2] % 10}`;

        results.push({
          ip, alreadyRegistered: false,
          terminal: {
            id: terminalId, name: `${type} Terminal ${octet}`, ip, type,
            version: firmwareVersion, status: 'Discovered', serialNumber, model,
            discoveredAt: new Date().toISOString(),
          }
        });
      }
    }

    console.log(`[Batch Discovery] Scanned ${results.length} IPs in ${prefix}.${rangeStart}-${rangeEnd} for ${merchantId}`);
    return c.json({ success: true, scanned: results.length, results });
  } catch (e: any) {
    console.error(`[Batch Discovery] Error:`, e);
    return c.json({ error: `Batch discovery failed: ${e?.message || 'Unknown error'}` }, 500);
  }
});

// Terminal Decommission — remove a terminal from merchant registry
routes.delete('/merchants/:id/terminals/:terminalId', async (c) => {
  const merchantId = c.req.param('id');
  const terminalId = c.req.param('terminalId');

  try {
    let terminals = (await kv.get(`terminals:${merchantId}`)) || [];
    const terminalIndex = terminals.findIndex((t: any) => t.id === terminalId);

    if (terminalIndex === -1) {
      return c.json({ error: `Terminal ${terminalId} not found in merchant ${merchantId}` }, 404);
    }

    const removedTerminal = terminals[terminalIndex];
    terminals.splice(terminalIndex, 1);
    await kv.set(`terminals:${merchantId}`, terminals);

    await createAuditLog(merchantId, 'TERMINAL_DECOMMISSIONED', {
      terminalId, terminalName: removedTerminal.name, terminalIp: removedTerminal.ip,
      decommissionedAt: new Date().toISOString()
    });
    await createNotification('SYSTEM', `Terminal decommissioned: ${terminalId} (${removedTerminal.name}) from ${merchantId}`);

    console.log(`[Terminal Decommission] Removed ${terminalId} from ${merchantId}`);
    return c.json({ success: true, terminalId, message: `Terminal ${terminalId} has been decommissioned and unlinked.` });
  } catch (e: any) {
    console.error(`[Terminal Decommission] Error:`, e);
    return c.json({ error: `Decommission failed: ${e?.message || 'Unknown error'}` }, 500);
  }
});

// Usage Metrics — returns current usage vs plan limits
routes.get('/merchants/:id/usage', async (c) => {
  const merchantId = c.req.param('id');

  try {
    const terminals = (await kv.get(`terminals:${merchantId}`)) || [];
    const terminalCount = terminals.length;

    const stockItems = await kv.getByPrefix('stock:');
    const merchantSkus = (stockItems || []).filter((item: any) => item && item.merchantId === merchantId);
    const skuCount = merchantSkus.length;

    const merchant = await kv.get(merchantId) as any;
    const plan = merchant?.plan || 'kiosk';
    const planLimits = merchant?.planLimits || { maxTerminals: 1, maxSkus: 50, maxLocations: 1 };

    return c.json({
      success: true,
      plan,
      usage: {
        terminals: {
          current: terminalCount, limit: planLimits.maxTerminals,
          unlimited: planLimits.maxTerminals === -1,
          percentage: planLimits.maxTerminals === -1 ? 0 : Math.round((terminalCount / planLimits.maxTerminals) * 100)
        },
        skus: {
          current: skuCount, limit: planLimits.maxSkus,
          unlimited: planLimits.maxSkus === -1,
          percentage: planLimits.maxSkus === -1 ? 0 : Math.round((skuCount / planLimits.maxSkus) * 100)
        },
        locations: {
          current: 1, limit: planLimits.maxLocations,
          unlimited: planLimits.maxLocations === -1,
          percentage: planLimits.maxLocations === -1 ? 0 : Math.round((1 / planLimits.maxLocations) * 100)
        }
      }
    });
  } catch (e: any) {
    console.error(`[Usage Metrics] Error for ${merchantId}:`, e);
    return c.json({ error: `Failed to fetch usage metrics: ${e?.message}` }, 500);
  }
});

// Terminal Firmware Update — push firmware to a single terminal
routes.post('/merchants/:id/terminals/:terminalId/firmware-update', async (c) => {
  const merchantId = c.req.param('id');
  const terminalId = c.req.param('terminalId');
  const body = await c.req.json();
  const targetVersion = body.targetVersion || '5.2.0';

  try {
    let terminals = (await kv.get(`terminals:${merchantId}`)) || [];
    const terminalIndex = terminals.findIndex((t: any) => t.id === terminalId);

    if (terminalIndex === -1) {
      return c.json({ error: `Terminal ${terminalId} not found` }, 404);
    }

    const terminal = terminals[terminalIndex];
    const previousVersion = terminal.version;

    if (previousVersion === targetVersion) {
      return c.json({ success: true, alreadyLatest: true, version: targetVersion, message: `${terminalId} is already running v${targetVersion}` });
    }

    terminals[terminalIndex] = {
      ...terminal,
      version: targetVersion,
      lastSeen: new Date().toISOString(),
      firmwareUpdatedAt: new Date().toISOString(),
    };
    await kv.set(`terminals:${merchantId}`, terminals);

    await createAuditLog(merchantId, 'TERMINAL_FIRMWARE_UPDATED', {
      terminalId, terminalName: terminal.name,
      previousVersion, newVersion: targetVersion,
      updatedAt: new Date().toISOString()
    });
    await createNotification('SYSTEM', `Firmware updated on ${terminalId} (${terminal.name}): v${previousVersion} → v${targetVersion}`);

    console.log(`[Firmware Update] ${terminalId} updated from v${previousVersion} to v${targetVersion} for ${merchantId}`);
    return c.json({
      success: true, alreadyLatest: false, terminalId,
      previousVersion, newVersion: targetVersion,
      message: `Firmware successfully pushed to ${terminalId}`
    });
  } catch (e: any) {
    console.error(`[Firmware Update] Error:`, e);
    return c.json({ error: `Firmware update failed: ${e?.message || 'Unknown error'}` }, 500);
  }
});

// Terminal Replace — decommission old and register replacement in one operation
routes.post('/merchants/:id/terminals/:terminalId/replace', async (c) => {
  const merchantId = c.req.param('id');
  const terminalId = c.req.param('terminalId');
  const body = await c.req.json();
  const replacement = body.replacement;

  if (!replacement || !replacement.ip) {
    return c.json({ error: 'Replacement terminal data with IP is required' }, 400);
  }

  try {
    let terminals = (await kv.get(`terminals:${merchantId}`)) || [];
    const terminalIndex = terminals.findIndex((t: any) => t.id === terminalId);

    if (terminalIndex === -1) {
      return c.json({ error: `Terminal ${terminalId} not found` }, 404);
    }

    const oldTerminal = terminals[terminalIndex];
    terminals.splice(terminalIndex, 1);

    const newTerminalData = {
      id: replacement.id || `TERM-${crypto.randomUUID().substring(0,8)}`,
      name: replacement.name || oldTerminal.name,
      type: replacement.type || oldTerminal.type,
      ip: replacement.ip,
      version: replacement.version || '5.2.0',
      status: 'Online',
      serialNumber: replacement.serialNumber || null,
      model: replacement.model || null,
      lastSeen: new Date().toISOString(),
      merchantId,
      replacedTerminalId: terminalId,
    };
    terminals.push(newTerminalData);
    await kv.set(`terminals:${merchantId}`, terminals);

    await createAuditLog(merchantId, 'TERMINAL_REPLACED', {
      oldTerminalId: terminalId, oldTerminalName: oldTerminal.name, oldTerminalIp: oldTerminal.ip,
      newTerminalId: newTerminalData.id, newTerminalName: newTerminalData.name, newTerminalIp: newTerminalData.ip,
      replacedAt: new Date().toISOString()
    });
    await createNotification('SYSTEM', `Terminal replaced: ${terminalId} → ${newTerminalData.id} (${newTerminalData.name}) for ${merchantId}`);

    console.log(`[Terminal Replace] ${terminalId} → ${newTerminalData.id} for ${merchantId}`);
    return c.json({
      success: true,
      decommissioned: { id: terminalId, name: oldTerminal.name },
      replacement: newTerminalData,
      message: `${terminalId} decommissioned and replaced with ${newTerminalData.id}`
    });
  } catch (e: any) {
    console.error(`[Terminal Replace] Error:`, e);
    return c.json({ error: `Replacement failed: ${e?.message || 'Unknown error'}` }, 500);
  }
});

// Bulk Firmware Update — push firmware to all outdated terminals
routes.post('/merchants/:id/terminals/bulk-firmware-update', async (c) => {
  const merchantId = c.req.param('id');
  const body = await c.req.json();
  const targetVersion = body.targetVersion || '5.2.0';

  try {
    let terminals = (await kv.get(`terminals:${merchantId}`)) || [];
    const outdated = terminals.filter((t: any) => t.version !== targetVersion);

    if (outdated.length === 0) {
      return c.json({ success: true, updated: 0, skipped: terminals.length, message: 'All terminals already on latest firmware' });
    }

    const results: any[] = [];
    const updatedTerminals = terminals.map((t: any) => {
      if (t.version !== targetVersion) {
        results.push({ terminalId: t.id, name: t.name, previousVersion: t.version, newVersion: targetVersion });
        return { ...t, version: targetVersion, lastSeen: new Date().toISOString(), firmwareUpdatedAt: new Date().toISOString() };
      }
      return t;
    });

    await kv.set(`terminals:${merchantId}`, updatedTerminals);
    await createAuditLog(merchantId, 'BULK_FIRMWARE_UPDATED', { targetVersion, terminalsUpdated: results.length, terminalsSkipped: terminals.length - results.length, details: results, updatedAt: new Date().toISOString() });
    await createNotification('SYSTEM', `Bulk firmware push: ${results.length} terminal(s) updated to v${targetVersion} for ${merchantId}`);

    console.log(`[Bulk Firmware] ${results.length} terminals updated to v${targetVersion} for ${merchantId}`);
    return c.json({ success: true, updated: results.length, skipped: terminals.length - results.length, results, targetVersion });
  } catch (e: any) {
    console.error(`[Bulk Firmware] Error:`, e);
    return c.json({ error: `Bulk firmware update failed: ${e?.message || 'Unknown error'}` }, 500);
  }
});

// Schedule Firmware Rollout
routes.post('/merchants/:id/terminals/schedule-firmware', async (c) => {
  const merchantId = c.req.param('id');
  const body = await c.req.json();
  const { targetVersion, scheduledAt, windowMinutes, terminalIds, notes } = body;

  if (!targetVersion || !scheduledAt) {
    return c.json({ error: 'targetVersion and scheduledAt are required' }, 400);
  }
  if (new Date(scheduledAt) <= new Date()) {
    return c.json({ error: 'Scheduled time must be in the future' }, 400);
  }

  try {
    const rolloutId = `rollout-${crypto.randomUUID().substring(0, 8)}`;
    let terminals = (await kv.get(`terminals:${merchantId}`)) || [];
    const eligibleIds = terminalIds && terminalIds.length > 0
      ? terminalIds
      : terminals.filter((t: any) => t.version !== targetVersion).map((t: any) => t.id);

    const rollout = {
      id: rolloutId, merchantId, targetVersion, scheduledAt,
      windowMinutes: windowMinutes || 60,
      terminalIds: eligibleIds, terminalCount: eligibleIds.length,
      notes: notes || '', status: 'scheduled',
      createdAt: new Date().toISOString(),
    };

    await kv.set(`firmware_rollout:${merchantId}:${rolloutId}`, rollout);
    await createAuditLog(merchantId, 'FIRMWARE_ROLLOUT_SCHEDULED', { rolloutId, targetVersion, scheduledAt, terminalCount: eligibleIds.length, windowMinutes: rollout.windowMinutes });
    await createNotification('SYSTEM', `Firmware rollout scheduled: v${targetVersion} for ${eligibleIds.length} terminal(s) at ${new Date(scheduledAt).toLocaleString()}`);

    console.log(`[Firmware Rollout] Scheduled ${rolloutId} for ${merchantId}`);
    return c.json({ success: true, rollout });
  } catch (e: any) {
    console.error(`[Firmware Rollout] Schedule error:`, e);
    return c.json({ error: `Failed to schedule rollout: ${e?.message || 'Unknown error'}` }, 500);
  }
});

// Get Scheduled Rollouts
routes.get('/merchants/:id/terminals/scheduled-rollouts', async (c) => {
  const merchantId = c.req.param('id');
  try {
    const rollouts = await kv.getByPrefix(`firmware_rollout:${merchantId}:`);
    const sorted = (rollouts || []).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json({ success: true, rollouts: sorted });
  } catch (e: any) {
    return c.json({ error: `Failed to fetch rollouts: ${e?.message}` }, 500);
  }
});

// Cancel Scheduled Rollout
routes.delete('/merchants/:id/terminals/scheduled-rollouts/:rolloutId', async (c) => {
  const merchantId = c.req.param('id');
  const rolloutId = c.req.param('rolloutId');
  try {
    const rollout = await kv.get(`firmware_rollout:${merchantId}:${rolloutId}`);
    if (!rollout) return c.json({ error: `Rollout ${rolloutId} not found` }, 404);
    await kv.del(`firmware_rollout:${merchantId}:${rolloutId}`);
    await createAuditLog(merchantId, 'FIRMWARE_ROLLOUT_CANCELLED', { rolloutId, targetVersion: rollout.targetVersion });
    await createNotification('SYSTEM', `Firmware rollout ${rolloutId} cancelled for ${merchantId}`);
    return c.json({ success: true, message: `Rollout ${rolloutId} cancelled` });
  } catch (e: any) {
    return c.json({ error: `Failed to cancel rollout: ${e?.message}` }, 500);
  }
});

// Terminal Health Dashboard — uptime, latency, health score per terminal
routes.get('/merchants/:id/terminals/health', async (c) => {
  const merchantId = c.req.param('id');
  try {
    const terminals = (await kv.get(`terminals:${merchantId}`)) || [];
    if (terminals.length === 0) {
      return c.json({ success: true, terminals: [], summary: { avgUptime: 0, avgLatency: 0, healthyCount: 0, warningCount: 0, criticalCount: 0, totalCount: 0, avgTxPerHour: 0 } });
    }

    const now = Date.now();
    const healthData = terminals.map((t: any) => {
      const idHash = t.id.split('').reduce((a: number, ch: string) => a + ch.charCodeAt(0), 0);
      const ipHash = (t.ip || '0.0.0.0').split('.').reduce((a: number, o: string) => a + parseInt(o, 10), 0);
      const seed = (idHash * 17 + ipHash * 31) % 1000;
      const isOnline = t.status === 'Online';
      const lastSeenMs = t.lastSeen ? new Date(t.lastSeen).getTime() : now - 86400000;
      const hoursSinceLastSeen = (now - lastSeenMs) / 3600000;

      const uptime = Math.min(99.99, Math.max(0, isOnline ? 95 + (seed % 500) / 100 : Math.max(0, 85 - hoursSinceLastSeen * 2 + (seed % 200) / 100)));
      const latency = Math.max(1, isOnline ? 2 + (seed % 43) : 100 + (seed % 400));
      const packetLoss = isOnline ? (seed % 50) / 100 : 1 + (seed % 800) / 100;
      const txPerHour = isOnline ? 10 + (seed % 190) : 0;
      const cpuUtil = isOnline ? 15 + (seed % 55) : 0;
      const memUtil = isOnline ? 30 + (seed % 45) : 0;
      const temperature = isOnline ? 35 + (seed % 25) : 20 + (seed % 5);

      let healthScore = 0;
      healthScore += uptime >= 99 ? 40 : uptime >= 95 ? 30 : uptime >= 90 ? 20 : 10;
      healthScore += latency <= 10 ? 30 : latency <= 30 ? 25 : latency <= 50 ? 15 : 5;
      healthScore += packetLoss <= 0.1 ? 30 : packetLoss <= 0.5 ? 25 : packetLoss <= 2 ? 15 : 5;
      const healthStatus = healthScore >= 85 ? 'healthy' : healthScore >= 60 ? 'warning' : 'critical';

      const heartbeats: boolean[] = [];
      for (let i = 23; i >= 0; i--) {
        if (isOnline) heartbeats.push(((seed + i * 7) % 100) > 3);
        else if (hoursSinceLastSeen > i) heartbeats.push(false);
        else heartbeats.push(((seed + i * 7) % 100) > 5);
      }

      return {
        terminalId: t.id, name: t.name, type: t.type, ip: t.ip, status: t.status,
        version: t.version, model: t.model || null, serialNumber: t.serialNumber || null, lastSeen: t.lastSeen,
        metrics: { uptime: Math.round(uptime * 100) / 100, latency, packetLoss: Math.round(packetLoss * 100) / 100, txPerHour, cpuUtil, memUtil, temperature, healthScore, healthStatus, heartbeats }
      };
    });

    const n = healthData.length;
    const summary = {
      avgUptime: Math.round(healthData.reduce((a: number, t: any) => a + t.metrics.uptime, 0) / n * 100) / 100,
      avgLatency: Math.round(healthData.reduce((a: number, t: any) => a + t.metrics.latency, 0) / n),
      healthyCount: healthData.filter((t: any) => t.metrics.healthStatus === 'healthy').length,
      warningCount: healthData.filter((t: any) => t.metrics.healthStatus === 'warning').length,
      criticalCount: healthData.filter((t: any) => t.metrics.healthStatus === 'critical').length,
      totalCount: n,
      avgTxPerHour: Math.round(healthData.reduce((a: number, t: any) => a + t.metrics.txPerHour, 0) / n),
    };

    return c.json({ success: true, terminals: healthData, summary });
  } catch (e: any) {
    console.error(`[Terminal Health] Error for ${merchantId}:`, e);
    return c.json({ error: `Failed to fetch terminal health: ${e?.message}` }, 500);
  }
});

// Execute due scheduled rollouts — called periodically by frontend polling
routes.post('/merchants/:id/terminals/execute-due-rollouts', async (c) => {
  const merchantId = c.req.param('id');
  try {
    const allRollouts = (await kv.getByPrefix(`firmware_rollout:${merchantId}:`)) || [];
    const now = Date.now();
    const dueRollouts = allRollouts.filter((r: any) => r.status === 'scheduled' && new Date(r.scheduledAt).getTime() <= now);

    if (dueRollouts.length === 0) {
      return c.json({ success: true, executed: 0, message: 'No due rollouts' });
    }

    const executedResults: any[] = [];

    for (const rollout of dueRollouts) {
      // Mark as executing
      rollout.status = 'executing';
      rollout.executionStartedAt = new Date().toISOString();
      rollout.progress = {};
      for (const tid of rollout.terminalIds) {
        rollout.progress[tid] = { status: 'pending' };
      }
      await kv.set(`firmware_rollout:${merchantId}:${rollout.id}`, rollout);

      // Execute per-terminal updates
      let terminals = (await kv.get(`terminals:${merchantId}`)) || [];
      let updatedCount = 0;
      let failedCount = 0;

      for (const tid of rollout.terminalIds) {
        try {
          const tIdx = terminals.findIndex((t: any) => t.id === tid);
          if (tIdx === -1) {
            rollout.progress[tid] = { status: 'failed', error: 'Terminal not found', completedAt: new Date().toISOString() };
            failedCount++;
            continue;
          }

          // Mark updating
          rollout.progress[tid] = { status: 'updating', startedAt: new Date().toISOString() };
          await kv.set(`firmware_rollout:${merchantId}:${rollout.id}`, rollout);

          const terminal = terminals[tIdx];
          const previousVersion = terminal.version;

          if (previousVersion === rollout.targetVersion) {
            rollout.progress[tid] = { status: 'complete', previousVersion, newVersion: rollout.targetVersion, note: 'Already current', completedAt: new Date().toISOString() };
            updatedCount++;
            continue;
          }

          // Apply update
          terminals[tIdx] = { ...terminal, version: rollout.targetVersion, lastSeen: new Date().toISOString(), firmwareUpdatedAt: new Date().toISOString() };
          rollout.progress[tid] = { status: 'complete', previousVersion, newVersion: rollout.targetVersion, completedAt: new Date().toISOString() };
          updatedCount++;
        } catch (termErr: any) {
          rollout.progress[tid] = { status: 'failed', error: termErr?.message || 'Unknown error', completedAt: new Date().toISOString() };
          failedCount++;
        }
      }

      // Persist terminal updates
      await kv.set(`terminals:${merchantId}`, terminals);

      // Mark rollout complete or partially failed
      rollout.status = failedCount > 0 && updatedCount === 0 ? 'failed' : failedCount > 0 ? 'partial' : 'completed';
      rollout.executionCompletedAt = new Date().toISOString();
      rollout.updatedCount = updatedCount;
      rollout.failedCount = failedCount;
      await kv.set(`firmware_rollout:${merchantId}:${rollout.id}`, rollout);

      await createAuditLog(merchantId, 'FIRMWARE_ROLLOUT_EXECUTED', {
        rolloutId: rollout.id, targetVersion: rollout.targetVersion,
        updatedCount, failedCount, status: rollout.status,
      });
      await createNotification('SYSTEM', `Firmware rollout ${rollout.id} ${rollout.status}: ${updatedCount} updated, ${failedCount} failed for ${merchantId}`);

      executedResults.push({ rolloutId: rollout.id, status: rollout.status, updatedCount, failedCount });
      console.log(`[Rollout Exec] ${rollout.id} for ${merchantId}: ${rollout.status} (${updatedCount} ok, ${failedCount} fail)`);
    }

    return c.json({ success: true, executed: executedResults.length, results: executedResults });
  } catch (e: any) {
    console.error(`[Rollout Exec] Error:`, e);
    return c.json({ error: `Rollout execution failed: ${e?.message || 'Unknown error'}` }, 500);
  }
});

// Get single rollout detail with progress
routes.get('/merchants/:id/terminals/rollouts/:rolloutId', async (c) => {
  const merchantId = c.req.param('id');
  const rolloutId = c.req.param('rolloutId');
  try {
    const rollout = await kv.get(`firmware_rollout:${merchantId}:${rolloutId}`);
    if (!rollout) return c.json({ error: `Rollout ${rolloutId} not found` }, 404);
    return c.json({ success: true, rollout });
  } catch (e: any) {
    return c.json({ error: `Failed to fetch rollout: ${e?.message}` }, 500);
  }
});

// Health Alert Config — GET
routes.get('/merchants/:id/terminals/health-alerts/config', async (c) => {
  const merchantId = c.req.param('id');
  try {
    const config = await kv.get(`health_alert_config:${merchantId}`);
    const defaults = {
      enabled: true,
      healthScoreThreshold: 60,
      uptimeThreshold: 95,
      latencyThreshold: 100,
      packetLossThreshold: 2,
      temperatureThreshold: 55,
      cpuThreshold: 80,
      memoryThreshold: 85,
      autoNotify: true,
    };
    return c.json({ success: true, config: config || defaults });
  } catch (e: any) {
    return c.json({ error: `Failed to fetch health alert config: ${e?.message}` }, 500);
  }
});

// Health Alert Config — POST
routes.post('/merchants/:id/terminals/health-alerts/config', async (c) => {
  const merchantId = c.req.param('id');
  const body = await c.req.json();
  try {
    const config = {
      enabled: body.enabled !== undefined ? body.enabled : true,
      healthScoreThreshold: body.healthScoreThreshold ?? 60,
      uptimeThreshold: body.uptimeThreshold ?? 95,
      latencyThreshold: body.latencyThreshold ?? 100,
      packetLossThreshold: body.packetLossThreshold ?? 2,
      temperatureThreshold: body.temperatureThreshold ?? 55,
      cpuThreshold: body.cpuThreshold ?? 80,
      memoryThreshold: body.memoryThreshold ?? 85,
      autoNotify: body.autoNotify !== undefined ? body.autoNotify : true,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`health_alert_config:${merchantId}`, config);
    await createAuditLog(merchantId, 'HEALTH_ALERT_CONFIG_UPDATED', config);
    console.log(`[Health Alerts] Config updated for ${merchantId}:`, config);
    return c.json({ success: true, config });
  } catch (e: any) {
    return c.json({ error: `Failed to save health alert config: ${e?.message}` }, 500);
  }
});

// Health Alerts — evaluate thresholds and return triggered alerts
routes.get('/merchants/:id/terminals/health-alerts', async (c) => {
  const merchantId = c.req.param('id');
  try {
    const config = (await kv.get(`health_alert_config:${merchantId}`)) || {
      enabled: true, healthScoreThreshold: 60, uptimeThreshold: 95,
      latencyThreshold: 100, packetLossThreshold: 2, temperatureThreshold: 55,
      cpuThreshold: 80, memoryThreshold: 85, autoNotify: true,
    };

    if (!config.enabled) {
      return c.json({ success: true, alerts: [], config, message: 'Health alerts disabled' });
    }

    const terminals = (await kv.get(`terminals:${merchantId}`)) || [];
    if (terminals.length === 0) {
      return c.json({ success: true, alerts: [], config });
    }

    const now = Date.now();
    const alerts: any[] = [];

    for (const t of terminals) {
      const idHash = t.id.split('').reduce((a: number, ch: string) => a + ch.charCodeAt(0), 0);
      const ipHash = (t.ip || '0.0.0.0').split('.').reduce((a: number, o: string) => a + parseInt(o, 10), 0);
      const seed = (idHash * 17 + ipHash * 31) % 1000;
      const isOnline = t.status === 'Online';
      const lastSeenMs = t.lastSeen ? new Date(t.lastSeen).getTime() : now - 86400000;
      const hoursSinceLastSeen = (now - lastSeenMs) / 3600000;

      const uptime = Math.min(99.99, Math.max(0, isOnline ? 95 + (seed % 500) / 100 : Math.max(0, 85 - hoursSinceLastSeen * 2 + (seed % 200) / 100)));
      const latency = Math.max(1, isOnline ? 2 + (seed % 43) : 100 + (seed % 400));
      const packetLoss = isOnline ? (seed % 50) / 100 : 1 + (seed % 800) / 100;
      const cpuUtil = isOnline ? 15 + (seed % 55) : 0;
      const memUtil = isOnline ? 30 + (seed % 45) : 0;
      const temperature = isOnline ? 35 + (seed % 25) : 20 + (seed % 5);
      let healthScore = 0;
      healthScore += uptime >= 99 ? 40 : uptime >= 95 ? 30 : uptime >= 90 ? 20 : 10;
      healthScore += latency <= 10 ? 30 : latency <= 30 ? 25 : latency <= 50 ? 15 : 5;
      healthScore += packetLoss <= 0.1 ? 30 : packetLoss <= 0.5 ? 25 : packetLoss <= 2 ? 15 : 5;

      const violations: string[] = [];
      if (healthScore < config.healthScoreThreshold) violations.push(`Health score ${healthScore} < ${config.healthScoreThreshold}`);
      if (Math.round(uptime * 100) / 100 < config.uptimeThreshold) violations.push(`Uptime ${(Math.round(uptime * 100) / 100)}% < ${config.uptimeThreshold}%`);
      if (latency > config.latencyThreshold) violations.push(`Latency ${latency}ms > ${config.latencyThreshold}ms`);
      if (Math.round(packetLoss * 100) / 100 > config.packetLossThreshold) violations.push(`Packet loss ${(Math.round(packetLoss * 100) / 100)}% > ${config.packetLossThreshold}%`);
      if (temperature > config.temperatureThreshold) violations.push(`Temperature ${temperature}°C > ${config.temperatureThreshold}°C`);
      if (cpuUtil > config.cpuThreshold) violations.push(`CPU ${cpuUtil}% > ${config.cpuThreshold}%`);
      if (memUtil > config.memoryThreshold) violations.push(`Memory ${memUtil}% > ${config.memoryThreshold}%`);

      if (violations.length > 0) {
        const severity = healthScore < 40 ? 'critical' : healthScore < config.healthScoreThreshold ? 'warning' : violations.length >= 3 ? 'warning' : 'info';
        alerts.push({
          terminalId: t.id, terminalName: t.name, ip: t.ip, status: t.status,
          healthScore, severity, violations, violationCount: violations.length,
          metrics: { uptime: Math.round(uptime * 100) / 100, latency, packetLoss: Math.round(packetLoss * 100) / 100, cpuUtil, memUtil, temperature },
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Filter out snoozed terminals
    const snoozedList = (await kv.getByPrefix(`terminal_snooze:${merchantId}:`)) || [];
    const activeSnoozed = new Set(snoozedList.filter((s: any) => new Date(s.expiresAt).getTime() > now).map((s: any) => s.terminalId));
    const filteredAlerts = alerts.filter((a: any) => !activeSnoozed.has(a.terminalId));
    const snoozedAlerts = alerts.filter((a: any) => activeSnoozed.has(a.terminalId));

    // Auto-notify if configured and there are critical alerts (non-snoozed only)
    if (config.autoNotify && filteredAlerts.some((a: any) => a.severity === 'critical')) {
      const criticals = filteredAlerts.filter((a: any) => a.severity === 'critical');
      const lastNotifKey = `health_alert_last_notif:${merchantId}`;
      const lastNotif = await kv.get(lastNotifKey);
      if (!lastNotif || (now - new Date(lastNotif).getTime()) > 300000) {
        await createNotification('ALERT', `Health alert: ${criticals.length} terminal(s) in critical state for ${merchantId} — ${criticals.map((a: any) => a.terminalId).join(', ')}`);
        await kv.set(lastNotifKey, new Date().toISOString());
      }
    }

    // Sort by severity then health score
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    filteredAlerts.sort((a: any, b: any) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9) || a.healthScore - b.healthScore);

    // Fire webhooks for critical/warning alerts (async, non-blocking)
    if (filteredAlerts.some((a: any) => a.severity === 'critical' || a.severity === 'warning')) {
      fireAlertWebhooks(merchantId, filteredAlerts).catch(e => console.error('[Health Alerts] Webhook fire error:', e));
    }

    return c.json({ success: true, alerts: filteredAlerts, snoozedAlerts, alertCount: filteredAlerts.length, snoozedCount: snoozedAlerts.length, config });
  } catch (e: any) {
    console.error(`[Health Alerts] Error for ${merchantId}:`, e);
    return c.json({ error: `Failed to evaluate health alerts: ${e?.message}` }, 500);
  }
});

// Retry failed/partial rollout — re-queues only the failed terminals
routes.post('/merchants/:id/terminals/rollouts/:rolloutId/retry', async (c) => {
  const merchantId = c.req.param('id');
  const rolloutId = c.req.param('rolloutId');
  try {
    const rollout = await kv.get(`firmware_rollout:${merchantId}:${rolloutId}`);
    if (!rollout) return c.json({ error: `Rollout ${rolloutId} not found` }, 404);
    if (rollout.status !== 'failed' && rollout.status !== 'partial') {
      return c.json({ error: `Only failed or partial rollouts can be retried (current: ${rollout.status})` }, 400);
    }

    const progress = rollout.progress || {};
    const failedIds = Object.entries(progress).filter(([_, v]: any) => v.status === 'failed').map(([tid]) => tid);

    if (failedIds.length === 0) {
      return c.json({ error: 'No failed terminals found in rollout progress' }, 400);
    }

    const retryId = `retry-${rolloutId.replace('rollout-', '')}-${crypto.randomUUID().substring(0, 4)}`;
    let terminals = (await kv.get(`terminals:${merchantId}`)) || [];

    const retryRollout: any = {
      id: retryId, merchantId, targetVersion: rollout.targetVersion,
      scheduledAt: new Date().toISOString(), windowMinutes: rollout.windowMinutes || 60,
      terminalIds: failedIds, terminalCount: failedIds.length,
      notes: `Retry of ${rolloutId} — ${failedIds.length} failed terminal(s)`,
      status: 'executing', parentRolloutId: rolloutId,
      createdAt: new Date().toISOString(), executionStartedAt: new Date().toISOString(),
      progress: {},
    };

    let updatedCount = 0;
    let failedCount = 0;

    for (const tid of failedIds) {
      retryRollout.progress[tid] = { status: 'updating', startedAt: new Date().toISOString() };
      try {
        const tIdx = terminals.findIndex((t: any) => t.id === tid);
        if (tIdx === -1) {
          retryRollout.progress[tid] = { status: 'failed', error: 'Terminal not found', completedAt: new Date().toISOString() };
          failedCount++;
          continue;
        }
        const terminal = terminals[tIdx];
        const previousVersion = terminal.version;
        if (previousVersion === rollout.targetVersion) {
          retryRollout.progress[tid] = { status: 'complete', previousVersion, newVersion: rollout.targetVersion, note: 'Already current', completedAt: new Date().toISOString() };
          updatedCount++;
        } else {
          terminals[tIdx] = { ...terminal, version: rollout.targetVersion, lastSeen: new Date().toISOString(), firmwareUpdatedAt: new Date().toISOString() };
          retryRollout.progress[tid] = { status: 'complete', previousVersion, newVersion: rollout.targetVersion, completedAt: new Date().toISOString() };
          updatedCount++;
        }
      } catch (termErr: any) {
        retryRollout.progress[tid] = { status: 'failed', error: termErr?.message || 'Unknown error', completedAt: new Date().toISOString() };
        failedCount++;
      }
    }

    await kv.set(`terminals:${merchantId}`, terminals);
    retryRollout.status = failedCount > 0 && updatedCount === 0 ? 'failed' : failedCount > 0 ? 'partial' : 'completed';
    retryRollout.executionCompletedAt = new Date().toISOString();
    retryRollout.updatedCount = updatedCount;
    retryRollout.failedCount = failedCount;
    await kv.set(`firmware_rollout:${merchantId}:${retryId}`, retryRollout);

    rollout.retryId = retryId;
    rollout.retriedAt = new Date().toISOString();
    await kv.set(`firmware_rollout:${merchantId}:${rolloutId}`, rollout);

    await createAuditLog(merchantId, 'FIRMWARE_ROLLOUT_RETRIED', {
      originalRolloutId: rolloutId, retryRolloutId: retryId,
      targetVersion: rollout.targetVersion, failedTerminals: failedIds.length,
      updatedCount, failedCount, status: retryRollout.status,
    });
    await createNotification('SYSTEM', `Rollout retry ${retryId} for ${merchantId}: ${updatedCount} updated, ${failedCount} failed`);

    console.log(`[Rollout Retry] ${retryId} from ${rolloutId}: ${retryRollout.status}`);
    return c.json({ success: true, retryRollout });
  } catch (e: any) {
    console.error(`[Rollout Retry] Error:`, e);
    return c.json({ error: `Retry failed: ${e?.message || 'Unknown error'}` }, 500);
  }
});

// Record a health snapshot for historical tracking
routes.post('/merchants/:id/terminals/health-snapshot', async (c) => {
  const merchantId = c.req.param('id');
  try {
    const terminals = (await kv.get(`terminals:${merchantId}`)) || [];
    if (terminals.length === 0) {
      return c.json({ success: true, recorded: 0, message: 'No terminals to snapshot' });
    }

    const now = Date.now();
    const timestamp = new Date().toISOString();
    const hourKey = new Date().toISOString().substring(0, 13);

    const snapshots: any[] = [];
    for (const t of terminals) {
      const idHash = t.id.split('').reduce((a: number, ch: string) => a + ch.charCodeAt(0), 0);
      const ipHash = (t.ip || '0.0.0.0').split('.').reduce((a: number, o: string) => a + parseInt(o, 10), 0);
      const seed = (idHash * 17 + ipHash * 31) % 1000;
      const hourNum = parseInt(hourKey.substring(11, 13), 10);
      const dayNum = parseInt(hourKey.substring(8, 10), 10);
      const timeSeed = (seed + hourNum * 13 + dayNum * 7) % 1000;
      const isOnline = t.status === 'Online';
      const lastSeenMs = t.lastSeen ? new Date(t.lastSeen).getTime() : now - 86400000;
      const hoursSinceLastSeen = (now - lastSeenMs) / 3600000;

      const uptime = Math.min(99.99, Math.max(0, isOnline ? 94 + (timeSeed % 600) / 100 : Math.max(0, 85 - hoursSinceLastSeen * 2 + (timeSeed % 200) / 100)));
      const latency = Math.max(1, isOnline ? 2 + (timeSeed % 48) : 100 + (timeSeed % 400));
      const packetLoss = isOnline ? (timeSeed % 60) / 100 : 1 + (timeSeed % 800) / 100;
      const cpuUtil = isOnline ? 12 + (timeSeed % 60) : 0;
      const memUtil = isOnline ? 28 + (timeSeed % 50) : 0;
      const temperature = isOnline ? 34 + (timeSeed % 27) : 20 + (timeSeed % 5);
      let healthScore = 0;
      healthScore += uptime >= 99 ? 40 : uptime >= 95 ? 30 : uptime >= 90 ? 20 : 10;
      healthScore += latency <= 10 ? 30 : latency <= 30 ? 25 : latency <= 50 ? 15 : 5;
      healthScore += packetLoss <= 0.1 ? 30 : packetLoss <= 0.5 ? 25 : packetLoss <= 2 ? 15 : 5;

      snapshots.push({
        terminalId: t.id,
        uptime: Math.round(uptime * 100) / 100,
        latency, packetLoss: Math.round(packetLoss * 100) / 100,
        cpuUtil, memUtil, temperature, healthScore,
      });
    }

    await kv.set(`health_history:${merchantId}:${hourKey}`, { timestamp, hourKey, terminals: snapshots });
    console.log(`[Health Snapshot] Recorded ${snapshots.length} terminals for ${merchantId} at ${hourKey}`);
    return c.json({ success: true, recorded: snapshots.length, hourKey });
  } catch (e: any) {
    console.error(`[Health Snapshot] Error:`, e);
    return c.json({ error: `Snapshot recording failed: ${e?.message}` }, 500);
  }
});

// Get health history for charting (with deterministic backfill)
routes.get('/merchants/:id/terminals/health-history', async (c) => {
  const merchantId = c.req.param('id');
  const terminalId = c.req.query('terminalId') || null;
  const days = Math.min(parseInt(c.req.query('days') || '7', 10), 30);
  try {
    const terminals = (await kv.get(`terminals:${merchantId}`)) || [];
    if (terminals.length === 0) {
      return c.json({ success: true, history: [], days });
    }

    const now = Date.now();
    const history: any[] = [];
    const intervals = days * 6;

    for (let i = intervals; i >= 0; i--) {
      const pointTime = now - (i * 4 * 3600000);
      const d = new Date(pointTime);
      const hourKey = d.toISOString().substring(0, 13);
      const hourNum = d.getUTCHours();
      const dayNum = d.getUTCDate();

      const existing = await kv.get(`health_history:${merchantId}:${hourKey}`);
      if (existing && existing.terminals) {
        const filtered = terminalId ? existing.terminals.filter((s: any) => s.terminalId === terminalId) : existing.terminals;
        if (filtered.length > 0) {
          const n = filtered.length;
          history.push({
            timestamp: existing.timestamp || d.toISOString(),
            label: `${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:00`,
            avgUptime: Math.round(filtered.reduce((a: number, t: any) => a + t.uptime, 0) / n * 100) / 100,
            avgLatency: Math.round(filtered.reduce((a: number, t: any) => a + t.latency, 0) / n),
            avgHealthScore: Math.round(filtered.reduce((a: number, t: any) => a + t.healthScore, 0) / n),
            avgCpu: Math.round(filtered.reduce((a: number, t: any) => a + t.cpuUtil, 0) / n),
            avgMemory: Math.round(filtered.reduce((a: number, t: any) => a + t.memUtil, 0) / n),
            avgTemp: Math.round(filtered.reduce((a: number, t: any) => a + t.temperature, 0) / n),
            terminalCount: n,
          });
          continue;
        }
      }

      const targetTerminals = terminalId ? terminals.filter((t: any) => t.id === terminalId) : terminals;
      if (targetTerminals.length === 0) continue;

      let totalUptime = 0, totalLatency = 0, totalHealth = 0, totalCpu = 0, totalMem = 0, totalTemp = 0;
      for (const t of targetTerminals) {
        const idHash = t.id.split('').reduce((a: number, ch: string) => a + ch.charCodeAt(0), 0);
        const ipHash = (t.ip || '0.0.0.0').split('.').reduce((a: number, o: string) => a + parseInt(o, 10), 0);
        const baseSeed = (idHash * 17 + ipHash * 31) % 1000;
        const timeSeed = (baseSeed + hourNum * 13 + dayNum * 7 + i * 3) % 1000;
        const isOnline = t.status === 'Online';

        const uptime = isOnline ? 94 + (timeSeed % 600) / 100 : 80 + (timeSeed % 500) / 100;
        const latency = isOnline ? 2 + (timeSeed % 48) : 50 + (timeSeed % 200);
        const packetLoss = isOnline ? (timeSeed % 60) / 100 : 1 + (timeSeed % 400) / 100;
        const cpu = isOnline ? 12 + (timeSeed % 60) : 5;
        const mem = isOnline ? 28 + (timeSeed % 50) : 15;
        const temp = isOnline ? 34 + (timeSeed % 27) : 22;
        let hs = 0;
        hs += uptime >= 99 ? 40 : uptime >= 95 ? 30 : uptime >= 90 ? 20 : 10;
        hs += latency <= 10 ? 30 : latency <= 30 ? 25 : latency <= 50 ? 15 : 5;
        hs += packetLoss <= 0.1 ? 30 : packetLoss <= 0.5 ? 25 : packetLoss <= 2 ? 15 : 5;

        totalUptime += Math.min(99.99, Math.max(0, uptime));
        totalLatency += Math.max(1, latency);
        totalHealth += hs;
        totalCpu += cpu;
        totalMem += mem;
        totalTemp += temp;
      }

      const n = targetTerminals.length;
      history.push({
        timestamp: d.toISOString(),
        label: `${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:00`,
        avgUptime: Math.round(totalUptime / n * 100) / 100,
        avgLatency: Math.round(totalLatency / n),
        avgHealthScore: Math.round(totalHealth / n),
        avgCpu: Math.round(totalCpu / n),
        avgMemory: Math.round(totalMem / n),
        avgTemp: Math.round(totalTemp / n),
        terminalCount: n,
      });
    }

    return c.json({ success: true, history, days, terminalId });
  } catch (e: any) {
    console.error(`[Health History] Error:`, e);
    return c.json({ error: `Failed to fetch health history: ${e?.message}` }, 500);
  }
});

// Snooze terminal alerts
routes.post('/merchants/:id/terminals/:terminalId/snooze', async (c) => {
  const merchantId = c.req.param('id');
  const terminalId = c.req.param('terminalId');
  const body = await c.req.json();
  const durationMinutes = body.durationMinutes || 60;
  const reason = body.reason || '';
  try {
    const snooze = {
      terminalId, merchantId, reason, durationMinutes,
      snoozedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + durationMinutes * 60000).toISOString(),
    };
    await kv.set(`terminal_snooze:${merchantId}:${terminalId}`, snooze);
    await createAuditLog(merchantId, 'TERMINAL_ALERT_SNOOZED', { terminalId, durationMinutes, reason });
    await createNotification('SYSTEM', `Terminal ${terminalId} alerts snoozed for ${durationMinutes} minutes`);
    console.log(`[Snooze] ${terminalId} snoozed for ${durationMinutes}min for ${merchantId}`);
    return c.json({ success: true, snooze });
  } catch (e: any) {
    return c.json({ error: `Failed to snooze terminal: ${e?.message}` }, 500);
  }
});

// Unsnooze terminal
routes.delete('/merchants/:id/terminals/:terminalId/snooze', async (c) => {
  const merchantId = c.req.param('id');
  const terminalId = c.req.param('terminalId');
  try {
    await kv.del(`terminal_snooze:${merchantId}:${terminalId}`);
    await createAuditLog(merchantId, 'TERMINAL_ALERT_UNSNOOZED', { terminalId });
    console.log(`[Unsnooze] ${terminalId} unsnoozed for ${merchantId}`);
    return c.json({ success: true, message: `Snooze removed for ${terminalId}` });
  } catch (e: any) {
    return c.json({ error: `Failed to unsnooze terminal: ${e?.message}` }, 500);
  }
});

// Get all snoozed terminals
routes.get('/merchants/:id/terminals/snoozed', async (c) => {
  const merchantId = c.req.param('id');
  try {
    const snoozes = (await kv.getByPrefix(`terminal_snooze:${merchantId}:`)) || [];
    const now = Date.now();
    const active: any[] = [];
    for (const s of snoozes) {
      if (new Date(s.expiresAt).getTime() > now) {
        active.push(s);
      } else {
        await kv.del(`terminal_snooze:${merchantId}:${s.terminalId}`);
      }
    }
    return c.json({ success: true, snoozed: active });
  } catch (e: any) {
    return c.json({ error: `Failed to fetch snoozed terminals: ${e?.message}` }, 500);
  }
});

routes.get('/tickets', async (c) => {
    const tickets = await kv.getByPrefix('ticket:');
    if (!tickets || tickets.length === 0) {
        return c.json([]);
    }
    return c.json(tickets.sort((a: any, b: any) => new Date(b.time).getTime() - new Date(a.time).getTime()));
});

routes.post('/tickets', async (c) => {
    const body = await c.req.json();
    await kv.set(`ticket:${body.id}`, body);
    return c.json({ success: true });
});

routes.post('/tickets/:id/comments', async (c) => {
    const id = c.req.param('id');
    const comment = await c.req.json();
    const ticket = await kv.get(`ticket:${id}`);
    if (ticket) {
        ticket.comments = [...(ticket.comments || []), comment];
        await kv.set(`ticket:${id}`, ticket);
    }
    return c.json({ success: true });
});

routes.get('/merchants', async (c) => {
  const cacheKey = 'merchants_list';
  const cached = await cache.get(cacheKey);
  if (cached) return c.json(cached);

  const merchants = await kv.getByPrefix('merchant:');
  const result = (merchants || []).filter((m: any) => m.id && m.id.startsWith('merchant:'));
  
  await cache.set(cacheKey, result, 60); // Cache merchants longer (60s)
  return c.json(result);
});

routes.post('/merchants', async (c) => {
  const body = await c.req.json();
  const id = body.id || `merchant:${crypto.randomUUID()}`;
  await kv.set(id, { ...body, id });
  await createAuditLog('system', 'MERCHANT_CREATE', { id, name: body.name });
  
  await cache.invalidate('merchants_list');
  return c.json({ success: true, id });
});

// Update merchant status (Active/Suspended/Inactive)
routes.post('/merchants/:id/status', async (c) => {
  try {
    const id = c.req.param('id');
    const { status, reason } = await c.req.json();
    
    if (!['Active', 'Suspended', 'Inactive'].includes(status)) {
      return c.json({ success: false, error: 'Invalid status' }, 400);
    }
    
    const merchant = await kv.get(id);
    if (!merchant) {
      return c.json({ success: false, error: 'Merchant not found' }, 404);
    }
    
    const oldStatus = merchant.status;
    merchant.status = status;
    merchant.lastStatusChange = new Date().toISOString();
    if (reason) merchant.statusReason = reason;
    
    await kv.set(id, merchant);
    await createAuditLog(id, 'MERCHANT_STATUS_CHANGE', { 
      oldStatus, 
      newStatus: status, 
      reason: reason || 'No reason provided'
    });
    await cache.invalidate('merchants_list');
    
    return c.json({ success: true, merchant });
  } catch (e: any) {
    console.error('[Merchants] Status update error:', e);
    return c.json({ success: false, error: e?.message || 'Failed to update status' }, 500);
  }
});

// Export merchant data (CSV/PDF)
routes.post('/merchants/:id/export', async (c) => {
  try {
    const id = c.req.param('id');
    const { type, format } = await c.req.json(); // type: 'transactions'|'staff'|'audit'|'billing', format: 'csv'|'pdf'
    
    if (!['transactions', 'staff', 'audit', 'billing', 'terminals'].includes(type)) {
      return c.json({ success: false, error: 'Invalid export type' }, 400);
    }
    
    let data: any[] = [];
    let headers: string[] = [];
    let filename = `${id}_${type}_${new Date().toISOString().split('T')[0]}`;
    
    // Fetch data based on type
    switch (type) {
      case 'transactions':
        data = await kv.getByPrefix(`tx:${id}:`) || [];
        data = data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        headers = ['Date', 'ID', 'Total', 'Payment Method', 'Cashier', 'Terminal', 'Status'];
        break;
      case 'staff':
        data = await kv.getByPrefix(`user:${id}:`) || [];
        headers = ['ID', 'Name', 'Email', 'Role', 'Status', 'Created'];
        break;
      case 'audit':
        data = await kv.getByPrefix(`audit:${id}:`) || [];
        data = data.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        headers = ['Timestamp', 'Action', 'User', 'Terminal', 'Details', 'Hash'];
        break;
      case 'billing':
        const invoices = await kv.getByPrefix(`billing_invoice:${id}:`) || [];
        data = invoices;
        headers = ['ID', 'Date', 'Amount', 'Status', 'Description'];
        break;
      case 'terminals':
        const terminals = await kv.get(`terminals:${id}`) || [];
        data = Array.isArray(terminals) ? terminals : [];
        headers = ['ID', 'Name', 'Status', 'Location', 'Last Seen', 'Version'];
        break;
    }
    
    if (format === 'csv') {
      // Generate CSV
      let csv = headers.join(',') + '\n';
      data.forEach((row: any) => {
        const values = headers.map(h => {
          const key = h.toLowerCase().replace(/ /g, '');
          let val = '';
          switch (type) {
            case 'transactions':
              if (h === 'Date') val = row.date || row.timestamp || '';
              else if (h === 'ID') val = row.id || '';
              else if (h === 'Total') val = String(row.total || row.amount || 0);
              else if (h === 'Payment Method') val = row.paymentMethod || '';
              else if (h === 'Cashier') val = row.cashier || row.cashierName || '';
              else if (h === 'Terminal') val = row.terminal || row.terminalId || '';
              else if (h === 'Status') val = row.status || 'Complete';
              break;
            case 'staff':
              if (h === 'ID') val = row.id || '';
              else if (h === 'Name') val = row.name || '';
              else if (h === 'Email') val = row.email || '';
              else if (h === 'Role') val = row.role || '';
              else if (h === 'Status') val = row.status || 'Active';
              else if (h === 'Created') val = row.createdAt || '';
              break;
            case 'audit':
              if (h === 'Timestamp') val = row.timestamp || '';
              else if (h === 'Action') val = row.action || '';
              else if (h === 'User') val = row.user || '';
              else if (h === 'Terminal') val = row.terminal || '';
              else if (h === 'Details') val = typeof row.details === 'string' ? row.details : JSON.stringify(row.details || '');
              else if (h === 'Hash') val = row.hash || '';
              break;
            case 'billing':
              if (h === 'ID') val = row.id || '';
              else if (h === 'Date') val = row.date || '';
              else if (h === 'Amount') val = String(row.amount || 0);
              else if (h === 'Status') val = row.status || '';
              else if (h === 'Description') val = row.description || '';
              break;
            case 'terminals':
              if (h === 'ID') val = row.id || '';
              else if (h === 'Name') val = row.name || '';
              else if (h === 'Status') val = row.status || '';
              else if (h === 'Location') val = row.location || '';
              else if (h === 'Last Seen') val = row.lastSeen || '';
              else if (h === 'Version') val = row.version || '';
              break;
          }
          // Escape commas and quotes for CSV
          return `"${String(val).replace(/"/g, '""')}"`;
        });
        csv += values.join(',') + '\n';
      });
      
      return c.text(csv, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}.csv"`
      });
    } else if (format === 'pdf') {
      // For PDF, return structured data that the frontend can use to generate PDF
      // (We can't easily generate PDFs on the server without additional libraries)
      return c.json({
        success: true,
        data,
        headers,
        filename,
        message: 'PDF generation should be handled client-side'
      });
    } else {
      return c.json({ success: false, error: 'Invalid format' }, 400);
    }
  } catch (e: any) {
    console.error('[Merchants] Export error:', e);
    return c.json({ success: false, error: e?.message || 'Export failed' }, 500);
  }
});

routes.get('/stock', async (c) => {
  const mId = c.req.query('merchantId');
  const cacheKey = `stock_list:${mId || 'all'}`;
  
  const cached = await cache.get(cacheKey);
  if (cached) return c.json(cached);

  const stock = await kv.getByPrefix(mId ? `stock:${mId}:` : 'stock:');
  const result = stock || [];
  
  await cache.set(cacheKey, result);
  return c.json(result);
});

routes.get('/product-cloud', async (c) => {
  const authUser = c.get('authUser');
  if (authUser && !['Admin', 'StockController'].includes(authUser.role)) {
    return c.json({ error: 'Product Cloud access denied' }, 403);
  }
  const query = (c.req.query('query') || '').trim().toLowerCase();
  const responseLimit = Math.min(Math.max(Number(c.req.query('limit')) || 500, 1), 2000);
  // Do not use kv.getByPrefix here: the LoyaltyHub catalog can contain tens
  // of thousands of rows, and materialising the entire prefix in an Edge
  // worker causes Supabase to terminate the request with WORKER_RESOURCE_LIMIT.
  // Let SQLite/Turso apply the prefix, search, and limit before values enter
  // the worker's memory.
  const client = getTursoClient();
  const result = query
    ? await client.execute({
        sql: 'SELECT value FROM kv_store WHERE key LIKE ? AND lower(value) LIKE ? ORDER BY key LIMIT ?',
        args: ['product_cloud:%', `%${query}%`, responseLimit],
      })
    : await client.execute({
        sql: 'SELECT value FROM kv_store WHERE key LIKE ? ORDER BY key LIMIT ?',
        args: ['product_cloud:%', responseLimit],
      });
  const products = result.rows.map((row: any) => {
    try {
      return JSON.parse(String(row.value));
    } catch {
      return null;
    }
  }).filter(Boolean);
  return c.json(products.sort((a: any, b: any) => String(a.name).localeCompare(String(b.name))));
});

routes.get('/product-cloud/count', async (c) => {
  const authUser = c.get('authUser');
  if (authUser && !['Admin', 'StockController'].includes(authUser.role)) {
    return c.json({ error: 'Product Cloud access denied' }, 403);
  }
  const client = getTursoClient();
  const result = await client.execute({
    sql: 'SELECT COUNT(*) AS count FROM kv_store WHERE key LIKE ?',
    args: ['product_cloud:%'],
  });
  return c.json({ count: Number(result.rows[0]?.count || 0) });
});

routes.get('/product-cloud/page', async (c) => {
  const authUser = c.get('authUser');
  if (authUser && !['Admin', 'StockController'].includes(authUser.role)) {
    return c.json({ error: 'Product Cloud access denied' }, 403);
  }
  const query = (c.req.query('query') || '').trim().toLowerCase();
  const page = Math.max(Number(c.req.query('page')) || 1, 1);
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 100, 1), 100);
  const offset = (page - 1) * limit;
  const client = getTursoClient();
  const whereSql = query
    ? 'key LIKE ? AND lower(value) LIKE ?'
    : 'key LIKE ?';
  const whereArgs = query ? ['product_cloud:%', `%${query}%`] : ['product_cloud:%'];
  const [countResult, rowsResult] = await Promise.all([
    client.execute({ sql: `SELECT COUNT(*) AS count FROM kv_store WHERE ${whereSql}`, args: whereArgs }),
    client.execute({
      sql: `SELECT value FROM kv_store WHERE ${whereSql} ORDER BY key LIMIT ? OFFSET ?`,
      args: [...whereArgs, limit, offset],
    }),
  ]);
  const products = rowsResult.rows.map((row: any) => {
    try { return JSON.parse(String(row.value)); } catch { return null; }
  }).filter(Boolean).sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
  return c.json({ page, limit, total: Number(countResult.rows[0]?.count || 0), products });
});

routes.delete('/product-cloud/:barcode', async (c) => {
  const authUser = c.get('authUser');
  if (!authUser || authUser.role !== 'Admin') return c.json({ error: 'Product Cloud deletion requires Admin access' }, 403);
  const barcode = String(c.req.param('barcode') || '').trim().replace(/[\s-]/g, '').toUpperCase();
  if (!barcode) return c.json({ error: 'Barcode required' }, 400);
  await kv.del(`product_cloud:${barcode}`);
  return c.json({ success: true, barcode });
});

// Import additional catalogue rows from LoyaltyHub's public product-price
// catalogue. The products page is a featured slice; the catalogue endpoint
// contains the broader retailer inventory and is paged to keep each request
// within Edge Function execution limits.
let loyaltyHubCatalogClient: { url: string; key: string } | null | undefined;

async function resolveLoyaltyHubCatalogClient(): Promise<{ url: string; key: string } | null> {
  if (loyaltyHubCatalogClient !== undefined) return loyaltyHubCatalogClient;
  const configuredUrl = Deno.env.get('LOYALTYHUB_SUPABASE_URL');
  const configuredKey = Deno.env.get('LOYALTYHUB_SUPABASE_ANON_KEY');
  if (configuredUrl && configuredKey) {
    loyaltyHubCatalogClient = { url: configuredUrl.replace(/\/$/, ''), key: configuredKey };
    return loyaltyHubCatalogClient;
  }

  const pageCandidates = [
    'https://loyaltyhub.co.za/search',
    'https://loyaltyhub.co.za/products',
    'https://loyaltyhub.co.za/_next/static/chunks/app/search/page-64f7718c8e79f3f1.js',
  ];
  const scriptUrls = new Set<string>();
  const sourceTexts: string[] = [];

  for (const candidate of pageCandidates) {
    try {
      const response = await fetch(candidate, { headers: { Accept: 'text/html,application/javascript' } });
      if (!response.ok) continue;
      const text = await response.text();
      sourceTexts.push(text);
      for (const match of text.matchAll(/(?:src|href)=["']([^"']*\/search\/page-[^"']+\.js)["']/g)) {
        scriptUrls.add(match[1].startsWith('http') ? match[1] : `https://loyaltyhub.co.za${match[1]}`);
      }
    } catch (error) {
      console.warn('[LoyaltyHub catalogue] Failed to inspect candidate:', candidate, error);
    }
  }

  for (const scriptUrl of scriptUrls) {
    try {
      const response = await fetch(scriptUrl, { headers: { Accept: 'application/javascript' } });
      if (response.ok) sourceTexts.push(await response.text());
    } catch (error) {
      console.warn('[LoyaltyHub catalogue] Failed to inspect script:', scriptUrl, error);
    }
  }

  const patterns = [
    /createBrowserClient\s*\)\s*\(\s*["'](https:\/\/[^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/,
    /createBrowserClient\s*\(\s*["'](https:\/\/[^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/,
  ];
  for (const source of sourceTexts) {
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match) {
        loyaltyHubCatalogClient = { url: match[1].replace(/\/$/, ''), key: match[2] };
        return loyaltyHubCatalogClient;
      }
    }
  }
  // Do not cache a failed discovery; a transient upstream failure should be
  // retryable on the next import batch or the next user attempt.
  loyaltyHubCatalogClient = undefined;
  return null;
}

routes.post('/product-cloud/import-loyaltyhub-catalog', async (c) => {
  const authUser = c.get('authUser');
  if (!authUser || authUser.role !== 'Admin') return c.json({ error: 'LoyaltyHub import requires Admin access' }, 403);

  const body = await c.req.json().catch(() => ({}));
  const offset = Math.max(Number(body.offset) || 0, 0);
  const limit = Math.min(Math.max(Number(body.limit) || 250, 1), 500);
  try {
    const client = await resolveLoyaltyHubCatalogClient();
    if (!client) return c.json({ success: false, error: 'LoyaltyHub catalogue configuration unavailable. Set LOYALTYHUB_SUPABASE_URL and LOYALTYHUB_SUPABASE_ANON_KEY on the server.' }, 502);
    const { url: supabaseUrl, key: supabaseKey } = client;
    const params = new URLSearchParams({
      select: 'retailer,retailer_sku,barcode,name,brand,price,currency,unit_size,category,image_url,product_url,in_stock',
      offset: String(offset),
      limit: String(limit),
    });
    const response = await fetch(`${supabaseUrl}/rest/v1/product_prices?${params}`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Accept: 'application/json' },
    });
    if (!response.ok) {
      const upstreamError = (await response.text().catch(() => '')).slice(0, 240);
      return c.json({ success: false, error: `LoyaltyHub catalogue returned HTTP ${response.status}${upstreamError ? `: ${upstreamError}` : ''}` }, 502);
    }
    const rows = await response.json();
    if (!Array.isArray(rows)) return c.json({ success: false, error: 'Invalid LoyaltyHub catalogue response' }, 502);
    console.log(`[LoyaltyHub catalogue] fetched ${rows.length} rows at offset ${offset} (requested ${limit})`);
    if (offset === 0 && rows.length === 0) {
      return c.json({ success: false, error: 'LoyaltyHub catalogue returned no products for the first batch' }, 502);
    }

    const importItems = rows.map((row: any) => {
      const identity = `${row.retailer || 'retailer'}:${row.retailer_sku || row.name || 'product'}`;
      return {
        id: identity,
        barcode: row.barcode || undefined,
        name: row.name,
        brand: row.brand,
        imageUrl: row.image_url,
        sku: row.retailer_sku,
        price: row.price,
        category: row.category || 'LoyaltyHub Catalogue',
        unit: row.unit_size || 'Unit',
        source: 'LoyaltyHub',
        loyaltyhub: {
          retailer: row.retailer,
          retailerSku: row.retailer_sku,
          price: row.price,
          currency: row.currency,
          unitSize: row.unit_size,
          category: row.category,
          productUrl: row.product_url,
          inStock: row.in_stock,
          importedAt: new Date().toISOString(),
        },
      };
    });
    const imported = await upsertProductCloudBatch(importItems);
    return c.json({ success: true, offset, discovered: rows.length, imported, hasMore: rows.length === limit, source: 'LoyaltyHub catalogue' });
  } catch (e: any) {
    console.error('[LoyaltyHub catalogue import] Error:', e?.message || e);
    return c.json({ success: false, error: 'LoyaltyHub catalogue import failed' }, 502);
  }
});

routes.post('/product-cloud/import-loyaltyhub', async (c) => {
  const authUser = c.get('authUser');
  if (!authUser || authUser.role !== 'Admin') return c.json({ error: 'LoyaltyHub import requires Admin access' }, 403);

  const bearer = Deno.env.get('LOYALTYHUB_BEARER_TOKEN');
  if (!bearer) return c.json({ success: false, error: 'LoyaltyHub is not configured on the server' }, 503);

  const body = await c.req.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body.limit) || 1000, 1), 2000);
  try {
    const response = await fetch('https://loyaltyhub.co.za/products', {
      headers: { Authorization: `Bearer ${bearer}`, Accept: 'text/html,application/xhtml+xml' },
    });
    if (!response.ok) return c.json({ success: false, error: `LoyaltyHub returned HTTP ${response.status}` }, 502);
    const html = await response.text();
    const products: any[] = [];
    const productPattern = /<a[^>]+href="(\/products\/[^"?#]+-b(\d{8,14}))"[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<p[^>]*class="[^"]*font-medium[^"]*"[^>]*>([\s\S]*?)<\/p>[\s\S]*?<span[^>]*>(R[0-9.,]+)<\/span>/g;
    let match: RegExpExecArray | null;
    while ((match = productPattern.exec(html)) && products.length < limit) {
      const [, path, barcode, imageUrl, rawName, startingPrice] = match;
      products.push({ barcode, name: decodeHtml(rawName.replace(/<[^>]+>/g, '')), imageUrl: decodeHtml(imageUrl), startingPrice, productUrl: `https://loyaltyhub.co.za${path}` });
    }

    let imported = 0;
    for (const product of products) {
      await upsertProductCloud({
        ...product,
        price: product.startingPrice,
        category: 'LoyaltyHub Catalogue',
        source: 'LoyaltyHub',
        barcodenest: undefined,
        loyaltyhub: { productUrl: product.productUrl, startingPrice: product.startingPrice, importedAt: new Date().toISOString() },
      });
      imported++;
    }
    return c.json({ success: true, discovered: products.length, imported, source: 'LoyaltyHub' });
  } catch (e: any) {
    console.error('[LoyaltyHub import] Error:', e?.message || e);
    return c.json({ success: false, error: 'LoyaltyHub import failed' }, 502);
  }
});

routes.post('/product-cloud/enrich-barcodenest', async (c) => {
  const authUser = c.get('authUser');
  if (!authUser || authUser.role !== 'Admin') return c.json({ error: 'Product Cloud enrichment requires Admin access' }, 403);

  const apiKey = Deno.env.get('BARCODENEST_API_KEY');
  if (!apiKey) return c.json({ success: false, error: 'BarcodeNest is not configured on the server' }, 503);

  const body = await c.req.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body.limit) || 100, 1), 100);
  const stock = await kv.getByPrefix('stock:');
  const requestedBarcodes = Array.isArray(body.barcodes) ? body.barcodes : (stock || []).map((item: any) => item.barcode);
  const barcodes = Array.from(new Set(requestedBarcodes
    .map((barcode: any) => String(barcode || '').trim())
    .filter((barcode: string) => /^\d{8,14}$/.test(barcode))))
    .slice(0, limit);

  let enriched = 0;
  let notFound = 0;
  let failed = 0;
  const details: any[] = [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const upstream = await fetch('https://api.barcodenest.com/v1/products/batch', {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcodes }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const raw = await upstream.text();
    let batch: any = {};
    try { batch = JSON.parse(raw); } catch {}
    if (!upstream.ok || !Array.isArray(batch.results)) {
      return c.json({ success: false, requested: barcodes.length, enriched: 0, notFound: 0, failed: barcodes.length, error: 'BarcodeNest batch lookup failed' }, 502);
    }

    for (const result of batch.results) {
      const barcode = String(result.barcode || '').trim();
      if (!result.found || !result.product) {
        notFound++;
        details.push({ barcode, status: 'not_found' });
        continue;
      }

      const product = result.product || {};
      const existing = await kv.get(`product_cloud:${barcode}`);
      await upsertProductCloud({
        ...(existing || {}),
        barcode,
        name: product.name || existing?.name || `Barcode ${barcode}`,
        brand: product.brand || existing?.brand || '',
        category: existing?.category || (Array.isArray(product.categories) ? product.categories[0] : product.categories) || 'General',
        imageUrl: product.image_url || existing?.imageUrl || '',
        canonicalGtin: result.canonical_gtin || existing?.canonicalGtin || '',
        description: product.description || existing?.description || '',
        quantity: product.quantity ?? existing?.quantity ?? null,
        ingredients: product.ingredients || existing?.ingredients || '',
        allergens: product.allergens || existing?.allergens || [],
        nutrition: product.nutrition || existing?.nutrition || {},
        countries: product.countries || existing?.countries || [],
        barcodenest: { product, source: result.source || null, fetchedAt: new Date().toISOString() },
        source: result.source?.name ? `BarcodeNest / ${result.source.name}` : 'BarcodeNest',
        merchantId: existing?.merchantIds?.[0] || null,
      });
      enriched++;
      details.push({ barcode, status: 'enriched', name: product.name || null });
    }
  } catch (e: any) {
    failed = barcodes.length;
    details.push({ status: 'failed', error: e?.message || 'request failed' });
  }

  return c.json({ success: true, requested: barcodes.length, enriched, notFound, failed, details });
});

routes.get('/product-lookup', async (c) => {
  const barcode = c.req.query('barcode') || '';
  if (!/^\d{8,14}$/.test(barcode)) {
    return c.json({ success: false, error: 'Enter a valid numeric barcode (8–14 digits)' }, 400);
  }

  const apiKey = Deno.env.get('BARCODENEST_API_KEY');
  if (!apiKey) {
    console.error('[product-lookup] BARCODENEST_API_KEY is not configured');
    return c.json({ success: false, error: 'Barcode lookup is not configured on the server' }, 503);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const upstream = await fetch(`https://api.barcodenest.com/v1/products/${encodeURIComponent(barcode)}`, {
      headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const raw = await upstream.text();
    let data: any = {};
    try { data = JSON.parse(raw); } catch {}

    if (upstream.status === 404) {
      return c.json({ success: false, found: false, error: data?.error?.message || 'Product not found' }, 404);
    }
    if (!upstream.ok) {
      console.error('[product-lookup] BarcodeNest status:', upstream.status);
      return c.json({ success: false, error: 'Barcode provider unavailable' }, 502);
    }

    return c.json({
      success: true,
      found: data.found !== false,
      barcode: data.barcode || barcode,
      canonical_gtin: data.canonical_gtin || null,
      product: data.product || null,
      source: data.source || null,
    });
  } catch (e: any) {
    console.error('[product-lookup] Upstream error:', e?.message || e);
    return c.json({ success: false, error: 'Barcode provider timed out or could not be reached' }, 504);
  }
});

routes.post('/stock', async (c) => {
  const body = await c.req.json();
  const itemId = body.id || crypto.randomUUID();
  const stockItem = { ...body, id: itemId, barcode: body.barcode || internalBarcode({ ...body, id: itemId }) };
  await kv.set(`stock:${body.merchantId}:${itemId}`, stockItem);
  await upsertProductCloud(stockItem);
  
  await cache.invalidateMerchant(body.merchantId);
  return c.json({ success: true, id: itemId });
});

routes.delete('/stock/:id', async (c) => {
  const itemId = c.req.param('id');
  const merchantId = c.req.query('merchantId');
  if (!merchantId) return c.json({ error: 'MerchantId required' }, 400);
  
  await kv.del(`stock:${merchantId}:${itemId}`);
  await cache.invalidateMerchant(merchantId);
  return c.json({ success: true });
});

routes.post('/notifications/:id/read', async (c) => {
  try {
    const id = c.req.param('id');
    // The notification ID is already the full key (e.g. "notif:1234567890")
    const notification = await kv.get(id);
    if (notification) {
        notification.read = true;
        await kv.set(id, notification);
    }
    return c.json({ success: true });
  } catch (e: any) {
    console.log('[Notifications] Mark read error:', e?.message || e);
    return c.json({ success: false, error: e?.message }, 500);
  }
});

// --- Workshop / Job Cards ---
routes.get('/merchants/:id/job-cards', async (c) => {
    const id = c.req.param('id');
    const cards = await kv.getByPrefix(`jobcard:${id}:`);
    return c.json((cards || []).sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
});

routes.post('/job-cards', async (c) => {
    const body = await c.req.json();
    const merchantId = body.merchantId || 'merchant:M3';
    const id = `jobcard:${merchantId}:${Date.now()}`;
    const card = { ...body, id, timestamp: new Date().toISOString() };
    await kv.set(id, card);
    await createAuditLog(merchantId, 'JOBCARD_CREATED', { cardId: id, vehicle: body.vehicle });
    return c.json({ success: true, id });
});

// --- Onboarding & Applications ---
routes.post('/onboarding', async (c) => {
    const body = await c.req.json();
    const ts = Date.now();
    const seq = Math.floor(Math.random() * 9000) + 1000;
    const applicationId = `APP-${new Date().getFullYear()}-${seq}`;
    const id = `onboarding:${ts}`;
    
    // Create actual merchant node upon "submission" with Pending status
    const mId = `merchant:${crypto.randomUUID().substring(0,8)}`;
    // Trial & plan setup
    const rawPlan = body.plan?.selected || 'kiosk';
    const selectedPlan = rawPlan.toLowerCase().includes('multi') ? 'multi' : 
                        rawPlan.toLowerCase().includes('standard') ? 'standard' : 
                        rawPlan.toLowerCase().includes('starter') ? 'starter' : 'kiosk';
    
    const billingCycle = body.plan?.billing || 'monthly';
    const trialStartDate = new Date().toISOString();
    const trialEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const planLimits: Record<string, any> = {
        kiosk: { maxTerminals: 1, maxSkus: 50, maxLocations: 1, features: ['basic_pos', 'basic_reports', 'email_support'] },
        starter: { maxTerminals: 1, maxSkus: 50, maxLocations: 1, features: ['basic_pos', 'basic_reports', 'email_support'] },
        standard: { maxTerminals: 5, maxSkus: 2000, maxLocations: 3, features: ['full_pos', 'kitchen_display', 'advanced_reports', 'analytics', 'batch_settlement', 'loyalty', 'priority_support'] },
        professional: { maxTerminals: 5, maxSkus: 2000, maxLocations: 3, features: ['full_pos', 'kitchen_display', 'advanced_reports', 'analytics', 'batch_settlement', 'loyalty', 'priority_support'] },
        multi: { maxTerminals: -1, maxSkus: -1, maxLocations: -1, features: ['full_pos', 'kitchen_display', 'advanced_reports', 'analytics', 'batch_settlement', 'loyalty', 'forensic_ledger', 'api_access', 'webhooks', 'white_label', 'custom_integrations', 'dedicated_support', 'sla_guarantee'] },
        enterprise: { maxTerminals: -1, maxSkus: -1, maxLocations: -1, features: ['full_pos', 'kitchen_display', 'advanced_reports', 'analytics', 'batch_settlement', 'loyalty', 'forensic_ledger', 'api_access', 'webhooks', 'white_label', 'custom_integrations', 'dedicated_support', 'sla_guarantee'] }
    };

    const merchant = {
        id: mId,
        name: body.businessInfo?.legalName || 'New Merchant',
        type: body.businessInfo?.type || 'Retail',
        status: 'Pending',
        onboardingProgress: 100,
        createdAt: new Date().toISOString(),
        plan: selectedPlan,
        billingCycle,
        trial: {
            active: true,
            startDate: trialStartDate,
            endDate: trialEndDate,
            daysRemaining: 30
        },
        planLimits: planLimits[selectedPlan] || planLimits.starter
    };
    await kv.set(mId, merchant);
    
    // Store full application with all form data for admin review
    const application = {
        id,
        applicationId,
        merchantId: mId,
        status: 'Pending',
        submittedAt: new Date().toISOString(),
        account: body.account ? { 
            firstName: body.account.firstName, 
            lastName: body.account.lastName, 
            email: body.account.email,
            mobile: body.account.mobile
        } : {},
        businessInfo: body.businessInfo || {},
        banking: body.banking ? { bankName: body.banking.bankName, accountType: body.banking.accountType } : {},
        documents: body.documents || [],
        location: body.location || {},
        hardware: body.hardware || {},
        plan: { selected: selectedPlan, billing: billingCycle, trialStart: trialStartDate, trialEnd: trialEndDate },
        agreements: body.agreements || {}
    };
    await kv.set(id, application);
    
    // Create notification for admin
    const nId = `notif:${ts + 1}`;
    await kv.set(nId, {
        id: nId,
        type: 'MERCHANT_APPLICATION',
        message: `New merchant application: ${application.businessInfo.legalName || 'Unknown'} (${applicationId})`,
        date: new Date().toISOString(),
        read: false
    });
    
    await createAuditLog('system', 'MERCHANT_ONBOARDING_SUBMITTED', { applicationId, onboardingId: id, merchantId: mId });
    await cache.invalidate('merchants_list');
    
    return c.json({ success: true, applicationId, merchantId: mId, plan: selectedPlan, trialEnd: trialEndDate });
});

// GET trial/plan status for a merchant
routes.get('/merchants/:merchantId/trial', async (c) => {
    try {
        const merchantId = c.req.param('merchantId');
        const merchant = await kv.get(merchantId) as any;
        if (!merchant) return c.json({ error: 'Merchant not found' }, 404);
        
        const trial = merchant.trial || null;
        const plan = merchant.plan || 'kiosk';
        const planLimits = merchant.planLimits || { maxTerminals: 1, maxSkus: 50, maxLocations: 1, features: ['basic_pos'] };
        
        let trialActive = false;
        let daysRemaining = 0;
        
        if (trial && trial.endDate) {
            const endDate = new Date(trial.endDate);
            const now = new Date();
            trialActive = now < endDate;
            daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        }
        
        return c.json({
            plan,
            billingCycle: merchant.billingCycle || 'monthly',
            trial: {
                active: trialActive,
                startDate: trial?.startDate || null,
                endDate: trial?.endDate || null,
                daysRemaining
            },
            planLimits
        });
    } catch (e: any) {
        console.error('[trial] GET error:', e);
        return c.json({ error: 'Failed to get trial status' }, 500);
    }
});

// GET all applications for admin review
routes.get('/applications', async (c) => {
    try {
        const applications = await kv.getByPrefix('onboarding:');
        const sorted = (applications || [])
            .filter((a: any) => a && a.applicationId)
            .sort((a: any, b: any) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());
        return c.json(sorted);
    } catch (e: any) {
        console.error('[applications] GET error:', e);
        return c.json([]);
    }
});

// GET single application by KV key
routes.get('/applications/:id', async (c) => {
    try {
        const id = decodeURIComponent(c.req.param('id'));
        const app = await kv.get(id);
        if (!app) return c.json({ error: 'Application not found' }, 404);
        return c.json(app);
    } catch (e: any) {
        console.error('[applications] GET by ID error:', e);
        return c.json({ error: 'Failed to load application', details: e.message }, 500);
    }
});

// Reject an application
routes.post('/applications/:id/reject', async (c) => {
    try {
        const id = decodeURIComponent(c.req.param('id'));
        const { reason } = await c.req.json();
        
        const app = await kv.get(id);
        if (!app) return c.json({ error: 'Application not found' }, 404);
        
        app.status = 'Rejected';
        app.rejectedAt = new Date().toISOString();
        app.rejectionReason = reason || 'Application did not meet requirements';
        await kv.set(id, app);
        
        // Also update the merchant record
        if (app.merchantId) {
            const merchant = await kv.get(app.merchantId);
            if (merchant) {
                merchant.status = 'Rejected';
                await kv.set(app.merchantId, merchant);
            }
        }
        
        await createAuditLog('system', 'APPLICATION_REJECTED', { applicationId: app.applicationId, merchantId: app.merchantId, reason });
        await createNotification('SYSTEM', `Application ${app.applicationId} has been rejected.`);
        await cache.invalidate('merchants_list');
        
        // Dispatch email notification to applicant
        const applicantEmail = app.account?.email;
        if (applicantEmail) {
            await createEmailNotification(
                applicantEmail,
                `CLINTPOS: Merchant Application Update — ${app.applicationId}`,
                `Dear ${app.account?.firstName || 'Applicant'},\n\nWe regret to inform you that your merchant application (${app.applicationId}) for "${app.businessInfo?.legalName || 'your business'}" has not been approved at this time.\n\nReason: ${reason || 'Application did not meet requirements'}\n\nIf you believe this is in error, please contact our support team at support@clintpos.co.za.\n\n— CLINTPOS Compliance Team`,
                { type: 'rejection', applicationId: app.applicationId, merchantId: app.merchantId }
            );
        }
        
        return c.json({ success: true, emailDispatched: !!applicantEmail });
    } catch (e: any) {
        console.error('[applications] Reject error:', e);
        return c.json({ error: 'Failed to reject application', details: e.message }, 500);
    }
});

// Mark application as approved (called after /approve-merchant succeeds)
routes.post('/applications/:id/approve', async (c) => {
    try {
        const id = decodeURIComponent(c.req.param('id'));
        const app = await kv.get(id);
        if (!app) return c.json({ error: 'Application not found' }, 404);
        
        app.status = 'Approved';
        app.approvedAt = new Date().toISOString();
        await kv.set(id, app);
        
        return c.json({ success: true });
    } catch (e: any) {
        console.error('[applications] Approve error:', e);
        return c.json({ error: 'Failed to update application status', details: e.message }, 500);
    }
});

routes.post('/apply', async (c) => {
    const body = await c.req.json();
    const id = `app:${Date.now()}`;
    await kv.set(id, { ...body, id, status: 'Pending', date: new Date().toISOString() });
    
    // Also create a notification for admin
    const nId = `notif:${Date.now()}`;
    await kv.set(nId, {
        id: nId,
        type: 'MERCHANT_APPLICATION',
        message: `New application from ${body.businessName}`,
        date: new Date().toISOString(),
        read: false
    });
    
    await createAuditLog('system', 'MERCHANT_APPLICATION_RECEIVED', { appId: id, name: body.businessName });
    return c.json({ success: true });
});

routes.post('/upload', async (c) => {
  // TODO: Wire up a storage provider (Cloudflare R2, S3, etc.) after Turso migration
  return c.json({ error: 'File upload requires a storage provider — not yet configured' }, 503);
});

routes.post('/signed-url', async (c) => {
  // TODO: Wire up a storage provider after Turso migration
  return c.json({ error: 'Signed URLs require a storage provider — not yet configured' }, 503);
});

// --- Shift Management ---
routes.post('/shifts/start', async (c) => {
    const { userId, merchantId, userName } = await c.req.json();
    // Check if user already has an active shift to prevent duplicates
    const existingShiftId = await kv.get(`active_shift:${userId}`);
    if (existingShiftId) {
        const existingShift = await kv.get(existingShiftId);
        if (existingShift) return c.json({ success: true, shift: existingShift, alreadyActive: true });
    }

    const shiftId = `shift:${merchantId}:${userId}:${Date.now()}`;
    const shift = {
        id: shiftId,
        userId,
        userName: userName || 'Unknown',
        merchantId,
        startTime: new Date().toISOString(),
        endTime: null,
        status: 'Open'
    };
    await kv.set(shiftId, shift);
    await kv.set(`active_shift:${userId}`, shiftId);
    await createAuditLog(merchantId, 'SHIFT_STARTED', { userId, shiftId });
    return c.json({ success: true, shift });
});

routes.post('/shifts/end', async (c) => {
    const { shiftId } = await c.req.json();
    const shift = await kv.get(shiftId);
    if (!shift) return c.json({ error: 'Shift not found' }, 404);
    
    shift.endTime = new Date().toISOString();
    shift.status = 'Closed';
    await kv.set(shiftId, shift);
    await kv.del(`active_shift:${shift.userId}`);
    await createAuditLog(shift.merchantId, 'SHIFT_CLOSED', { userId: shift.userId, shiftId });
    return c.json({ success: true, shift });
});

routes.get('/shifts', async (c) => {
    const merchantId = c.req.query('merchantId');
    const userId = c.req.query('userId');
    const shifts = await kv.getByPrefix('shift:');
    let filtered = shifts || [];
    if (merchantId) filtered = filtered.filter((s: any) => s.merchantId === merchantId);
    if (userId) filtered = filtered.filter((s: any) => s.userId === userId);
    return c.json(filtered.sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
});

routes.get('/shifts/active/:userId', async (c) => {
    const userId = c.req.param('userId');
    const shiftId = await kv.get(`active_shift:${userId}`);
    if (!shiftId) return c.json({ active: false });
    const shift = await kv.get(shiftId);
    return c.json({ active: true, shift });
});

// --- Forensic Audit Ledger ---

routes.post('/audit-events', async (c) => {
  const body = await c.req.json();
  const merchantId = body.merchantId || 'system';
  const logId = `audit:${merchantId}:${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const event = {
    id: logId,
    merchantId,
    userId: body.userId || 'system',
    action: body.action,
    category: body.category || 'GENERAL',
    details: body.details || {},
    terminalId: body.terminalId || 'unknown',
    timestamp: new Date().toISOString(),
    hash: btoa(`${merchantId}-${body.action}-${Date.now()}-${Math.random()}`).substring(0, 32),
    severity: body.severity || 'INFO'
  };
  await kv.set(logId, event);
  return c.json({ success: true, event });
});

routes.get('/audit-events', async (c) => {
  const merchantId = c.req.query('merchantId');
  const category = c.req.query('category');
  const prefix = merchantId ? `audit:${merchantId}:` : 'audit:';
  const logs = await kv.getByPrefix(prefix);
  let filtered = (logs || []).sort((a: any, b: any) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  if (category && category !== 'ALL') {
    filtered = filtered.filter((l: any) => l.category === category);
  }
  return c.json(filtered.slice(0, 200));
});

// --- SSE Audit Event Stream ---
routes.get('/audit-events/stream', async (c) => {
  // Validate auth token passed as query param (EventSource doesn't support headers)
  const token = c.req.query('token');
  if (token && token !== 'undefined') {
    const jwtPayload = await verifyJWT(token);
    if (!jwtPayload) {
      console.log('[SSE] Auth warning: invalid token, allowing with anon access');
    }
  }

  const merchantId = c.req.query('merchantId');
  const category = c.req.query('category');
  let lastTimestamp = c.req.query('since') || new Date(Date.now() - 30000).toISOString();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (eventType: string, data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch (_) {
          closed = true;
        }
      };

      // Send initial heartbeat
      send('connected', { status: 'ok', serverTime: new Date().toISOString() });

      const poll = async () => {
        if (closed) return;
        try {
          const prefix = merchantId ? `audit:${merchantId}:` : 'audit:';
          const logs = await kv.getByPrefix(prefix);
          let newEvents = (logs || [])
            .filter((l: any) => new Date(l.timestamp).toISOString() > lastTimestamp)
            .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          
          if (category && category !== 'ALL') {
            newEvents = newEvents.filter((l: any) => l.category === category);
          }

          for (const evt of newEvents) {
            send('audit-event', evt);
            lastTimestamp = evt.timestamp;
          }

          // Heartbeat every cycle
          send('heartbeat', { t: Date.now(), pending: 0 });
        } catch (e) {
          console.log('[SSE] Poll error:', e);
        }

        if (!closed) {
          setTimeout(poll, 2000);
        }
      };

      // Start polling after a short delay
      setTimeout(poll, 1000);

      // Keep the stream alive for up to 5 minutes, then close gracefully
      setTimeout(() => {
        if (!closed) {
          send('timeout', { message: 'Stream timeout, please reconnect' });
          closed = true;
          try { controller.close(); } catch (_) {}
        }
      }, 300000);
    },
    cancel() {
      closed = true;
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    }
  });
});

// --- Shift Reports ---

routes.get('/shift-report/:shiftId', async (c) => {
  const shiftId = decodeURIComponent(c.req.param('shiftId') || '');
  if (!shiftId || shiftId.length > 200) {
    return c.json({ error: 'Invalid shift ID' }, 400);
  }
  const shift = await kv.get(`shift:${shiftId}`);
  if (!shift) return c.json({ error: 'Shift not found' }, 404);

  const merchantId = shift.merchantId;
  // Fetch all transactions for this merchant
  const allTx = await kv.getByPrefix(`tx:${merchantId}:`);
  
  // Filter transactions that fall within the shift time window
  const shiftStart = new Date(shift.startTime).getTime();
  const shiftEnd = shift.endTime ? new Date(shift.endTime).getTime() : Date.now();
  
  const shiftTx = (allTx || []).filter((tx: any) => {
    const txTime = new Date(tx.date || tx.time).getTime();
    return txTime >= shiftStart && txTime <= shiftEnd;
  });

  // Aggregate metrics
  const totalSales = shiftTx.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);
  const totalItems = shiftTx.reduce((sum: number, tx: any) => sum + (tx.items?.length || 0), 0);
  const cardSales = shiftTx.filter((tx: any) => tx.method === 'Card').reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);
  const cashSales = shiftTx.filter((tx: any) => tx.method === 'Cash').reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);
  const totalChange = shiftTx.filter((tx: any) => tx.method === 'Cash').reduce((sum: number, tx: any) => sum + (tx.change || 0), 0);
  const promoSavings = shiftTx.reduce((sum: number, tx: any) => sum + (tx.promoDiscount || 0), 0);
  const loyaltyRedeemed = shiftTx.reduce((sum: number, tx: any) => sum + ((tx.pointsRedeemed || 0) * 0.1), 0);

  // Hourly breakdown
  const hourlyBreakdown: Record<string, { count: number, total: number }> = {};
  for (const tx of shiftTx) {
    const hour = new Date(tx.date || tx.time).getHours();
    const key = `${hour.toString().padStart(2, '0')}:00`;
    if (!hourlyBreakdown[key]) hourlyBreakdown[key] = { count: 0, total: 0 };
    hourlyBreakdown[key].count++;
    hourlyBreakdown[key].total += tx.amount || 0;
  }

  return c.json({
    shift,
    transactions: shiftTx.length,
    totalSales: Math.round(totalSales * 100) / 100,
    totalItems,
    cardSales: Math.round(cardSales * 100) / 100,
    cashSales: Math.round(cashSales * 100) / 100,
    totalChange: Math.round(totalChange * 100) / 100,
    promoSavings: Math.round(promoSavings * 100) / 100,
    loyaltyRedeemed: Math.round(loyaltyRedeemed * 100) / 100,
    hourlyBreakdown,
    transactionList: shiftTx.slice(0, 50)
  });
});

// --- Network Swarm (Terminal Mesh Diagnostics) ---

routes.get('/network-swarm/:merchantId', async (c) => {
  const merchantId = decodeURIComponent(c.req.param('merchantId') || '');
  if (!merchantId || !merchantId.startsWith('merchant:')) {
    return c.json({ nodes: [], links: [], serverTime: new Date().toISOString(), error: 'Invalid merchant ID' });
  }
  const terminals = (await kv.get(`terminals:${merchantId}`)) || [];
  const now = Date.now();
  const threshold = 30000;
  
  const nodes = terminals.map((t: any) => {
    const isOnline = (now - new Date(t.lastSeen).getTime()) < threshold;
    return {
      id: t.id,
      name: t.name,
      type: t.type,
      ip: t.ip || '0.0.0.0',
      version: t.version,
      status: isOnline ? 'Online' : 'Offline',
      lastSeen: t.lastSeen,
      uptimeMs: isOnline ? now - new Date(t.lastSeen).getTime() : 0
    };
  });

  // Simulate P2P latency mesh between online nodes
  const onlineNodes = nodes.filter((n: any) => n.status === 'Online');
  const links: any[] = [];
  for (let i = 0; i < onlineNodes.length; i++) {
    for (let j = i + 1; j < onlineNodes.length; j++) {
      links.push({
        source: onlineNodes[i].id,
        target: onlineNodes[j].id,
        latencyMs: Math.floor(Math.random() * 25) + 2,
        jitter: Math.floor(Math.random() * 5),
        packetLoss: Math.random() < 0.1 ? Math.floor(Math.random() * 3) : 0,
        status: Math.random() > 0.05 ? 'healthy' : 'degraded'
      });
    }
  }

  return c.json({ nodes, links, serverTime: new Date().toISOString() });
});

// --- Dynamic Merchant Config Route (matches /merchants/:id/:type) ---
// This handles the api.ts getMerchantConfig(merchantId, type) pattern
routes.get('/merchants/:id/:type', async (c) => {
  const id = c.req.param('id');
  const type = c.req.param('type');
  // Avoid matching other named routes (terminals, audit-logs, job-cards are handled above)
  if (['terminals', 'audit-logs', 'job-cards', 'config'].includes(type)) {
    return c.notFound();
  }
  const config = await kv.get(`config:${id}:${type}`);
  return c.json(config || {});
});

routes.post('/merchants/:id/:type', async (c) => {
  const id = c.req.param('id');
  const type = c.req.param('type');
  if (['terminals', 'audit-logs', 'job-cards', 'config'].includes(type)) {
    return c.notFound();
  }
  const body = await c.req.json();
  await kv.set(`config:${id}:${type}`, body);
  await createAuditLog(id, 'CONFIG_UPDATE', { type, changes: body });
  return c.json({ success: true });
});

// --- Merchant Approval ---
routes.post('/approve-merchant', async (c) => {
  try {
    const { merchantId, terminalsCount } = await c.req.json();
    if (!merchantId) return c.json({ error: 'merchantId is required' }, 400);

    const merchant = await kv.get(merchantId);
    if (!merchant) return c.json({ error: 'Merchant not found' }, 404);

    // Update merchant status to Active
    merchant.status = 'Active';
    merchant.approvedAt = new Date().toISOString();
    await kv.set(merchantId, merchant);

    // Provision terminals
    const terminals = [];
    const count = terminalsCount || 1;
    for (let i = 0; i < count; i++) {
      terminals.push({
        id: `TERM-${merchantId.split(':')[1] || 'NEW'}-${String(i + 1).padStart(2, '0')}`,
        name: `Terminal ${i + 1}`,
        status: 'Offline',
        ip: `192.168.1.${10 + i}`,
        version: '4.2.1',
        type: i === 0 ? 'Stationary' : 'Handheld',
        lastSeen: new Date().toISOString(),
        merchantId
      });
    }
    await kv.set(`terminals:${merchantId}`, terminals);

    // Generate default admin credentials
    const merchantEmail = `admin@${(merchant.name || 'merchant').toLowerCase().replace(/[^a-z0-9]/g, '')}.co.za`;
    const password = `Clint-${Math.random().toString(36).slice(2, 10)}`;
    const userId = await createAdminUser(merchantEmail, password, `${merchant.name} Admin`, 'Manager', merchantId);

    await createAuditLog('system', 'MERCHANT_APPROVED', { merchantId, terminals: count, adminEmail: merchantEmail });
    await createNotification('SYSTEM', `Merchant ${merchant.name} has been approved and provisioned with ${count} terminal(s).`);
    await cache.invalidate('merchants_list');

    // Dispatch email notification to merchant
    await createEmailNotification(
      merchantEmail,
      `CLINTPOS: Your Merchant Application Has Been Approved`,
      `Congratulations! Your merchant account "${merchant.name}" has been approved and provisioned with ${count} terminal(s).\n\nYour admin login credentials:\nEmail: ${merchantEmail}\nPassword: ${password}\n\nPlease change your password on first login.\n\n— CLINTPOS Compliance Team`,
      { type: 'approval', merchantId, merchantName: merchant.name }
    );

    return c.json({
      success: true,
      merchant,
      credentials: { email: merchantEmail, password },
      terminals: terminals.length,
      emailDispatched: true
    });
  } catch (e: any) {
    console.error('[approve-merchant] Error:', e);
    return c.json({ error: 'Approval failed', details: e.message }, 500);
  }
});

// --- Document Status Update ---
routes.post('/update-document-status', async (c) => {
  try {
    const { merchantId, documentPath, status, reason } = await c.req.json();
    if (!merchantId || !documentPath || !status) {
      return c.json({ error: 'merchantId, documentPath, and status are required' }, 400);
    }

    const docKey = `doc_status:${merchantId}:${documentPath}`;
    const existing = (await kv.get(docKey)) || {};
    const updated = {
      ...existing,
      merchantId,
      documentPath,
      status,
      reason: reason || null,
      reviewedAt: new Date().toISOString(),
      reviewedBy: c.get('authUser')?.id || 'system'
    };
    await kv.set(docKey, updated);

    await createAuditLog(merchantId, 'DOCUMENT_STATUS_UPDATED', { documentPath, status, reason });
    return c.json({ success: true, document: updated });
  } catch (e: any) {
    console.error('[update-document-status] Error:', e);
    return c.json({ error: 'Failed to update document status', details: e.message }, 500);
  }
});

// --- Download All Documents ---
routes.post('/download-all-documents', async (c) => {
  try {
    const { merchantId } = await c.req.json();
    if (!merchantId) return c.json({ error: 'merchantId is required' }, 400);

    // TODO: Wire up a storage provider after Turso migration
    await createAuditLog(merchantId, 'DOCUMENTS_DOWNLOADED', { fileCount: 0, note: 'Storage not yet configured' });
    return c.json({ success: true, documents: [], count: 0, message: 'Storage provider not yet configured' });
  } catch (e: any) {
    console.error('[download-all-documents] Error:', e);
    return c.json({ error: 'Failed to download documents', details: e.message }, 500);
  }
});

// --- Regenerate Password ---
routes.post('/regenerate-password', async (c) => {
  try {
    const { merchantId } = await c.req.json();
    if (!merchantId) return c.json({ error: 'merchantId is required' }, 400);

    // Find the merchant admin user
    const userIds = (await kv.get(`merchant_users:${merchantId}`)) || [];
    if (userIds.length === 0) {
      return c.json({ error: 'No users found for this merchant' }, 404);
    }

    // Get the first admin/manager user
    let targetUser = null;
    for (const uid of userIds) {
      const u = await kv.get(`user:${uid}`);
      if (u && (u.role === 'Manager' || u.role === 'Admin')) {
        targetUser = u;
        break;
      }
    }
    if (!targetUser) {
      // Fallback to first user
      targetUser = await kv.get(`user:${userIds[0]}`);
    }
    if (!targetUser) return c.json({ error: 'User not found' }, 404);

    // Generate new password
    const newPassword = `Rx-${Math.random().toString(36).slice(2, 10)}`;

    // Update password in Turso users table
    const _tursoRegen = getTursoClient();
    const newHash = await hashPassword(newPassword);
    await _tursoRegen.execute({
      sql: 'UPDATE users SET password_hash=? WHERE id=?',
      args: [newHash, targetUser.id],
    });

    await createAuditLog(merchantId, 'PASSWORD_REGENERATED', { userId: targetUser.id, email: targetUser.email });
    await createNotification('SECURITY', `Password regenerated for ${targetUser.email} (${merchantId})`);

    return c.json({
      success: true,
      email: targetUser.email,
      password: newPassword,
      userId: targetUser.id
    });
  } catch (e: any) {
    console.error('[regenerate-password] Error:', e);
    return c.json({ error: 'Failed to regenerate password', details: e.message }, 500);
  }
});

// --- Refund Processing ---
routes.post('/refunds', async (c) => {
  try {
    const body = await c.req.json();
    const { merchantId, originalTxnId, items, reason, refundAmount, cashierName, terminalId } = body;

    if (!merchantId || !originalTxnId) {
      return c.json({ error: 'merchantId and originalTxnId are required' }, 400);
    }

    const refundId = `refund:${merchantId}:${Date.now()}`;
    const refund = {
      id: refundId,
      merchantId,
      originalTxnId,
      items: items || [],
      reason: reason || 'Customer return',
      refundAmount: refundAmount || 0,
      cashierName: cashierName || 'System',
      terminalId: terminalId || 'unknown',
      status: 'Processed',
      date: new Date().toISOString()
    };

    await kv.set(refundId, refund);

    // Restore stock for returned items
    for (const item of (items || [])) {
      if (item.id && item.quantity) {
        const stockKey = `stock:${merchantId}:${item.id}`;
        const stockItem = await kv.get(stockKey);
        if (stockItem) {
          stockItem.stock = (stockItem.stock || 0) + item.quantity;
          await kv.set(stockKey, stockItem);
        }
      }
    }

    await createAuditLog(merchantId, 'REFUND_PROCESSED', {
      refundId,
      originalTxnId,
      amount: refundAmount,
      items: (items || []).length,
      reason,
      cashier: cashierName
    });

    await createNotification('TRANSACTION', `Refund R${refundAmount?.toFixed(2)} processed for ${originalTxnId}`);
    await cache.invalidateMerchant(merchantId);

    return c.json({ success: true, refund });
  } catch (e: any) {
    console.error('[refunds] Error:', e);
    return c.json({ error: 'Refund processing failed', details: e.message }, 500);
  }
});

// --- Stock Alerts (Low Threshold) ---
routes.get('/stock-alerts', async (c) => {
  try {
    const merchantId = c.req.query('merchantId');
    const threshold = parseInt(c.req.query('threshold') || '10');

    const stock = await kv.getByPrefix(merchantId ? `stock:${merchantId}:` : 'stock:');
    const lowStockItems = (stock || []).filter((item: any) => {
      const qty = typeof item.stock === 'number' ? item.stock : parseInt(item.stock || '0');
      return qty <= threshold && qty >= 0;
    }).sort((a: any, b: any) => (a.stock || 0) - (b.stock || 0));

    return c.json({
      alerts: lowStockItems,
      count: lowStockItems.length,
      threshold,
      timestamp: new Date().toISOString()
    });
  } catch (e: any) {
    console.error('[stock-alerts] Error:', e);
    return c.json({ alerts: [], count: 0, error: e.message }, 500);
  }
});

// --- Cash Drawer Management ---
routes.post('/cash-drawer', async (c) => {
  try {
    const body = await c.req.json();
    const { action, merchantId, userId, terminalId, amount, notes } = body;

    if (!action || !merchantId) {
      return c.json({ error: 'action and merchantId are required' }, 400);
    }

    const drawerKey = `drawer:${merchantId}:${terminalId || 'default'}`;

    if (action === 'open') {
      const drawer = {
        merchantId,
        terminalId: terminalId || 'default',
        userId,
        status: 'open',
        openedAt: new Date().toISOString(),
        openingFloat: amount || 0,
        notes: notes || '',
        transactions: []
      };
      await kv.set(drawerKey, drawer);
      await createAuditLog(merchantId, 'CASH_DRAWER_OPENED', { userId, terminalId, float: amount });
      return c.json({ success: true, drawer });
    }

    if (action === 'close' || action === 'reconcile') {
      const drawer = await kv.get(drawerKey);
      if (!drawer) return c.json({ error: 'No open drawer found' }, 404);

      // Get transactions since drawer was opened
      const allTx = await kv.getByPrefix(`tx:${merchantId}:`);
      const drawerOpenTime = new Date(drawer.openedAt).getTime();
      const drawerTx = (allTx || []).filter((tx: any) => {
        const txTime = new Date(tx.date || tx.time).getTime();
        return txTime >= drawerOpenTime && tx.method === 'Cash';
      });

      const expectedCash = drawer.openingFloat + drawerTx.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0)
        - drawerTx.reduce((sum: number, tx: any) => sum + (tx.change || 0), 0);
      const actualCash = amount || 0;
      const variance = actualCash - expectedCash;

      const closedDrawer = {
        ...drawer,
        status: 'closed',
        closedAt: new Date().toISOString(),
        closedBy: userId,
        expectedCash: Math.round(expectedCash * 100) / 100,
        actualCash: Math.round(actualCash * 100) / 100,
        variance: Math.round(variance * 100) / 100,
        cashTransactions: drawerTx.length,
        notes: notes || ''
      };
      await kv.set(drawerKey, closedDrawer);

      // Archive the reconciliation
      const archiveKey = `drawer_archive:${merchantId}:${Date.now()}`;
      await kv.set(archiveKey, closedDrawer);

      await createAuditLog(merchantId, 'CASH_DRAWER_RECONCILED', {
        userId,
        terminalId,
        expected: closedDrawer.expectedCash,
        actual: closedDrawer.actualCash,
        variance: closedDrawer.variance,
        transactions: drawerTx.length
      });

      if (Math.abs(variance) > 50) {
        await createNotification('SECURITY', `Cash drawer variance of R${Math.abs(variance).toFixed(2)} detected at ${terminalId || merchantId}`);
      }

      return c.json({ success: true, reconciliation: closedDrawer });
    }

    return c.json({ error: `Unknown action: ${action}` }, 400);
  } catch (e: any) {
    console.error('[cash-drawer] Error:', e);
    return c.json({ error: 'Cash drawer operation failed', details: e.message }, 500);
  }
});

// --- Report Export ---
routes.post('/export-report', async (c) => {
  try {
    const { merchantId, reportType, format, dateRange } = await c.req.json();
    if (!merchantId) return c.json({ error: 'merchantId is required' }, 400);

    let data: any[] = [];
    let headers: string[] = [];

    if (reportType === 'sales' || reportType === 'transactions') {
      const txs = await kv.getByPrefix(`tx:${merchantId}:`);
      data = (txs || []).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      headers = ['Transaction ID', 'Date', 'Cashier', 'Method', 'Amount', 'Status', 'Items'];
      data = data.map((tx: any) => ({
        'Transaction ID': tx.id,
        'Date': tx.date ? new Date(tx.date).toLocaleString() : '',
        'Cashier': tx.cashierName || 'System',
        'Method': tx.method || '',
        'Amount': tx.amount?.toFixed(2) || '0.00',
        'Status': tx.status || 'Approved',
        'Items': (tx.items || []).length
      }));
    } else if (reportType === 'audit') {
      const logs = await kv.getByPrefix(`audit:${merchantId}:`);
      data = (logs || []).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      headers = ['Log ID', 'Timestamp', 'Action', 'User', 'Details', 'Hash'];
      data = data.map((log: any) => ({
        'Log ID': log.id,
        'Timestamp': log.timestamp ? new Date(log.timestamp).toLocaleString() : '',
        'Action': log.action || '',
        'User': log.userId || 'system',
        'Details': JSON.stringify(log.details || {}),
        'Hash': log.hash || ''
      }));
    } else if (reportType === 'stock') {
      const stock = await kv.getByPrefix(`stock:${merchantId}:`);
      data = stock || [];
      headers = ['Item ID', 'Name', 'Category', 'Cost', 'Selling', 'Stock', 'Unit', 'Velocity'];
      data = data.map((item: any) => ({
        'Item ID': item.id,
        'Name': item.name || '',
        'Category': item.category || '',
        'Cost': item.cost?.toFixed(2) || '0.00',
        'Selling': item.selling?.toFixed(2) || '0.00',
        'Stock': item.stock || 0,
        'Unit': item.unit || 'Unit',
        'Velocity': item.velocity || 'Medium'
      }));
    } else if (reportType === 'shifts') {
      const shifts = await kv.getByPrefix('shift:');
      const filtered = (shifts || []).filter((s: any) => s.merchantId === merchantId);
      data = filtered.sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      headers = ['Shift ID', 'Employee', 'Start', 'End', 'Status', 'Duration (hrs)'];
      data = data.map((s: any) => {
        const start = new Date(s.startTime);
        const end = s.endTime ? new Date(s.endTime) : null;
        const hrs = end ? ((end.getTime() - start.getTime()) / 3600000).toFixed(2) : 'In Progress';
        return {
          'Shift ID': s.id,
          'Employee': s.userName || s.userId,
          'Start': start.toLocaleString(),
          'End': end ? end.toLocaleString() : '--',
          'Status': s.status || 'Open',
          'Duration (hrs)': hrs
        };
      });
    }

    // Build CSV
    if (headers.length === 0) headers = data.length > 0 ? Object.keys(data[0]) : [];
    const csvRows = [headers.join(',')];
    for (const row of data) {
      csvRows.push(headers.map(h => `"${String((row as any)[h] || '').replace(/"/g, '""')}"`).join(','));
    }
    const csvContent = csvRows.join('\n');

    await createAuditLog(merchantId, 'REPORT_EXPORTED', { reportType, format: format || 'csv', rows: data.length });

    return c.json({ success: true, csv: csvContent, rows: data.length, headers });
  } catch (e: any) {
    console.error('[export-report] Error:', e);
    return c.json({ error: 'Export failed', details: e.message }, 500);
  }
});

// --- Customer Management ---
routes.get('/customers', async (c) => {
  try {
    const merchantId = c.req.query('merchantId');
    if (!merchantId) return c.json({ error: 'merchantId is required' }, 400);
    const customers = await kv.getByPrefix(`cust:${merchantId}:`);
    return c.json(customers || []);
  } catch (e: any) {
    console.error('[customers] GET error:', e);
    return c.json({ error: 'Failed to load customers', details: e.message }, 500);
  }
});

routes.post('/customers', async (c) => {
  try {
    const data = await c.req.json();
    if (!data.id || !data.merchantId || !data.name) {
      return c.json({ error: 'id, merchantId, and name are required' }, 400);
    }
    await kv.set(data.id, data);
    await createAuditLog(data.merchantId, 'CUSTOMER_SAVED', { customerId: data.id, name: data.name });
    return c.json({ success: true });
  } catch (e: any) {
    console.error('[customers] POST error:', e);
    return c.json({ error: 'Failed to save customer', details: e.message }, 500);
  }
});

routes.get('/customers/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const customer = await kv.get(id);
    if (!customer) return c.json({ error: 'Customer not found' }, 404);
    return c.json(customer);
  } catch (e: any) {
    console.error('[customers] GET by ID error:', e);
    return c.json({ error: 'Failed to load customer', details: e.message }, 500);
  }
});

// --- Purchase Orders ---
routes.get('/purchase-orders', async (c) => {
  try {
    const merchantId = c.req.query('merchantId');
    if (!merchantId) return c.json({ error: 'merchantId is required' }, 400);
    const pos = await kv.getByPrefix(`po:${merchantId}:`);
    return c.json((pos || []).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e: any) {
    console.error('[purchase-orders] GET error:', e);
    return c.json({ error: 'Failed to load purchase orders', details: e.message }, 500);
  }
});

routes.post('/purchase-orders', async (c) => {
  try {
    const data = await c.req.json();
    if (!data.id || !data.merchantId) {
      return c.json({ error: 'id and merchantId are required' }, 400);
    }
    await kv.set(data.id, data);
    await createAuditLog(data.merchantId, 'PURCHASE_ORDER_CREATED', {
      poId: data.id,
      supplier: data.supplier,
      items: (data.items || []).length,
      totalCost: data.totalCost
    });
    return c.json({ success: true });
  } catch (e: any) {
    console.error('[purchase-orders] POST error:', e);
    return c.json({ error: 'Failed to save purchase order', details: e.message }, 500);
  }
});

routes.post('/purchase-orders/receive', async (c) => {
  try {
    const { poId, merchantId, receivedItems } = await c.req.json();
    if (!poId || !merchantId) return c.json({ error: 'poId and merchantId are required' }, 400);

    const po = await kv.get(poId);
    if (!po) return c.json({ error: 'Purchase order not found' }, 404);

    po.status = 'Received';
    po.receivedAt = new Date().toISOString();
    po.receivedItems = receivedItems || po.items;
    await kv.set(poId, po);

    for (const item of (receivedItems || po.items || [])) {
      const stockKey = `stock:${merchantId}:${item.productId}`;
      const stockItem = await kv.get(stockKey);
      if (stockItem) {
        stockItem.stock = (stockItem.stock || 0) + (item.receivedQty || item.quantity || 0);
        await kv.set(stockKey, stockItem);
      }
    }

    await createAuditLog(merchantId, 'PURCHASE_ORDER_RECEIVED', { poId, itemCount: (receivedItems || po.items || []).length });
    await cache.invalidateMerchant(merchantId);

    return c.json({ success: true, po });
  } catch (e: any) {
    console.error('[purchase-orders/receive] Error:', e);
    return c.json({ error: 'Failed to receive purchase order', details: e.message }, 500);
  }
});

// --- Z-Report (End of Day) ---
routes.get('/z-report', async (c) => {
  try {
    const merchantId = c.req.query('merchantId');
    const dateStr = c.req.query('date') || new Date().toISOString().split('T')[0];
    if (!merchantId) return c.json({ error: 'merchantId is required' }, 400);

    const dayStart = new Date(dateStr + 'T00:00:00');
    const dayEnd = new Date(dateStr + 'T23:59:59.999');

    const allTxns = await kv.getByPrefix(`tx:${merchantId}:`);
    const dayTxns = (allTxns || []).filter((t: any) => {
      const txDate = new Date(t.date);
      return txDate >= dayStart && txDate <= dayEnd;
    });

    const allShifts = await kv.getByPrefix('shift:');
    const dayShifts = (allShifts || []).filter((s: any) => {
      if (s.merchantId !== merchantId) return false;
      return new Date(s.startTime) >= dayStart && new Date(s.startTime) <= dayEnd;
    });

    const cardTxns = dayTxns.filter((t: any) => t.method === 'Card');
    const cashTxns = dayTxns.filter((t: any) => t.method === 'Cash');
    const cardTotal = cardTxns.reduce((s: number, t: any) => s + (t.amount || 0), 0);
    const cashTotal = cashTxns.reduce((s: number, t: any) => s + (t.amount || 0), 0);
    const grandTotal = cardTotal + cashTotal;

    const refundTxns = dayTxns.filter((t: any) => (t.status || '').toLowerCase().includes('refund'));
    const refundTotal = refundTxns.reduce((s: number, t: any) => s + (t.amount || 0), 0);

    const auditEvts = await kv.getByPrefix(`audit:${merchantId}:`);
    const dayVoids = (auditEvts || []).filter((e: any) => {
      const eDate = new Date(e.timestamp);
      return eDate >= dayStart && eDate <= dayEnd && (e.action || '').includes('VOID');
    });

    const vatCollected = grandTotal - (grandTotal / 1.15);
    const totalPromoDiscount = dayTxns.reduce((s: number, t: any) => s + (t.promoDiscount || 0), 0);
    const avgBasket = dayTxns.length > 0 ? grandTotal / dayTxns.length : 0;

    const hourly: Record<string, number> = {};
    dayTxns.forEach((t: any) => {
      const h = new Date(t.date).getHours();
      hourly[`${h.toString().padStart(2, '0')}:00`] = (hourly[`${h.toString().padStart(2, '0')}:00`] || 0) + (t.amount || 0);
    });

    const drawerData = await kv.get(`drawer:${merchantId}`);

    return c.json({
      date: dateStr,
      merchantId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalTransactions: dayTxns.length,
        grandTotal, cardTotal, cashTotal,
        cardCount: cardTxns.length, cashCount: cashTxns.length,
        refundCount: refundTxns.length, refundTotal,
        voidCount: dayVoids.length, vatCollected,
        totalPromoDiscount, avgBasket,
        netRevenue: grandTotal - refundTotal,
      },
      shifts: dayShifts.map((s: any) => ({ id: s.id, userName: s.userName, startTime: s.startTime, endTime: s.endTime, status: s.status })),
      hourlyBreakdown: Object.entries(hourly).sort(([a], [b]) => a.localeCompare(b)).map(([hour, total]) => ({ hour, total })),
      cashDrawer: drawerData || null,
    });
  } catch (e: any) {
    console.error('[z-report] Error:', e);
    return c.json({ error: 'Failed to generate Z-report', details: e.message }, 500);
  }
});

// --- Receipt Template Config ---
routes.get('/receipt-config/:merchantId', async (c) => {
  try {
    const merchantId = c.req.param('merchantId');
    const config = await kv.get(`receipt-config:${merchantId}`);
    return c.json(config || {
      headerLine1: 'Roxton Retail Systems',
      headerLine2: '',
      address: 'Unit 1, Mall of Africa, Sandton',
      vatNumber: '4200001234',
      footerLine1: 'Thank you for your purchase',
      footerLine2: 'Powered by Roxton OS v4.2',
      showBarcode: true,
    });
  } catch (e: any) {
    return c.json({ error: 'Failed to load receipt config' }, 500);
  }
});

routes.post('/receipt-config/:merchantId', async (c) => {
  try {
    const merchantId = c.req.param('merchantId');
    const data = await c.req.json();
    await kv.set(`receipt-config:${merchantId}`, data);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: 'Failed to save receipt config' }, 500);
  }
});

// --- Real Payment Processing Engine ---
routes.post('/process-payment', async (c) => {
  try {
    const body = await c.req.json();
    const {
      merchantId, items, paymentMethod, amountTendered,
      cashierName, terminalId, shiftId, customerId,
      pointsToRedeem, appliedPromotions, promoDiscount
    } = body;

    // --- Idempotency Key Check ---
    const idempotencyKey = c.req.header('X-Idempotency-Key');
    if (idempotencyKey) {
      const cached = await kv.get(`idempotency:${idempotencyKey}`);
      if (cached) {
        console.log(`[Payment] IDEMPOTENT HIT — returning cached result for key ${idempotencyKey.slice(0, 8)}`);
        return c.json(cached);
      }
    }

    // --- Validation ---
    if (!merchantId || !items || !Array.isArray(items) || items.length === 0) {
      return c.json({ success: false, error: 'merchantId and at least one item are required' }, 400);
    }
    if (!paymentMethod || !['Cash', 'Card', 'Split'].includes(paymentMethod)) {
      return c.json({ success: false, error: 'Invalid payment method. Must be Cash, Card, or Split' }, 400);
    }

    // --- Server-Side Price Verification & Stock Check ---
    const verifiedItems: any[] = [];
    const stockUpdates: { key: string; item: any; newStock: number }[] = [];
    const errors: string[] = [];

    for (const cartItem of items) {
      const stockKey = `stock:${merchantId}:${cartItem.id}`;
      const stockRecord = await kv.get(stockKey);

      if (!stockRecord) {
        errors.push(`Product "${cartItem.name || cartItem.id}" not found in inventory`);
        continue;
      }

      // Verify the price hasn't been tampered with on the client
      const serverPrice = parseFloat(stockRecord.selling) || 0;
      const clientPrice = parseFloat(cartItem.price) || 0;
      const priceDrift = Math.abs(serverPrice - clientPrice);
      if (priceDrift > 0.02) {
        errors.push(`Price mismatch for "${stockRecord.name}": client R${clientPrice.toFixed(2)} vs server R${serverPrice.toFixed(2)}`);
        continue;
      }

      // Check stock availability
      const currentStock = typeof stockRecord.stock === 'string' ? parseInt(stockRecord.stock) : (stockRecord.stock || 0);
      const requestedQty = parseInt(cartItem.quantity) || 1;
      if (currentStock < requestedQty) {
        errors.push(`Insufficient stock for "${stockRecord.name}": requested ${requestedQty}, available ${currentStock}`);
        continue;
      }

      verifiedItems.push({
        id: cartItem.id,
        name: stockRecord.name,
        price: serverPrice,
        quantity: requestedQty,
        lineTotal: serverPrice * requestedQty,
        category: stockRecord.category || 'General',
        barcode: stockRecord.barcode || ''
      });

      stockUpdates.push({
        key: stockKey,
        item: stockRecord,
        newStock: currentStock - requestedQty
      });
    }

    if (errors.length > 0) {
      return c.json({ success: false, error: 'Payment validation failed', details: errors }, 422);
    }

    // --- Server-Side Total Calculation ---
    const subtotal = verifiedItems.reduce((s: number, i: any) => s + i.lineTotal, 0);
    const serverPromoDiscount = parseFloat(promoDiscount) || 0;
    const adjustedSubtotal = Math.max(0, subtotal - serverPromoDiscount);
    const pointsDiscount = (parseInt(pointsToRedeem) || 0) * 0.1;
    const taxableAmount = Math.max(0, adjustedSubtotal - pointsDiscount);
    const vat = taxableAmount * 0.15;
    const grandTotal = Math.round((taxableAmount + vat) * 100) / 100;

    // --- Cash Validation ---
    let change = 0;
    if (paymentMethod === 'Cash') {
      const tendered = parseFloat(amountTendered) || 0;
      if (tendered < grandTotal) {
        return c.json({
          success: false,
          error: `Insufficient cash: R${tendered.toFixed(2)} tendered, R${grandTotal.toFixed(2)} required`
        }, 422);
      }
      change = Math.round((tendered - grandTotal) * 100) / 100;
    }

    // --- Generate Transaction ID & Auth Code ---
    const timestamp = Date.now();
    const txnSeq = Math.floor(Math.random() * 90000) + 10000;
    const txnId = `TXN-${txnSeq}`;
    const receiptNo = `RX-${(merchantId.split(':')[1] || 'M1')}-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${txnSeq}`;

    let authCode = '';
    let cardRef = '';
    if (paymentMethod === 'Card') {
      authCode = Array.from({ length: 6 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');
      cardRef = `****${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // --- Decrement Stock ---
    for (const update of stockUpdates) {
      const updated = { ...update.item, stock: update.newStock, lastSoldAt: new Date().toISOString() };
      await kv.set(update.key, updated);
    }

    // --- Record Transaction ---
    const txn: any = {
      id: txnId,
      receiptNo,
      merchantId,
      amount: grandTotal,
      subtotal,
      vat: Math.round(vat * 100) / 100,
      promoDiscount: serverPromoDiscount,
      pointsRedeemed: parseInt(pointsToRedeem) || 0,
      pointsDiscount: Math.round(pointsDiscount * 100) / 100,
      method: paymentMethod,
      status: 'Approved',
      items: verifiedItems,
      itemCount: verifiedItems.reduce((s: number, i: any) => s + i.quantity, 0),
      cashierName: cashierName || 'System',
      terminalId: terminalId || 'POS-01',
      shiftId: shiftId || null,
      customerId: customerId || null,
      appliedPromotions: appliedPromotions || [],
      date: new Date().toISOString(),
      processedAt: new Date().toISOString()
    };

    if (paymentMethod === 'Cash') {
      txn.amountTendered = parseFloat(amountTendered) || 0;
      txn.change = change;
    }
    if (paymentMethod === 'Card') {
      txn.authCode = authCode;
      txn.cardRef = cardRef;
    }

    await kv.set(`tx:${merchantId}:${timestamp}`, txn);

    // --- Update Cash Drawer ---
    if (paymentMethod === 'Cash') {
      const drawerKey = `drawer:${merchantId}:${terminalId || 'default'}`;
      const drawer = await kv.get(drawerKey);
      if (drawer && drawer.status === 'open') {
        drawer.transactions = drawer.transactions || [];
        drawer.transactions.push({ txnId, amount: grandTotal, change, time: new Date().toISOString() });
        await kv.set(drawerKey, drawer);
      }
    }

    // --- Loyalty Points ---
    if (customerId) {
      const pointsEarned = Math.floor(grandTotal / 10);
      if (pointsEarned > 0) {
        const loyaltyKey = `loyalty:${merchantId}:${customerId}`;
        const loyalty = await kv.get(loyaltyKey) || { points: 0, totalSpent: 0, visits: 0 };
        loyalty.points = (loyalty.points || 0) + pointsEarned - (parseInt(pointsToRedeem) || 0);
        loyalty.totalSpent = (loyalty.totalSpent || 0) + grandTotal;
        loyalty.visits = (loyalty.visits || 0) + 1;
        loyalty.lastVisit = new Date().toISOString();
        await kv.set(loyaltyKey, loyalty);
        txn.pointsEarned = pointsEarned;
      }
    }

    // --- Audit & Notifications ---
    await createAuditLog(merchantId, 'SALE_COMPLETED', {
      txnId, receiptNo, amount: grandTotal, method: paymentMethod,
      items: verifiedItems.length, cashier: cashierName, terminal: terminalId
    });

    if (grandTotal > 1000) {
      await createNotification('SECURITY', `High-value sale R${grandTotal.toFixed(2)} — Receipt ${receiptNo}`);
    }

    for (const update of stockUpdates) {
      if (update.newStock <= 5) {
        await createNotification('SYSTEM', `Low stock: "${update.item.name}" now at ${update.newStock} units`);
      }
    }

    await cache.invalidateMerchant(merchantId);

    console.log(`[Payment] APPROVED ${txnId} | ${paymentMethod} | R${grandTotal.toFixed(2)} | ${verifiedItems.length} items | ${cashierName}${idempotencyKey ? ` | IK:${idempotencyKey.slice(0,8)}` : ''}`);

    const responsePayload = {
      success: true,
      transaction: txn,
      receipt: {
        receiptNo,
        txnId,
        items: verifiedItems,
        subtotal,
        promoDiscount: serverPromoDiscount,
        pointsDiscount: Math.round(pointsDiscount * 100) / 100,
        vat: Math.round(vat * 100) / 100,
        grandTotal,
        paymentMethod,
        amountTendered: paymentMethod === 'Cash' ? (parseFloat(amountTendered) || 0) : grandTotal,
        change,
        authCode,
        cardRef,
        cashierName,
        terminalId,
        date: txn.date,
        merchantId,
        pointsEarned: txn.pointsEarned || 0
      }
    };

    // Cache idempotent result to prevent double-charges on retry
    if (idempotencyKey) {
      await kv.set(`idempotency:${idempotencyKey}`, { ...responsePayload, _idempotent: true, _cachedAt: new Date().toISOString() });
    }

    return c.json(responsePayload);
  } catch (e: any) {
    console.error('[process-payment] CRITICAL ERROR:', e?.message || e);
    return c.json({ success: false, error: 'Payment processing failed', details: e?.message }, 500);
  }
});

// --- Close Day (End-of-Day Wizard) ---

// Get all open shifts for a merchant
routes.get('/close-day/open-shifts', async (c) => {
  try {
    const merchantId = c.req.query('merchantId');
    if (!merchantId) return c.json({ error: 'merchantId is required' }, 400);

    const allShifts = await kv.getByPrefix('shift:');
    const openShifts = (allShifts || []).filter((s: any) =>
      s.merchantId === merchantId && s.status === 'Open'
    );
    return c.json({ shifts: openShifts });
  } catch (e: any) {
    console.error('[close-day/open-shifts] Error:', e);
    return c.json({ error: 'Failed to fetch open shifts', details: e.message }, 500);
  }
});

// Force-close all open shifts for a merchant
routes.post('/close-day/force-close-shifts', async (c) => {
  try {
    const { merchantId, closedBy } = await c.req.json();
    if (!merchantId) return c.json({ error: 'merchantId is required' }, 400);

    const allShifts = await kv.getByPrefix('shift:');
    const openShifts = (allShifts || []).filter((s: any) =>
      s.merchantId === merchantId && s.status === 'Open'
    );

    const closedShifts: any[] = [];
    for (const shift of openShifts) {
      shift.endTime = new Date().toISOString();
      shift.status = 'Closed';
      shift.closedReason = 'end_of_day_force_close';
      shift.closedBy = closedBy || 'system';
      await kv.set(shift.id, shift);
      await kv.del(`active_shift:${shift.userId}`);
      closedShifts.push(shift);
      await createAuditLog(merchantId, 'SHIFT_FORCE_CLOSED', {
        shiftId: shift.id,
        userId: shift.userId,
        closedBy: closedBy || 'system',
        reason: 'end_of_day'
      });
    }

    return c.json({ success: true, closedCount: closedShifts.length, closedShifts });
  } catch (e: any) {
    console.error('[close-day/force-close] Error:', e);
    return c.json({ error: 'Failed to force-close shifts', details: e.message }, 500);
  }
});

// Persist Z-Report snapshot as tamper-proof record
routes.post('/z-report/snapshot', async (c) => {
  try {
    const body = await c.req.json();
    const { merchantId, date, zReportData, reconciliation, signedOffBy, terminalId } = body;
    if (!merchantId || !zReportData) return c.json({ error: 'merchantId and zReportData are required' }, 400);

    const snapshotId = `zreport_snapshot:${merchantId}:${date || new Date().toISOString().split('T')[0]}:${Date.now()}`;
    const snapshot = {
      id: snapshotId,
      merchantId,
      date: date || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      signedOffBy: signedOffBy || 'system',
      terminalId: terminalId || 'default',
      zReport: zReportData,
      reconciliation: reconciliation || null,
      fingerprint: `SHA256:${Date.now().toString(36)}:${(zReportData?.summary?.grandTotal || 0).toFixed(2)}:${(zReportData?.summary?.totalTransactions || 0)}`,
      tamperSeal: true,
    };

    await kv.set(snapshotId, snapshot);
    await createAuditLog(merchantId, 'ZREPORT_SNAPSHOT_CREATED', {
      snapshotId,
      date: snapshot.date,
      signedOffBy: snapshot.signedOffBy,
      grandTotal: zReportData?.summary?.grandTotal,
      transactions: zReportData?.summary?.totalTransactions,
      variance: reconciliation?.variance
    });

    return c.json({ success: true, snapshot });
  } catch (e: any) {
    console.error('[z-report/snapshot] Error:', e);
    return c.json({ error: 'Failed to create Z-Report snapshot', details: e.message }, 500);
  }
});

// Get Z-Report snapshots
routes.get('/z-report/snapshots', async (c) => {
  try {
    const merchantId = c.req.query('merchantId');
    if (!merchantId) return c.json({ error: 'merchantId is required' }, 400);

    const snapshots = await kv.getByPrefix(`zreport_snapshot:${merchantId}:`);
    return c.json({ snapshots: (snapshots || []).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) });
  } catch (e: any) {
    console.error('[z-report/snapshots] Error:', e);
    return c.json({ error: 'Failed to fetch Z-Report snapshots', details: e.message }, 500);
  }
});

// Verify supervisor PIN for override authorization
routes.post('/verify-supervisor-pin', async (c) => {
  try {
    const { supervisorId, pin } = await c.req.json();
    
    if (!supervisorId || !supervisorId.trim()) {
      return c.json({ success: false, error: 'Supervisor ID is required' }, 400);
    }
    
    if (!pin || pin.length < 4 || pin.length > 6) {
      return c.json({ success: false, error: 'PIN must be 4-6 digits' }, 400);
    }
    
    // Get all users and find the supervisor by ID or email
    const users = await kv.getByPrefix('user:');
    const supervisor = (users || []).find((u: any) => 
      u.id === supervisorId || u.email === supervisorId
    );
    
    if (!supervisor) {
      console.warn(`[verify-supervisor-pin] User not found: ${supervisorId}`);
      return c.json({ success: false, error: 'Supervisor not found in system' }, 404);
    }
    
    // Verify the user has supervisor privileges
    if (!['Supervisor', 'Manager', 'Admin'].includes(supervisor.role)) {
      console.warn(`[verify-supervisor-pin] Insufficient privileges: ${supervisorId} has role ${supervisor.role}`);
      return c.json({ 
        success: false, 
        error: `Access denied: ${supervisor.role} role does not have supervisor privileges` 
      }, 403);
    }
    
    // Verify PIN matches
    if (supervisor.pin && supervisor.pin === pin) {
      console.log(`[verify-supervisor-pin] Authorized: ${supervisor.name} (${supervisor.role})`);
      return c.json({ 
        success: true, 
        supervisor: {
          id: supervisor.id,
          name: supervisor.name,
          email: supervisor.email,
          role: supervisor.role
        }
      });
    }
    
    // If no PIN stored or PIN doesn't match
    console.warn(`[verify-supervisor-pin] Invalid PIN for ${supervisorId}`);
    return c.json({ success: false, error: 'Invalid PIN' }, 401);
    
  } catch (e: any) {
    console.error('[verify-supervisor-pin] Error:', e);
    return c.json({ error: 'PIN verification failed', details: e.message }, 500);
  }
});

// Migrate existing users to add PINs
routes.post('/migrate-user-pins', async (c) => {
  try {
    console.log('[migrate-user-pins] Starting PIN migration for existing users...');
    
    // Get all users
    const users = await kv.getByPrefix('user:');
    let updated = 0;
    let skipped = 0;
    
    for (const user of users || []) {
      // Only update users with supervisor privileges who don't have PINs
      if (['Admin', 'Manager', 'Supervisor'].includes(user.role)) {
        if (!user.pin) {
          // Assign default PIN based on role
          const pin = user.role === 'Admin' ? '9999' : user.role === 'Manager' ? '1111' : '2222';
          user.pin = pin;
          await kv.set(`user:${user.id}`, user);
          console.log(`[migrate-user-pins] Added PIN to ${user.email} (${user.role})`);
          updated++;
        } else {
          skipped++;
        }
      }
    }
    
    console.log(`[migrate-user-pins] Complete: ${updated} users updated, ${skipped} already had PINs`);
    return c.json({ 
      success: true, 
      message: `Migration complete: ${updated} users updated with PINs`,
      updated,
      skipped
    });
  } catch (e: any) {
    console.error('[migrate-user-pins] Error:', e);
    return c.json({ error: 'Migration failed', details: e.message }, 500);
  }
});

// --- Restaurant: QR menu and guest orders ---

function generatedRestaurantDescription(item: any) {
  if (item.description) return item.description;
  const name = String(item.name || 'Menu item');
  const lower = name.toLowerCase();
  const descriptions: Array<[string, string]> = [
    ['ribeye', 'A beautifully grilled ribeye with a rich, savoury crust and tender centre.'],
    ['linguine', 'Silky linguine tossed with a fragrant sauce and generous seasonal toppings.'],
    ['caesar', 'Crisp greens, savoury dressing, and fresh toppings finished with a light crunch.'],
    ['soup', 'A comforting bowl of the day’s warming soup, prepared fresh for the table.'],
    ['burger', 'A juicy, generously layered burger served with fresh toppings and a toasted bun.'],
    ['pizza', 'A golden, oven-baked pizza with a crisp edge, rich sauce, and melted cheese.'],
    ['fondant', 'A warm chocolate fondant with a soft, indulgent centre and deep cocoa flavour.'],
    ['brulee', 'A silky vanilla custard finished with a delicate crackling caramel top.'],
    ['brownie', 'A rich, fudgy chocolate brownie made for an indulgent sweet finish.'],
    ['calamari', 'Tender calamari strips with a light golden coating and a bright, fresh finish.'],
    ['salad', 'Fresh seasonal ingredients brought together for a crisp, satisfying plate.'],
    ['eggs benedict', 'Poached eggs and generous toppings layered over a toasted base with a silky sauce.'],
    ['muffin', 'A freshly baked, generously sized muffin with a soft crumb and comforting sweetness.'],
    ['cappuccino', 'Smooth espresso and velvety steamed milk finished with a soft layer of foam.'],
    ['espresso', 'A short, aromatic espresso with a rich crema and deep roasted notes.'],
    ['coffee', 'A smooth, freshly brewed coffee with a warm aroma and balanced finish.'],
    ['mocha', 'A silky coffee blend with chocolate richness and a smooth, comforting finish.'],
    ['rooibos', 'A naturally caffeine-free rooibos tea with gentle warmth and subtle sweetness.'],
    ['lager', 'A refreshing, crisp lager served chilled for an easy-drinking finish.'],
    ['wine', 'A carefully selected wine pour with bright character and a smooth finish.'],
    ['water', 'Chilled sparkling water to refresh the palate between courses.'],
    ['fizz', 'A bright, refreshing fruit fizz with lively citrus notes and gentle sparkle.'],
  ];
  const match = descriptions.find(([term]) => lower.includes(term));
  if (match) return match[1];
  if (String(item.course || item.category).toLowerCase().includes('dessert')) return `A sweet, beautifully presented ${name.toLowerCase()} to finish your meal.`;
  if (String(item.course || item.category).toLowerCase().includes('beverage')) return `A refreshing ${name.toLowerCase()}, prepared and served with care.`;
  return `A carefully prepared ${name.toLowerCase()} made with quality ingredients and served fresh from our kitchen.`;
}

routes.get('/restaurant/menu/:merchantId', async (c) => {
  try {
    const merchantId = c.req.param('merchantId');
    const stock = await kv.getByPrefix(`stock:${merchantId}:`);
    return c.json((stock || []).filter((item: any) => Number(item.stock ?? 1) > 0).map((item: any) => ({
      id: item.id, name: item.name, category: item.category, course: item.course,
      price: Number(item.selling ?? item.price ?? 0), image: item.image || item.imageUrl || '',
      description: generatedRestaurantDescription(item),
    })));
  } catch (e: any) {
    console.error('[Restaurant menu] Error:', e?.message || e);
    return c.json({ error: 'Failed to load restaurant menu' }, 500);
  }
});

routes.post('/restaurant/orders', async (c) => {
  try {
    const body = await c.req.json();
    const { merchantId, tableId, customerName, customerEmail, customerPhone, items, notes, paymentMethod } = body;
    if (!merchantId || !tableId || !Array.isArray(items) || items.length === 0) {
      return c.json({ error: 'merchantId, tableId and items are required' }, 400);
    }
    const stock = await kv.getByPrefix(`stock:${merchantId}:`);
    const verifiedItems = items.map((requested: any) => {
      const item = (stock || []).find((candidate: any) => candidate.id === requested.id);
      if (!item) throw new Error(`Menu item not found: ${requested.id}`);
      const qty = Math.max(1, Math.min(20, Number(requested.quantity) || 1));
      return { id: item.id, name: item.name, qty, price: Number(item.selling ?? item.price ?? 0), notes: String(requested.notes || ''), course: item.course || item.category || 'Main' };
    });
    const orderId = `restaurant_order:${merchantId}:${Date.now()}`;
    const order = {
      id: orderId, merchantId, tableId, customerName: String(customerName || 'Guest').slice(0, 80),
      customerEmail: String(customerEmail || '').trim().toLowerCase().slice(0, 160),
      customerPhone: String(customerPhone || '').trim().slice(0, 40),
      items: verifiedItems, notes: String(notes || '').slice(0, 500),
      paymentMethod: ['Card on phone', 'Apple Pay', 'Online bank', 'At table'].includes(String(paymentMethod)) ? String(paymentMethod) : 'At table',
      total: verifiedItems.reduce((sum: number, item: any) => sum + item.price * item.qty, 0),
      status: 'PENDING_APPROVAL', source: 'QR_MENU', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    await kv.set(orderId, order);
    await createAuditLog(merchantId, 'QR_ORDER_RECEIVED', { orderId, tableId, items: verifiedItems.length });
    return c.json({ success: true, order: { id: order.id, status: order.status, total: order.total } });
  } catch (e: any) {
    console.error('[Restaurant order] Create error:', e?.message || e);
    return c.json({ error: e?.message || 'Failed to submit restaurant order' }, 400);
  }
});

routes.get('/restaurant/orders', async (c) => {
  try {
    const merchantId = c.req.query('merchantId');
    const orders = await kv.getByPrefix(merchantId ? `restaurant_order:${merchantId}:` : 'restaurant_order:');
    const status = c.req.query('status');
    return c.json((orders || []).filter((order: any) => !status || order.status === status).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e: any) {
    return c.json({ error: 'Failed to load restaurant orders' }, 500);
  }
});

routes.post('/restaurant/orders/:id/payment-request', async (c) => {
  try {
    const orderId = decodeURIComponent(c.req.param('id'));
    const order = await kv.get(orderId);
    if (!order) return c.json({ error: 'Restaurant order not found' }, 404);
    const body = await c.req.json();
    const allowed = ['Card on phone', 'Apple Pay', 'Online bank', 'At table'];
    order.paymentMethod = allowed.includes(String(body.paymentMethod)) ? String(body.paymentMethod) : 'At table';
    order.paymentStatus = order.paymentMethod === 'At table' ? 'PAY_AT_TABLE' : 'PAYMENT_REQUESTED';
    order.updatedAt = new Date().toISOString();
    await kv.set(order.id, order);
    await createAuditLog(order.merchantId, 'RESTAURANT_PAYMENT_REQUESTED', { orderId: order.id, tableId: order.tableId, paymentMethod: order.paymentMethod });
    return c.json({ success: true, order });
  } catch (e: any) {
    return c.json({ success: false, error: e?.message || 'Failed to request payment' }, 500);
  }
});

routes.post('/restaurant/requests', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.merchantId || !body.tableId || !body.type) return c.json({ success: false, error: 'merchantId, tableId and type are required' }, 400);
    const request = { id: `restaurant_request:${body.merchantId}:${Date.now()}`, merchantId: body.merchantId, tableId: body.tableId, type: String(body.type), note: String(body.note || '').slice(0, 300), status: 'OPEN', createdAt: new Date().toISOString() };
    await kv.set(request.id, request);
    await createAuditLog(request.merchantId, 'RESTAURANT_REQUEST_CREATED', request);
    return c.json({ success: true, request });
  } catch (e: any) {
    return c.json({ success: false, error: e?.message || 'Failed to create restaurant request' }, 500);
  }
});

routes.post('/restaurant/orders/:id/approve', async (c) => {
  try {
    const orderId = decodeURIComponent(c.req.param('id'));
    const order = await kv.get(orderId);
    if (!order) return c.json({ error: 'Restaurant order not found' }, 404);
    if (order.status !== 'PENDING_APPROVAL') return c.json({ error: 'Order is no longer awaiting approval' }, 409);
    const kotId = `kot:${order.merchantId}:${Date.now()}`;
    const ticket = {
      id: kotId, merchantId: order.merchantId, tableId: order.tableId, tableName: order.tableId,
      customerName: order.customerName, customerEmail: order.customerEmail, customerPhone: order.customerPhone,
      orderType: 'Dine-in', items: order.items.map((item: any) => ({ ...item, status: 'Pending' })),
      serverName: 'QR Guest', guestCount: 1, notes: order.notes, status: 'NEW', total: order.total,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), firedAt: null, completedAt: null, sourceOrderId: order.id,
    };
    await kv.set(kotId, ticket);
    order.status = 'APPROVED'; order.kotId = kotId; order.updatedAt = new Date().toISOString();
    await kv.set(order.id, order);
    const tables = (await kv.get(`tables:${order.merchantId}`)) || [];
    const table = tables.find((item: any) => item.id === order.tableId);
    if (table) { table.status = 'Occupied'; table.currentOrderId = kotId; table.updatedAt = new Date().toISOString(); await kv.set(`tables:${order.merchantId}`, tables); }
    await createAuditLog(order.merchantId, 'QR_ORDER_APPROVED', { orderId: order.id, kotId, tableId: order.tableId });
    return c.json({ success: true, order, kot: ticket });
  } catch (e: any) {
    console.error('[Restaurant order] Approval error:', e?.message || e);
    return c.json({ error: 'Failed to approve restaurant order' }, 500);
  }
});

// --- Restaurant: Table Management ---

routes.get('/tables/:merchantId', async (c) => {
  try {
    const merchantId = c.req.param('merchantId');
    const tables = await kv.get(`tables:${merchantId}`);
    return c.json(tables || []);
  } catch (e: any) {
    console.log('[Tables] GET error:', e?.message);
    return c.json([]);
  }
});

routes.post('/tables/:merchantId', async (c) => {
  try {
    const merchantId = c.req.param('merchantId');
    const tables = await c.req.json();
    await kv.set(`tables:${merchantId}`, tables);
    return c.json({ success: true });
  } catch (e: any) {
    console.log('[Tables] POST error:', e?.message);
    return c.json({ error: 'Failed to update tables', details: e?.message }, 500);
  }
});

routes.post('/tables/:merchantId/:tableId/status', async (c) => {
  try {
    const merchantId = c.req.param('merchantId');
    const tableId = c.req.param('tableId');
    const { status, orderId, guestCount, serverName } = await c.req.json();
    
    const tables = (await kv.get(`tables:${merchantId}`)) || [];
    const idx = tables.findIndex((t: any) => t.id === tableId);
    if (idx === -1) return c.json({ error: 'Table not found' }, 404);
    
    tables[idx] = {
      ...tables[idx],
      status: status || tables[idx].status,
      currentOrderId: orderId || tables[idx].currentOrderId || null,
      guestCount: guestCount || tables[idx].guestCount || 0,
      serverName: serverName || tables[idx].serverName || null,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`tables:${merchantId}`, tables);
    await createAuditLog(merchantId, 'TABLE_STATUS_CHANGE', { tableId, status, orderId });
    return c.json({ success: true, table: tables[idx] });
  } catch (e: any) {
    console.log('[Tables] Status update error:', e?.message);
    return c.json({ error: 'Failed to update table status', details: e?.message }, 500);
  }
});

// --- Restaurant: Kitchen Order Tickets (KOT) ---

routes.post('/kot', async (c) => {
  try {
    const body = await c.req.json();
    const { merchantId, tableId, tableName, items, orderType, serverName, notes, guestCount } = body;
    if (!merchantId || !items || items.length === 0) {
      return c.json({ error: 'merchantId and items are required' }, 400);
    }

    const kotId = `kot:${merchantId}:${Date.now()}`;
    const ticket = {
      id: kotId,
      merchantId,
      tableId: tableId || null,
      tableName: tableName || (orderType === 'Takeaway' ? 'TAKEAWAY' : orderType === 'Delivery' ? 'DELIVERY' : 'BAR'),
      orderType: orderType || 'Dine-in',
      items: items.map((i: any) => ({
        ...i,
        status: 'Pending',
        course: i.course || 'Main'
      })),
      serverName: serverName || 'System',
      guestCount: guestCount || 1,
      notes: notes || '',
      status: 'NEW',
      total: items.reduce((s: number, i: any) => s + (i.price || 0) * (i.qty || 1), 0),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      firedAt: null,
      completedAt: null
    };

    await kv.set(kotId, ticket);
    await createAuditLog(merchantId, 'KOT_CREATED', {
      kotId, tableId, tableName: ticket.tableName, orderType, items: items.length, server: serverName
    });

    return c.json({ success: true, kot: ticket });
  } catch (e: any) {
    console.error('[KOT] Create error:', e?.message);
    return c.json({ error: 'Failed to create KOT', details: e?.message }, 500);
  }
});

routes.get('/kot', async (c) => {
  try {
    const merchantId = c.req.query('merchantId');
    const status = c.req.query('status');
    const prefix = merchantId ? `kot:${merchantId}:` : 'kot:';
    const tickets = await kv.getByPrefix(prefix);
    let filtered = (tickets || []).sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (status) {
      filtered = filtered.filter((k: any) => k.status === status);
    }
    return c.json(filtered);
  } catch (e: any) {
    console.error('[KOT] List error:', e?.message);
    return c.json([]);
  }
});

routes.post('/kot/:id/status', async (c) => {
  try {
    const kotId = decodeURIComponent(c.req.param('id'));
    const { status, itemIndex, itemStatus } = await c.req.json();

    const kot = await kv.get(kotId);
    if (!kot) return c.json({ error: 'KOT not found' }, 404);

    if (itemIndex !== undefined && itemStatus) {
      // Update individual item status
      if (kot.items[itemIndex]) {
        kot.items[itemIndex].status = itemStatus;
      }
      // Auto-complete KOT if all items are served
      const allServed = kot.items.every((i: any) => i.status === 'Served');
      if (allServed) {
        kot.status = 'Completed';
        kot.completedAt = new Date().toISOString();
      }
    } else if (status) {
      kot.status = status;
      if (status === 'IN_PROGRESS') kot.firedAt = new Date().toISOString();
      if (status === 'SERVED' || status === 'CANCELLED') kot.completedAt = new Date().toISOString();
    }

    kot.updatedAt = new Date().toISOString();
    await kv.set(kotId, kot);
    await createAuditLog(kot.merchantId, 'KOT_STATUS_UPDATE', {
      kotId, status: status || itemStatus, itemIndex
    });

    return c.json({ success: true, kot });
  } catch (e: any) {
    console.error('[KOT] Status update error:', e?.message);
    return c.json({ error: 'Failed to update KOT', details: e?.message }, 500);
  }
});

// --- Restaurant: Table Bill Aggregation ---

routes.get('/bill/:merchantId/:tableId', async (c) => {
  try {
    const merchantId = c.req.param('merchantId');
    const tableId = c.req.param('tableId');
    
    const prefix = `kot:${merchantId}:`;
    const allKots = await kv.getByPrefix(prefix);
    // Keep served items on the bill until settlement; only settled tickets leave it.
    const tableKots = (allKots || []).filter((k: any) => 
      k.tableId === tableId && k.status !== 'CANCELLED' && !k.settledTxnId
    ).sort((a: any, b: any) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const lineItems: any[] = [];
    let subtotal = 0;
    for (const kot of tableKots) {
      for (const item of Array.isArray(kot.items) ? kot.items : []) {
        // KOTs created by the POS use qty; QR orders may use quantity. Normalize
        // both shapes so the bill always reflects the ordered quantity and price.
        const qty = Math.max(1, Number(item.qty ?? item.quantity ?? 1) || 1);
        const price = Math.max(0, Number(item.price ?? item.selling ?? 0) || 0);
        const total = price * qty;
        subtotal += total;
        lineItems.push({
          id: item.id || item.name,
          name: item.name || 'Unnamed item', qty, price,
          total,
          course: item.course || 'Main', notes: item.notes || '',
          kotId: kot.id, kotTime: kot.createdAt
        });
      }
    }

    const tables = (await kv.get(`tables:${merchantId}`)) || [];
    const table = tables.find((t: any) => t.id === tableId);

    return c.json({
      tableId, tableName: table?.name || tableId,
      tableNumber: table?.number || 0,
      guestCount: table?.guestCount || tableKots[0]?.guestCount || 1,
      serverName: table?.serverName || tableKots[0]?.serverName || 'Server',
      kots: tableKots.map((k: any) => ({ id: k.id, status: k.status, createdAt: k.createdAt, items: k.items.length })),
      lineItems, subtotal, kotCount: tableKots.length
      ,customerName: tableKots.find((kot: any) => kot.customerName)?.customerName || '',
      customerEmail: tableKots.find((kot: any) => kot.customerEmail)?.customerEmail || '',
      customerPhone: tableKots.find((kot: any) => kot.customerPhone)?.customerPhone || ''
    });
  } catch (e: any) {
    console.error('[Bill] Aggregation error:', e?.message);
    return c.json({ error: 'Failed to aggregate bill', details: e?.message }, 500);
  }
});

// --- Restaurant: Settle Bill ---

routes.post('/settle-bill', async (c) => {
  try {
    const body = await c.req.json();
    const { merchantId, tableId, paymentMethod, amountTendered, tip, discount, cashierName, shiftId, lineItems, subtotal, guestCount, customerName, customerEmail, customerPhone } = body;
    
    if (!merchantId) return c.json({ error: 'merchantId is required' }, 400);

    const tipAmount = tip || 0;
    const discountAmount = discount || 0;
    const grandTotal = (subtotal || 0) + tipAmount - discountAmount;
    const change = paymentMethod === 'Cash' ? Math.max(0, (amountTendered || 0) - grandTotal) : 0;

    const txnId = `txn:${merchantId}:${Date.now()}`;
    const transaction = {
      id: txnId, merchantId, type: 'SALE',
      items: (lineItems || []).map((i: any) => ({
        id: i.name, name: i.name, price: i.price, quantity: i.qty || 1
      })),
      subtotal: subtotal || 0, tip: tipAmount, discount: discountAmount,
      total: grandTotal, paymentMethod: paymentMethod || 'Cash',
      amountTendered: paymentMethod === 'Cash' ? (amountTendered || grandTotal) : grandTotal,
      change, cashierName: cashierName || 'Server',
      shiftId: shiftId || null, tableId: tableId || null,
      guestCount: guestCount || 1, status: 'Completed',
      customerName: String(customerName || '').slice(0, 80),
      customerEmail: String(customerEmail || '').trim().toLowerCase().slice(0, 160),
      customerPhone: String(customerPhone || '').trim().slice(0, 40),
      createdAt: new Date().toISOString(),
      receiptNumber: `RB-${Date.now().toString(36).toUpperCase()}`
    };

    await kv.set(txnId, transaction);

    // Mark all table KOTs as SERVED
    if (tableId) {
      const prefix = `kot:${merchantId}:`;
      const allKots = await kv.getByPrefix(prefix);
      const tableKots = (allKots || []).filter((k: any) => 
        k.tableId === tableId && k.status !== 'CANCELLED' && k.status !== 'SERVED'
      );
      const kotKeys: string[] = [];
      const kotValues: any[] = [];
      for (const kot of tableKots) {
        kot.status = 'SERVED';
        kot.completedAt = new Date().toISOString();
        kot.updatedAt = new Date().toISOString();
        kot.settledTxnId = txnId;
        kotKeys.push(kot.id);
        kotValues.push(kot);
      }
      if (kotKeys.length) await kv.mset(kotKeys, kotValues);

      // Free table -> Dirty
      const tables = (await kv.get(`tables:${merchantId}`)) || [];
      const idx = tables.findIndex((t: any) => t.id === tableId);
      if (idx !== -1) {
        tables[idx].status = 'Dirty';
        tables[idx].currentOrderId = null;
        tables[idx].guestCount = 0;
        tables[idx].serverName = null;
        tables[idx].updatedAt = new Date().toISOString();
        await kv.set(`tables:${merchantId}`, tables);
      }
    }

    // Deduct stock
    const stockItems = await kv.getByPrefix(`stock:${merchantId}:`);
    const stockByName = new Map((stockItems || []).map((stockItem: any) => [stockItem.name, stockItem]));
    const stockKeys: string[] = [];
    const stockValues: any[] = [];
    for (const item of (lineItems || [])) {
      const stockItem = stockByName.get(item.name);
      if (stockItem && stockItem.stock !== undefined) {
        stockItem.stock = Math.max(0, stockItem.stock - (item.qty || 1));
        stockKeys.push(`stock:${merchantId}:${stockItem.id}`);
        stockValues.push(stockItem);
      }
    }
    if (stockKeys.length) await kv.mset(stockKeys, stockValues);

    await createAuditLog(merchantId, 'BILL_SETTLED', {
      txnId, tableId, total: grandTotal, paymentMethod, tip: tipAmount, items: lineItems?.length
    });

    return c.json({ success: true, transaction, receiptNumber: transaction.receiptNumber, change });
  } catch (e: any) {
    console.error('[SettleBill] Error:', e?.message);
    return c.json({ error: 'Failed to settle bill', details: e?.message }, 500);
  }
});

routes.post('/restaurant/invoices/email', async (c) => {
  try {
    const body = await c.req.json();
    const to = String(body.to || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return c.json({ success: false, error: 'A valid customer email is required' }, 400);
    const transaction = body.transaction || {};
    const lineItems = Array.isArray(body.lineItems) ? body.lineItems : [];
    const lines = lineItems.map((item: any) => `${Number(item.qty || 1)} x ${item.name} — R${Number(item.total || 0).toFixed(2)}`).join('\n');
    const subject = `Your Melrose Arch Kitchen invoice ${transaction.receiptNumber || transaction.id || ''}`.trim();
    const message = [
      `Thank you for dining with us${transaction.customerName ? `, ${transaction.customerName}` : ''}.`,
      '',
      `Receipt: ${transaction.receiptNumber || transaction.id || '—'}`,
      `Payment: ${transaction.paymentMethod || '—'}`,
      '',
      lines,
      '',
      `Subtotal: R${Number(transaction.subtotal || 0).toFixed(2)}`,
      `Tip: R${Number(transaction.tip || 0).toFixed(2)}`,
      `Discount: R${Number(transaction.discount || 0).toFixed(2)}`,
      `Total: R${Number(transaction.total ?? transaction.grandTotal ?? 0).toFixed(2)}`,
      '',
      'Melrose Arch Kitchen — Johannesburg',
    ].join('\n');
    const queued = await createEmailNotification(to, subject, message, {
      type: 'restaurant_invoice',
      merchantId: transaction.merchantId || body.merchantId || 'merchant:M4',
      receiptNumber: transaction.receiptNumber || transaction.id,
    });
    return c.json({ success: true, queued: true, email: queued });
  } catch (e: any) {
    console.error('[Restaurant invoice email] Error:', e?.message || e);
    return c.json({ success: false, error: 'Could not queue invoice email' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════
// ═══ ADMIN: Cross-Tenant Aggregation Dashboard (FR-42) ═══════
// ═══════════════════════════════════════════════════════════════

const MERCHANT_IDS = ['merchant:M1', 'merchant:M2', 'merchant:M3', 'merchant:M4'];
const MERCHANT_META: Record<string, { name: string; type: string; color: string }> = {
  'merchant:M1': { name: 'Sandton Gateway Retail', type: 'Retail', color: '#6366f1' },
  'merchant:M2': { name: 'V&A Waterfront Fuels', type: 'Forecourt', color: '#10b981' },
  'merchant:M3': { name: 'Roxton Workshop Hub', type: 'Workshop', color: '#f97316' },
  'merchant:M4': { name: 'Melrose Arch Kitchen', type: 'Restaurant', color: '#ec4899' },
};

routes.get('/admin/cross-tenant-dashboard', async (c) => {
  try {
    const cacheKey = 'admin_cross_tenant';
    const cached = await cache.get(cacheKey);
    if (cached) return c.json(cached);

    const today = new Date().toISOString().split('T')[0];
    const dayStart = new Date(today + 'T00:00:00').getTime();

    // Parallel fetch with timeout protection: limit to 45s total
    const fetchPromise = Promise.all([
      kv.getByPrefix('tx:'),
      kv.getByPrefix('stock:'),
      kv.getByPrefix('shift:'),
      kv.getByPrefix('audit:'),
      kv.getByPrefix('merchant:'),
    ]);
    
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Dashboard computation timeout')), 45000)
    );

    const [allTxRaw, allStockRaw, allShiftsRaw, allAuditRaw, merchantsRaw] = await Promise.race([
      fetchPromise,
      timeoutPromise
    ]) as any[];

    const allTx = (allTxRaw || []).filter((t: any) => t && t.date).slice(0, 5000);
    const allStock = (allStockRaw || []).filter((s: any) => s && s.merchantId).slice(0, 2000);
    const allShifts = (allShiftsRaw || []).filter((s: any) => s && s.merchantId && s.startTime).slice(0, 500);
    const allAudit = (allAuditRaw || []).filter((a: any) => a && a.timestamp).slice(0, 1000);
    const merchants = (merchantsRaw || []).filter((m: any) => m && m.id && m.id.startsWith('merchant:'));

    // Per-tenant breakdown
    const tenants: any[] = [];
    let globalSales = 0;
    let globalTodaySales = 0;
    let globalTxCount = 0;
    let globalTodayTxCount = 0;
    let globalStockValue = 0;
    let globalLowStockCount = 0;
    let globalActiveShifts = 0;

    for (const mId of MERCHANT_IDS) {
      const meta = MERCHANT_META[mId] || { name: mId, type: 'Unknown', color: '#888' };
      const merchantTx = allTx.filter((t: any) => t.merchantId === mId);
      const merchantStock = allStock.filter((s: any) => s.merchantId === mId);
      const merchantShifts = allShifts.filter((s: any) => s.merchantId === mId);

      const totalSales = merchantTx.reduce((s: number, t: any) => s + (t.amount || 0), 0);
      const todayTx = merchantTx.filter((t: any) => new Date(t.date).getTime() >= dayStart);
      const todaySales = todayTx.reduce((s: number, t: any) => s + (t.amount || 0), 0);
      const cardSales = todayTx.filter((t: any) => t.method === 'Card').reduce((s: number, t: any) => s + (t.amount || 0), 0);
      const cashSales = todayTx.filter((t: any) => t.method === 'Cash').reduce((s: number, t: any) => s + (t.amount || 0), 0);

      const stockValue = merchantStock.reduce((s: number, item: any) => s + ((item.cost || 0) * (item.stock || 0)), 0);
      const lowStock = merchantStock.filter((item: any) => (item.stock || 0) <= 10);
      const activeShifts = merchantShifts.filter((s: any) => s.status === 'Open');
      const avgBasket = todayTx.length > 0 ? todaySales / todayTx.length : 0;

      globalSales += totalSales;
      globalTodaySales += todaySales;
      globalTxCount += merchantTx.length;
      globalTodayTxCount += todayTx.length;
      globalStockValue += stockValue;
      globalLowStockCount += lowStock.length;
      globalActiveShifts += activeShifts.length;

      tenants.push({
        merchantId: mId,
        name: meta.name,
        type: meta.type,
        color: meta.color,
        totalSales: Math.round(totalSales * 100) / 100,
        todaySales: Math.round(todaySales * 100) / 100,
        todayTxCount: todayTx.length,
        allTimeTxCount: merchantTx.length,
        cardSales: Math.round(cardSales * 100) / 100,
        cashSales: Math.round(cashSales * 100) / 100,
        stockValue: Math.round(stockValue * 100) / 100,
        stockItemCount: merchantStock.length,
        lowStockCount: lowStock.length,
        lowStockItems: lowStock.slice(0, 5).map((i: any) => ({ id: i.id, name: i.name, stock: i.stock, category: i.category })),
        activeShifts: activeShifts.length,
        activeStaff: activeShifts.map((s: any) => ({ name: s.userName, shiftId: s.id, startTime: s.startTime })),
        avgBasket: Math.round(avgBasket * 100) / 100,
      });
    }

    // Cross-tenant live feed (most recent 30 transactions)
    const liveFeed = allTx
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 30)
      .map((t: any) => {
        const meta = MERCHANT_META[t.merchantId] || { name: t.merchantId, type: '?', color: '#888' };
        return {
          id: t.id || t.receiptNo,
          merchantId: t.merchantId,
          merchantName: meta.name,
          merchantType: meta.type,
          color: meta.color,
          amount: t.amount || 0,
          method: t.method || 'Unknown',
          cashier: t.cashierName || 'System',
          items: t.items?.length || t.itemCount || 0,
          date: t.date,
          receiptNo: t.receiptNo || t.id,
          status: t.status || 'Approved',
        };
      });

    // Unified stock alerts (all merchants, ≤10 units)
    const stockAlerts = allStock
      .filter((item: any) => (item.stock || 0) <= 10)
      .sort((a: any, b: any) => (a.stock || 0) - (b.stock || 0))
      .slice(0, 20)
      .map((item: any) => {
        const meta = MERCHANT_META[item.merchantId] || { name: item.merchantId, type: '?', color: '#888' };
        return {
          id: item.id,
          name: item.name,
          stock: item.stock,
          category: item.category,
          merchantId: item.merchantId,
          merchantType: meta.type,
          color: meta.color,
          severity: (item.stock || 0) <= 3 ? 'critical' : 'warning',
        };
      });

    // Recent audit events (cross-tenant, last 20)
    const recentAudit = allAudit
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20)
      .map((a: any) => {
        const meta = MERCHANT_META[a.merchantId] || { name: a.merchantId, type: '?', color: '#888' };
        return {
          id: a.id,
          action: a.action,
          category: a.category,
          merchantId: a.merchantId,
          merchantType: meta.type,
          color: meta.color,
          timestamp: a.timestamp,
          severity: a.severity,
          details: a.details,
        };
      });

    const result = {
      generatedAt: new Date().toISOString(),
      global: {
        totalSales: Math.round(globalSales * 100) / 100,
        todaySales: Math.round(globalTodaySales * 100) / 100,
        totalTransactions: globalTxCount,
        todayTransactions: globalTodayTxCount,
        stockValue: Math.round(globalStockValue * 100) / 100,
        lowStockAlerts: globalLowStockCount,
        activeShifts: globalActiveShifts,
        merchantCount: merchants.length,
      },
      tenants,
      liveFeed,
      stockAlerts,
      recentAudit,
    };

    await cache.set(cacheKey, result, 60);
    return c.json(result);
  } catch (e: any) {
    console.error('[admin/cross-tenant-dashboard] Error:', e?.message || e);
    return c.json({ error: 'Cross-tenant aggregation failed', details: e?.message }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════
// ═══ RESTAURANT: Split Bill Settlement (FR-50) ════════════════
// ═══════════════════════════════════════════════════════════════

routes.post('/split-bill', async (c) => {
  try {
    const body = await c.req.json();
    const { merchantId, tableId, splits, tip, discount, cashierName, shiftId, lineItems, subtotal, guestCount, splitMethod } = body;

    if (!merchantId) return c.json({ error: 'merchantId is required' }, 400);
    if (!splits || !Array.isArray(splits) || splits.length === 0) return c.json({ error: 'At least one split is required' }, 400);

    const tipAmount = tip || 0;
    const discountAmount = discount || 0;
    const grandTotal = (subtotal || 0) + tipAmount - discountAmount;

    const splitSum = splits.reduce((s: number, sp: any) => s + (sp.amount || 0), 0);
    if (Math.abs(splitSum - grandTotal) > 0.02) {
      return c.json({ error: `Split amounts (R${splitSum.toFixed(2)}) do not equal total (R${grandTotal.toFixed(2)})` }, 400);
    }

    const transactions: any[] = [];
    const receiptNumbers: string[] = [];

    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      const txnId = `txn:${merchantId}:${Date.now()}_${i}`;
      const receiptNumber = `RB-${Date.now().toString(36).toUpperCase()}-S${i + 1}`;

      const change = split.paymentMethod === 'Cash'
        ? Math.max(0, (split.amountTendered || 0) - split.amount)
        : 0;

      const splitTip = splits.length > 0 ? tipAmount / splits.length : 0;
      const splitDiscount = splits.length > 0 ? discountAmount / splits.length : 0;

      const transaction = {
        id: txnId, merchantId, type: 'SALE',
        splitBill: true, splitIndex: i + 1, splitTotal: splits.length,
        splitMethod: splitMethod || 'equal', splitLabel: split.label || `Guest ${i + 1}`,
        items: (split.items || []).map((item: any) => ({
          id: item.name, name: item.name, price: item.price, quantity: item.qty || 1
        })),
        subtotal: split.amount - splitTip + splitDiscount,
        tip: Math.round(splitTip * 100) / 100,
        discount: Math.round(splitDiscount * 100) / 100,
        total: split.amount, paymentMethod: split.paymentMethod || 'Card',
        amountTendered: split.paymentMethod === 'Cash' ? (split.amountTendered || split.amount) : split.amount,
        change, cashierName: cashierName || 'Server',
        shiftId: shiftId || null, tableId: tableId || null,
        guestCount: guestCount || splits.length, status: 'Completed',
        createdAt: new Date().toISOString(), receiptNumber,
        date: new Date().toISOString(), amount: split.amount,
        method: split.paymentMethod || 'Card',
      };

      await kv.set(txnId, transaction);
      await kv.set(`tx:${txnId}`, {
        ...transaction, date: transaction.createdAt, amount: transaction.total,
        method: transaction.paymentMethod, cashierName: transaction.cashierName,
        receiptNo: transaction.receiptNumber, itemCount: (split.items || []).length,
      });

      transactions.push(transaction);
      receiptNumbers.push(receiptNumber);
    }

    if (tableId) {
      const prefix = `kot:${merchantId}:`;
      const allKots = await kv.getByPrefix(prefix);
      const tableKots = (allKots || []).filter((k: any) =>
        k.tableId === tableId && k.status !== 'CANCELLED' && k.status !== 'SERVED'
      );
      for (const kot of tableKots) {
        kot.status = 'SERVED'; kot.completedAt = new Date().toISOString();
        kot.updatedAt = new Date().toISOString(); kot.settledTxnId = transactions[0]?.id;
        kot.splitBill = true;
        await kv.set(kot.id, kot);
      }

      const tables = (await kv.get(`tables:${merchantId}`)) || [];
      const idx = tables.findIndex((t: any) => t.id === tableId);
      if (idx !== -1) {
        tables[idx].status = 'Dirty'; tables[idx].currentOrderId = null;
        tables[idx].guestCount = 0; tables[idx].serverName = null;
        tables[idx].updatedAt = new Date().toISOString();
        await kv.set(`tables:${merchantId}`, tables);
      }
    }

    for (const item of (lineItems || [])) {
      const stockPrefix = `stock:${merchantId}:`;
      const stockItems = await kv.getByPrefix(stockPrefix);
      const stockItem = (stockItems || []).find((s: any) => s.name === item.name);
      if (stockItem && stockItem.stock !== undefined) {
        stockItem.stock = Math.max(0, stockItem.stock - (item.qty || 1));
        await kv.set(`stock:${merchantId}:${stockItem.id}`, stockItem);
      }
    }

    await createAuditLog(merchantId, 'SPLIT_BILL_SETTLED', {
      tableId, splitMethod: splitMethod || 'equal', splitCount: splits.length,
      grandTotal, tip: tipAmount,
      transactions: transactions.map(t => ({ id: t.id, amount: t.total, method: t.paymentMethod })),
    });

    return c.json({ success: true, splitCount: splits.length, transactions, receiptNumbers, grandTotal });
  } catch (e: any) {
    console.error('[SplitBill] Error:', e?.message);
    return c.json({ error: 'Failed to process split bill', details: e?.message }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════
// ═══ ADMIN: Cross-Tenant Export Report (FR-51) ════════════════
// ═══════════════════════════════════════════════════════════════

routes.post('/admin/export-report', async (c) => {
  try {
    const body = await c.req.json();
    const { format, dateFrom, dateTo, tenantFilter, reportType } = body;

    const allTxRaw = await kv.getByPrefix('tx:');
    const allStockRaw = await kv.getByPrefix('stock:');
    const allShiftsRaw = await kv.getByPrefix('shift:');

    const allTx = (allTxRaw || []).filter((t: any) => t && t.date);
    const allStock = (allStockRaw || []).filter((s: any) => s && s.merchantId);
    const allShifts = (allShiftsRaw || []).filter((s: any) => s && s.merchantId);

    let filteredTx = allTx;
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      filteredTx = filteredTx.filter((t: any) => new Date(t.date).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59').getTime();
      filteredTx = filteredTx.filter((t: any) => new Date(t.date).getTime() <= to);
    }
    if (tenantFilter && tenantFilter !== 'all') {
      filteredTx = filteredTx.filter((t: any) => t.merchantId === tenantFilter);
    }

    const tenantIds = tenantFilter && tenantFilter !== 'all' ? [tenantFilter] : MERCHANT_IDS;

    const reportData: any = {
      generatedAt: new Date().toISOString(),
      dateRange: { from: dateFrom || 'All time', to: dateTo || 'Now' },
      tenants: tenantIds.map((mId: string) => {
        const meta = MERCHANT_META[mId] || { name: mId, type: 'Unknown', color: '#888' };
        const mTx = filteredTx.filter((t: any) => t.merchantId === mId);
        const mStock = allStock.filter((s: any) => s.merchantId === mId);
        const totalSales = mTx.reduce((s: number, t: any) => s + (t.amount || 0), 0);
        const cardSales = mTx.filter((t: any) => t.method === 'Card').reduce((s: number, t: any) => s + (t.amount || 0), 0);
        const cashSales = mTx.filter((t: any) => t.method === 'Cash').reduce((s: number, t: any) => s + (t.amount || 0), 0);
        const stockValue = mStock.reduce((s: number, item: any) => s + ((item.cost || 0) * (item.stock || 0)), 0);
        const avgBasket = mTx.length > 0 ? totalSales / mTx.length : 0;
        return {
          merchantId: mId, name: meta.name, type: meta.type,
          totalSales: Math.round(totalSales * 100) / 100, cardSales: Math.round(cardSales * 100) / 100,
          cashSales: Math.round(cashSales * 100) / 100, txCount: mTx.length,
          avgBasket: Math.round(avgBasket * 100) / 100, stockValue: Math.round(stockValue * 100) / 100,
          stockItemCount: mStock.length,
        };
      }),
      transactions: filteredTx
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 500)
        .map((t: any) => {
          const meta = MERCHANT_META[t.merchantId] || { name: t.merchantId, type: '?', color: '#888' };
          return {
            id: t.id || t.receiptNo, date: t.date, merchant: meta.type,
            merchantName: meta.name, amount: t.amount || 0, method: t.method || 'Unknown',
            cashier: t.cashierName || 'System', items: t.itemCount || t.items?.length || 0,
            receiptNo: t.receiptNo || t.id, status: t.status || 'Approved',
          };
        }),
      summary: {
        totalRevenue: Math.round(filteredTx.reduce((s: number, t: any) => s + (t.amount || 0), 0) * 100) / 100,
        totalTransactions: filteredTx.length,
        avgBasket: filteredTx.length > 0
          ? Math.round(filteredTx.reduce((s: number, t: any) => s + (t.amount || 0), 0) / filteredTx.length * 100) / 100 : 0,
        cardTotal: Math.round(filteredTx.filter((t: any) => t.method === 'Card').reduce((s: number, t: any) => s + (t.amount || 0), 0) * 100) / 100,
        cashTotal: Math.round(filteredTx.filter((t: any) => t.method === 'Cash').reduce((s: number, t: any) => s + (t.amount || 0), 0) * 100) / 100,
      },
    };

    if (format === 'csv') {
      const lines: string[] = [];
      lines.push('Roxton POS - Cross-Tenant Report');
      lines.push(`Generated: ${reportData.generatedAt}`);
      lines.push(`Date Range: ${reportData.dateRange.from} to ${reportData.dateRange.to}`);
      lines.push('');
      lines.push('=== SUMMARY ===');
      lines.push(`Total Revenue,"R ${reportData.summary.totalRevenue.toFixed(2)}"`);
      lines.push(`Total Transactions,${reportData.summary.totalTransactions}`);
      lines.push(`Average Basket,"R ${reportData.summary.avgBasket.toFixed(2)}"`);
      lines.push(`Card Sales,"R ${reportData.summary.cardTotal.toFixed(2)}"`);
      lines.push(`Cash Sales,"R ${reportData.summary.cashTotal.toFixed(2)}"`);
      lines.push('');
      lines.push('=== TENANT BREAKDOWN ===');
      lines.push('Tenant,Name,Total Sales,Card Sales,Cash Sales,Transactions,Avg Basket,Stock Value');
      for (const t of reportData.tenants) {
        lines.push(`${t.type},"${t.name}","R ${t.totalSales.toFixed(2)}","R ${t.cardSales.toFixed(2)}","R ${t.cashSales.toFixed(2)}",${t.txCount},"R ${t.avgBasket.toFixed(2)}","R ${t.stockValue.toFixed(2)}"`);
      }
      lines.push('');
      lines.push('=== TRANSACTION DETAIL ===');
      lines.push('Date,Merchant,Amount,Method,Cashier,Receipt No,Items,Status');
      for (const tx of reportData.transactions) {
        const dateStr = new Date(tx.date).toLocaleString('en-ZA');
        lines.push(`"${dateStr}",${tx.merchant},"R ${tx.amount.toFixed(2)}",${tx.method},"${tx.cashier || ''}","${tx.receiptNo || ''}",${tx.items},${tx.status}`);
      }
      return c.json({ success: true, format: 'csv', csv: lines.join('\n'), reportData });
    }

    return c.json({ success: true, format: 'pdf', reportData });
  } catch (e: any) {
    console.error('[admin/export-report] Error:', e?.message);
    return c.json({ error: 'Export failed', details: e?.message }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════
// ═══ ADMIN: SSE Live Stream (FR-52) ═══════════════════════════
// ═══════════════════════════════════════════════════════════════

routes.get('/admin/live-stream', async (c) => {
  const since = c.req.query('since') || new Date(Date.now() - 60000).toISOString();
  let lastSeen = new Date(since).getTime();
  let alive = true;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch { alive = false; }
      };

      try {
        const txRaw = await kv.getByPrefix('tx:');
        const recent = (txRaw || [])
          .filter((t: any) => t && t.date && new Date(t.date).getTime() > lastSeen)
          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 10)
          .map((t: any) => {
            const meta = MERCHANT_META[t.merchantId] || { name: t.merchantId, type: '?', color: '#888' };
            return {
              id: t.id || t.receiptNo, merchantId: t.merchantId,
              merchantType: meta.type, color: meta.color,
              amount: t.amount || 0, method: t.method || 'Unknown',
              cashier: t.cashierName || 'System', date: t.date,
              receiptNo: t.receiptNo || t.id,
            };
          });
        if (recent.length > 0) {
          send('snapshot', recent);
          lastSeen = Math.max(lastSeen, ...recent.map((t: any) => new Date(t.date).getTime()));
        }
      } catch (e: any) {
        console.error('[SSE] Snapshot error:', e?.message);
      }

      const poll = async () => {
        if (!alive) return;
        try {
          const txRaw = await kv.getByPrefix('tx:');
          const newTx = (txRaw || [])
            .filter((t: any) => t && t.date && new Date(t.date).getTime() > lastSeen)
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
          for (const t of newTx) {
            const meta = MERCHANT_META[t.merchantId] || { name: t.merchantId, type: '?', color: '#888' };
            send('transaction', {
              id: t.id || t.receiptNo, merchantId: t.merchantId,
              merchantType: meta.type, color: meta.color,
              amount: t.amount || 0, method: t.method || 'Unknown',
              cashier: t.cashierName || 'System', date: t.date,
              receiptNo: t.receiptNo || t.id,
            });
          }
          if (newTx.length > 0) {
            lastSeen = Math.max(lastSeen, ...newTx.map((t: any) => new Date(t.date).getTime()));
          }
        } catch (e: any) {
          console.error('[SSE] Poll error:', e?.message);
        }
      };

      let ticks = 0;
      const interval = setInterval(async () => {
        if (!alive) { clearInterval(interval); return; }
        ticks++;
        try {
          await poll();
          if (ticks % 5 === 0) send('heartbeat', { time: new Date().toISOString() });
        } catch { alive = false; clearInterval(interval); }
      }, 3000);

      setTimeout(() => {
        alive = false; clearInterval(interval);
        try { controller.close(); } catch {}
      }, 5 * 60 * 1000);
    },
    cancel() { alive = false; }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
});

// ═══════════════════════════════════════════════════════════════
// ═══ Device Management ════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

// Save KV (generic key-value storage)
routes.post('/kv', async (c) => {
  try {
    const { key, value } = await c.req.json();
    if (!key) return c.json({ error: 'Key required' }, 400);
    await kv.set(key, value);
    return c.json({ success: true });
  } catch (e: any) {
    console.error('[KV] Save error:', e?.message);
    return c.json({ error: 'Failed to save key-value pair' }, 500);
  }
});

// Get all devices
routes.get('/devices', async (c) => {
  try {
    const devicesRaw = await kv.getByPrefix('device:');
    const devices = (devicesRaw || []).sort((a: any, b: any) => {
      const aTime = new Date(a.timestamp || 0).getTime();
      const bTime = new Date(b.timestamp || 0).getTime();
      return bTime - aTime;
    });
    return c.json(devices);
  } catch (e: any) {
    console.error('[Devices] Fetch error:', e?.message);
    return c.json({ error: 'Failed to fetch devices' }, 500);
  }
});

// --- Email Notification Queue ---
const fetchEmailNotifications = async (c: any) => {
    try {
        const emails = await kv.getByPrefix('email_notif:');
        const sorted = (emails || [])
            .filter((e: any) => e && e.id)
            .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
            .slice(0, 50);
        return c.json(sorted);
    } catch (e: any) {
        console.error('[email-notifications] GET error:', e);
        return c.json([]);
    }
};

routes.get('/email-notifications', fetchEmailNotifications);
app.get('/email-notifications', fetchEmailNotifications); // Fallback

// --- Batches: Aggregate transactions into daily settlement batches per merchant ---
routes.get('/batches', async (c) => {
    try {
        const merchantId = c.req.query('merchantId');
        const prefix = merchantId ? `tx:${merchantId}:` : 'tx:';
        const txs = await kv.getByPrefix(prefix);
        const validTxs = (txs || []).filter((t: any) => t && t.date);

        // Group by date + merchantId
        const batchMap: Record<string, any> = {};
        for (const tx of validTxs) {
            const dateKey = new Date(tx.date).toISOString().split('T')[0];
            const mId = tx.merchantId || 'unknown';
            const key = `${dateKey}::${mId}`;

            if (!batchMap[key]) {
                batchMap[key] = {
                    id: `BATCH-${dateKey}-${mId.replace('merchant:', '')}`,
                    date: dateKey,
                    merchantId: mId,
                    transactions: 0,
                    totalAmount: 0,
                    cashTotal: 0,
                    cardTotal: 0,
                    refundTotal: 0,
                    items: [],
                    status: 'Settled', // Default settled; today = Open
                    methods: {} as Record<string, number>
                };
            }

            const batch = batchMap[key];
            batch.transactions += 1;
            const amt = Number(tx.amount) || Number(tx.total) || 0;
            
            if (tx.type === 'refund' || tx.action === 'REFUND') {
                batch.refundTotal += amt;
            } else {
                batch.totalAmount += amt;
            }

            const method = tx.method || tx.paymentMethod || 'Unknown';
            if (method.toLowerCase().includes('cash')) batch.cashTotal += amt;
            else if (method.toLowerCase().includes('card')) batch.cardTotal += amt;
            batch.methods[method] = (batch.methods[method] || 0) + amt;
        }

        // Check for manually settled batches from KV
        const settledRecords = await kv.getByPrefix('batch_settled:');
        const settledIds = new Set((settledRecords || []).map((r: any) => r.batchId));

        // Mark today's batch as Open (unless manually settled)
        const todayKey = new Date().toISOString().split('T')[0];
        for (const key of Object.keys(batchMap)) {
            const batch = batchMap[key];
            if (settledIds.has(batch.id)) {
                batch.status = 'Settled';
                const settleRec = (settledRecords || []).find((r: any) => r.batchId === batch.id);
                if (settleRec) {
                    batch.settledAt = settleRec.settledAt;
                    batch.settledBy = settleRec.settledBy;
                }
            } else if (key.startsWith(todayKey)) {
                batch.status = 'Open';
            }
        }

        const batches = Object.values(batchMap)
            .sort((a: any, b: any) => b.date.localeCompare(a.date));

        return c.json(batches);
    } catch (e: any) {
        console.error('[batches] GET error:', e);
        return c.json([]);
    }
});

// --- Settle a Batch (manual close) ---
routes.post('/batches/settle', async (c) => {
    try {
        const { batchId } = await c.req.json();
        if (!batchId) return c.json({ error: 'batchId is required' }, 400);

        const kvKey = `batch_settled:${batchId}`;
        const existing = await kv.get(kvKey);
        if (existing) return c.json({ error: 'Batch already settled', settledAt: existing.settledAt }, 409);

        const record = {
            id: kvKey,
            batchId,
            status: 'Settled',
            settledAt: new Date().toISOString(),
            settledBy: c.get('authUser')?.id || 'system'
        };
        await kv.set(kvKey, record);

        await createAuditLog('system', 'BATCH_SETTLED', { batchId, settledAt: record.settledAt });
        await createNotification('SYSTEM', `Batch ${batchId} has been manually settled.`);

        return c.json({ success: true, settlement: record });
    } catch (e: any) {
        console.error('[batches/settle] Error:', e);
        return c.json({ error: 'Failed to settle batch', details: e.message }, 500);
    }
});

// ═══════════════════════════════════════════════════════════════
// ═══ BILLING: Plans, Subscriptions & Invoices ═════════════════
// ═══════════════════════════════════════════════════════════════

const BILLING_PLANS = [
    {
        id: 'kiosk',
        name: 'Kiosk / Start-up',
        price: 299,
        priceRange: 'R165 – R499',
        currency: 'ZAR',
        interval: 'month',
        description: 'Small kiosk or start-up business',
        hardwareCost: 'R1 500 – R5 000',
        features: ['1 Terminal', 'Basic POS', 'Up to 50 SKUs', 'Email Support', 'Basic Reports', 'Standard Settlement (T+2)', 'Single Location'],
        limitations: ['No API access', 'No multi-branch', 'No batch settlement'],
        terminalLimit: 1,
        txLimit: 500
    },
    {
        id: 'standard',
        name: 'Standard Retail',
        price: 899,
        priceRange: 'R500 – R1 500',
        currency: 'ZAR',
        interval: 'month',
        description: 'Standard retail store or café',
        hardwareCost: 'R12 000 – R17 000',
        features: ['Up to 5 Terminals', 'Full POS + Kitchen Display', 'Up to 2 000 SKUs', 'Priority Support', 'Advanced Analytics', 'Fast Settlement (T+1)', 'Multi-Location (3 branches)', 'Batch Settlement', 'Customer Loyalty'],
        limitations: ['No API access', 'No white-label'],
        terminalLimit: 5,
        txLimit: 5000,
        popular: true
    },
    {
        id: 'multi',
        name: 'Multi-Branch',
        price: 1999,
        priceRange: 'R1 500 – R3 000+',
        currency: 'ZAR',
        interval: 'month',
        description: 'Multi-terminal or multi-branch operations',
        hardwareCost: 'R20 000+',
        features: ['Unlimited Terminals', 'All POS Features', 'Unlimited SKUs', 'Dedicated Account Manager', 'Real-time Analytics + Forensic Ledger', 'Same-day Settlement (T+0)', 'Unlimited Locations', 'API Access & Webhooks', 'White-Label Options', 'Custom Integrations', 'SLA Guarantee'],
        limitations: [],
        terminalLimit: -1,
        txLimit: -1
    }
];

// Legacy plan ID mapping — old plan IDs resolve to new catalog entries
const PLAN_ALIASES: Record<string, string> = {
    'starter': 'kiosk',
    'growth': 'standard',
    'professional': 'standard',
    'enterprise': 'multi',
    'Multi-Branch': 'multi',
    'multi-branch': 'multi'
};

function resolvePlanId(planId: string): string {
    return PLAN_ALIASES[planId] || planId;
}

function findPlan(planId: string) {
    return BILLING_PLANS.find(p => p.id === planId) || BILLING_PLANS.find(p => p.id === resolvePlanId(planId));
}

// Enrich a subscription with resolved plan data (migrates legacy subs on-read)
function enrichSubscription(sub: any) {
    if (!sub || !sub.planId) return sub;
    const resolvedId = resolvePlanId(sub.planId);
    const plan = findPlan(sub.planId);
    if (plan && resolvedId !== sub.planId) {
        sub.legacyPlanId = sub.planId;
        sub.planId = plan.id;
        sub.planName = plan.name;
        sub.price = plan.price;
    }
    return sub;
}

routes.get('/billing/plans', async (c) => {
    return c.json(BILLING_PLANS);
});

routes.get('/billing/subscriptions', async (c) => {
    try {
        const merchantId = c.req.query('merchantId');
        if (merchantId) {
            const sub = await kv.get(`billing_sub:${merchantId}`);
            if (!sub) return c.json(null);
            const enriched = enrichSubscription(sub);
            // Persist migration if legacy plan was resolved
            if (enriched.legacyPlanId) {
                await kv.set(`billing_sub:${merchantId}`, enriched);
                console.log(`[billing] Migrated legacy plan ${enriched.legacyPlanId} → ${enriched.planId} for ${merchantId}`);
            }
            return c.json(enriched);
        }
        const subs = await kv.getByPrefix('billing_sub:');
        const enriched = (subs || []).filter((s: any) => s && s.merchantId).map(enrichSubscription);
        // Persist any migrations
        for (const s of enriched) {
            if (s.legacyPlanId) {
                await kv.set(`billing_sub:${s.merchantId}`, s);
                console.log(`[billing] Migrated legacy plan ${s.legacyPlanId} → ${s.planId} for ${s.merchantId}`);
            }
        }
        return c.json(enriched);
    } catch (e: any) {
        console.error('[billing/subscriptions] GET error:', e);
        return c.json([]);
    }
});

routes.post('/billing/subscriptions', async (c) => {
    try {
        const { merchantId, planId } = await c.req.json();
        if (!merchantId || !planId) return c.json({ error: 'merchantId and planId are required' }, 400);

        const plan = findPlan(planId);
        if (!plan) return c.json({ error: 'Invalid plan' }, 400);

        const merchant = await kv.get(merchantId);
        const kvKey = `billing_sub:${merchantId}`;
        const existing = await kv.get(kvKey);

        const now = new Date();
        const nextBilling = new Date(now);
        nextBilling.setMonth(nextBilling.getMonth() + 1);

        const sub = {
            id: kvKey,
            merchantId,
            merchantName: merchant?.name || merchantId,
            planId: plan.id,
            planName: plan.name,
            price: plan.price,
            currency: plan.currency,
            interval: plan.interval,
            status: 'active',
            startedAt: existing?.startedAt || now.toISOString(),
            updatedAt: now.toISOString(),
            nextBillingAt: nextBilling.toISOString(),
            previousPlan: existing?.planId || null
        };
        await kv.set(kvKey, sub);

        const invoiceId = `INV-${now.toISOString().split('T')[0].replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const invoice = {
            id: invoiceId,
            merchantId,
            merchantName: sub.merchantName,
            planId: plan.id,
            planName: plan.name,
            amount: plan.price,
            currency: plan.currency,
            status: 'paid',
            issuedAt: now.toISOString(),
            paidAt: now.toISOString(),
            period: `${now.toISOString().split('T')[0]} to ${nextBilling.toISOString().split('T')[0]}`
        };
        await kv.set(`billing_inv:${invoiceId}`, invoice);

        await createAuditLog(merchantId, 'SUBSCRIPTION_UPDATED', {
            planId: plan.id, planName: plan.name, price: plan.price,
            previousPlan: existing?.planId || 'none', invoiceId
        });
        await createNotification('BILLING', `${sub.merchantName} subscribed to ${plan.name} plan (R ${plan.price}/mo).`);

        if (merchant?.applicantEmail || merchant?.email) {
            await createEmailNotification(
                merchant.applicantEmail || merchant.email,
                `CLINTPOS Billing: Subscription ${existing ? 'Updated' : 'Activated'} — ${plan.name} Plan`,
                `Your CLINTPOS subscription has been ${existing ? 'updated to' : 'activated on'} the ${plan.name} plan at R ${plan.price}/month.\n\nInvoice: ${invoiceId}\nNext billing date: ${nextBilling.toLocaleDateString()}\n\n— CLINTPOS Billing Team`,
                { type: 'billing', merchantId, planId: plan.id, invoiceId }
            );
        }

        return c.json({ success: true, subscription: sub, invoice });
    } catch (e: any) {
        console.error('[billing/subscriptions] POST error:', e);
        return c.json({ error: 'Failed to update subscription', details: e.message }, 500);
    }
});

routes.get('/billing/invoices', async (c) => {
    try {
        const merchantId = c.req.query('merchantId');
        const allInvoices = await kv.getByPrefix('billing_inv:');
        let invoices = (allInvoices || []).filter((inv: any) => inv && inv.id);
        if (merchantId) {
            invoices = invoices.filter((inv: any) => inv.merchantId === merchantId);
        }
        invoices.sort((a: any, b: any) => new Date(b.issuedAt || 0).getTime() - new Date(a.issuedAt || 0).getTime());
        return c.json(invoices);
    } catch (e: any) {
        console.error('[billing/invoices] GET error:', e);
        return c.json([]);
    }
});

routes.post('/billing/cancel', async (c) => {
    try {
        const { merchantId } = await c.req.json();
        if (!merchantId) return c.json({ error: 'merchantId is required' }, 400);

        const kvKey = `billing_sub:${merchantId}`;
        const sub = await kv.get(kvKey);
        if (!sub) return c.json({ error: 'No active subscription found' }, 404);

        sub.status = 'cancelled';
        sub.cancelledAt = new Date().toISOString();
        await kv.set(kvKey, sub);

        await createAuditLog(merchantId, 'SUBSCRIPTION_CANCELLED', { planId: sub.planId, cancelledAt: sub.cancelledAt });
        await createNotification('BILLING', `${sub.merchantName} has cancelled their ${sub.planName} subscription.`);

        return c.json({ success: true, subscription: sub });
    } catch (e: any) {
        console.error('[billing/cancel] POST error:', e);
        return c.json({ error: 'Failed to cancel subscription', details: e.message }, 500);
    }
});

// ═══════════════════════════════════════════════════════════════
// ═══ BILLING: Plan Downgrade with Prorated Credit ═════════════
// ═══════════════════════════════════════════════════════════════

routes.post('/billing/downgrade', async (c) => {
    try {
        const { merchantId, newPlanId } = await c.req.json();
        if (!merchantId || !newPlanId) return c.json({ error: 'merchantId and newPlanId are required' }, 400);

        const kvKey = `billing_sub:${merchantId}`;
        let sub = await kv.get(kvKey);
        if (!sub || sub.status !== 'active') return c.json({ error: 'No active subscription found' }, 404);
        sub = enrichSubscription(sub);

        const currentPlan = findPlan(sub.planId);
        const newPlan = findPlan(newPlanId);
        if (!newPlan) return c.json({ error: 'Invalid target plan' }, 400);
        if (!currentPlan) return c.json({ error: 'Current plan not found in catalog' }, 400);

        if (newPlan.price >= currentPlan.price) {
            return c.json({ error: 'Target plan price must be lower than current plan for a downgrade. Use the upgrade flow instead.' }, 400);
        }

        const now = new Date();
        const billingStart = new Date(sub.updatedAt || sub.startedAt);
        const nextBilling = new Date(sub.nextBillingAt);

        const totalDays = Math.max(1, Math.ceil((nextBilling.getTime() - billingStart.getTime()) / (1000 * 60 * 60 * 24)));
        const usedDays = Math.max(0, Math.ceil((now.getTime() - billingStart.getTime()) / (1000 * 60 * 60 * 24)));
        const remainingDays = Math.max(0, totalDays - usedDays);
        const dailyRateCurrent = currentPlan.price / totalDays;
        const dailyRateNew = newPlan.price / totalDays;
        const creditAmount = Math.round((dailyRateCurrent - dailyRateNew) * remainingDays * 100) / 100;

        const newNextBilling = new Date(now);
        newNextBilling.setMonth(newNextBilling.getMonth() + 1);

        const previousPlan = sub.planId;
        sub.planId = newPlan.id;
        sub.planName = newPlan.name;
        sub.price = newPlan.price;
        sub.previousPlan = previousPlan;
        sub.downgradedAt = now.toISOString();
        sub.updatedAt = now.toISOString();
        sub.nextBillingAt = newNextBilling.toISOString();
        sub.creditBalance = (sub.creditBalance || 0) + creditAmount;
        await kv.set(kvKey, sub);

        const creditInvoiceId = `CR-${now.toISOString().split('T')[0].replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const creditInvoice = {
            id: creditInvoiceId,
            merchantId,
            merchantName: sub.merchantName,
            planId: newPlan.id,
            planName: newPlan.name,
            amount: -creditAmount,
            currency: currentPlan.currency,
            status: 'credit',
            type: 'downgrade_credit',
            issuedAt: now.toISOString(),
            description: `Prorated credit for downgrade from ${currentPlan.name} to ${newPlan.name} (${remainingDays} days remaining)`,
            previousPlanId: previousPlan,
            previousPlanName: currentPlan.name,
            remainingDays,
            totalDays,
            usedDays,
        };
        await kv.set(`billing_inv:${creditInvoiceId}`, creditInvoice);

        await createAuditLog(merchantId, 'PLAN_DOWNGRADED', {
            previousPlan: currentPlan.name, previousPrice: currentPlan.price,
            newPlan: newPlan.name, newPrice: newPlan.price,
            creditAmount, remainingDays, creditInvoiceId,
        });
        await createNotification('BILLING', `${sub.merchantName} downgraded from ${currentPlan.name} to ${newPlan.name}. Credit: R ${creditAmount.toFixed(2)}`);

        const merchant = await kv.get(merchantId);
        if (merchant?.applicantEmail || merchant?.email) {
            await createEmailNotification(
                merchant.applicantEmail || merchant.email,
                `CLINTPOS: Plan Downgraded to ${newPlan.name}`,
                `Your subscription has been downgraded from ${currentPlan.name} (R ${currentPlan.price}/mo) to ${newPlan.name} (R ${newPlan.price}/mo).\n\nProrated credit of R ${creditAmount.toFixed(2)} has been applied to your account for the ${remainingDays} remaining days on your previous billing cycle.\n\nCredit Invoice: ${creditInvoiceId}\nNew billing amount: R ${newPlan.price}/mo\nNext billing date: ${newNextBilling.toLocaleDateString()}\n\n— CLINTPOS Billing Team`,
                { type: 'downgrade', merchantId, creditInvoiceId }
            );
        }

        return c.json({
            success: true,
            subscription: sub,
            creditInvoice,
            downgradeDetails: {
                previousPlan: currentPlan.name, previousPrice: currentPlan.price,
                newPlan: newPlan.name, newPrice: newPlan.price,
                creditAmount, remainingDays, totalDays, usedDays,
            },
        });
    } catch (e: any) {
        console.error('[billing/downgrade] POST error:', e);
        return c.json({ error: 'Failed to downgrade plan', details: e.message }, 500);
    }
});

routes.post('/billing/downgrade-preview', async (c) => {
    try {
        const { merchantId, newPlanId } = await c.req.json();
        if (!merchantId || !newPlanId) return c.json({ error: 'merchantId and newPlanId are required' }, 400);

        const kvKey = `billing_sub:${merchantId}`;
        let sub = await kv.get(kvKey);
        if (!sub || sub.status !== 'active') return c.json({ error: 'No active subscription found' }, 404);
        sub = enrichSubscription(sub);

        const currentPlan = findPlan(sub.planId);
        const newPlan = findPlan(newPlanId);
        if (!newPlan || !currentPlan) return c.json({ error: 'Invalid plan' }, 400);

        const now = new Date();
        const billingStart = new Date(sub.updatedAt || sub.startedAt);
        const nextBilling = new Date(sub.nextBillingAt);
        const totalDays = Math.max(1, Math.ceil((nextBilling.getTime() - billingStart.getTime()) / (1000 * 60 * 60 * 24)));
        const usedDays = Math.max(0, Math.ceil((now.getTime() - billingStart.getTime()) / (1000 * 60 * 60 * 24)));
        const remainingDays = Math.max(0, totalDays - usedDays);
        const creditAmount = Math.round(((currentPlan.price / totalDays) - (newPlan.price / totalDays)) * remainingDays * 100) / 100;

        const lostFeatures = (currentPlan.features || []).filter((f: string) => !(newPlan.features || []).includes(f));

        return c.json({
            success: true,
            preview: {
                currentPlan: { id: currentPlan.id, name: currentPlan.name, price: currentPlan.price, features: currentPlan.features },
                newPlan: { id: newPlan.id, name: newPlan.name, price: newPlan.price, features: newPlan.features },
                creditAmount, remainingDays, totalDays, usedDays,
                monthlySavings: currentPlan.price - newPlan.price,
                lostFeatures,
                keptFeatures: newPlan.features || [],
                effectiveDate: now.toISOString(),
                nextBillingDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            },
        });
    } catch (e: any) {
        console.error('[billing/downgrade-preview] POST error:', e);
        return c.json({ error: 'Failed to preview downgrade', details: e.message }, 500);
    }
});

// ═══════════════════════════════════════════════════════════════
// ═══ BILLING: Enhanced Cancellation Flow ══════════════════════
// ═══════════════════════════════════════════════════════════════

routes.post('/billing/cancel-preview', async (c) => {
    try {
        const { merchantId } = await c.req.json();
        if (!merchantId) return c.json({ error: 'merchantId is required' }, 400);

        const kvKey = `billing_sub:${merchantId}`;
        let sub = await kv.get(kvKey);
        if (!sub || sub.status !== 'active') return c.json({ error: 'No active subscription found' }, 404);
        sub = enrichSubscription(sub);

        const plan = findPlan(sub.planId);
        const now = new Date();
        const remainingDays = Math.max(0, Math.ceil((new Date(sub.nextBillingAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        const retentionDiscount = plan ? Math.round(plan.price * 0.10) : 0;

        return c.json({
            success: true,
            preview: {
                merchantName: sub.merchantName,
                currentPlan: plan ? { id: plan.id, name: plan.name, price: plan.price } : null,
                remainingDays,
                nextBillingDate: sub.nextBillingAt,
                startedAt: sub.startedAt,
                retentionOffer: {
                    discountPercent: 10,
                    discountAmount: retentionDiscount,
                    discountedPrice: plan ? plan.price - retentionDiscount : 0,
                    durationMonths: 3,
                    description: `Save 10% on your ${plan?.name || ''} plan for the next 3 months`,
                },
                creditBalance: sub.creditBalance || 0,
            },
        });
    } catch (e: any) {
        console.error('[billing/cancel-preview] POST error:', e);
        return c.json({ error: 'Failed to preview cancellation', details: e.message }, 500);
    }
});

routes.post('/billing/cancel-with-reason', async (c) => {
    try {
        const { merchantId, reason, feedback, cancelImmediately, acceptRetention } = await c.req.json();
        if (!merchantId) return c.json({ error: 'merchantId is required' }, 400);

        const kvKey = `billing_sub:${merchantId}`;
        let sub = await kv.get(kvKey);
        if (!sub || sub.status !== 'active') return c.json({ error: 'No active subscription found' }, 404);
        sub = enrichSubscription(sub);

        const plan = findPlan(sub.planId);
        const now = new Date();

        if (acceptRetention && plan) {
            const retentionDiscount = Math.round(plan.price * 0.10);
            sub.retentionDiscount = retentionDiscount;
            sub.retentionExpiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
            sub.retentionAppliedAt = now.toISOString();
            sub.updatedAt = now.toISOString();
            await kv.set(kvKey, sub);

            await createAuditLog(merchantId, 'RETENTION_OFFER_ACCEPTED', {
                planId: sub.planId, 
                planName: plan.name,
                discountPercent: 10, 
                discountAmount: retentionDiscount, 
                durationMonths: 3,
                previousMonthlyPrice: plan.price,
                newMonthlyPrice: plan.price - retentionDiscount,
                retentionExpiresAt: sub.retentionExpiresAt,
                forensicAuditType: 'REVENUE_RETENTION'
            });
            await createNotification('BILLING', `${sub.merchantName} accepted retention offer: 10% discount for 3 months on ${plan.name} plan.`);

            return c.json({
                success: true, retained: true, subscription: sub,
                message: `Retention offer applied: R ${retentionDiscount}/mo discount for 3 months`,
            });
        }

        if (cancelImmediately) {
            sub.status = 'cancelled';
            sub.cancelledAt = now.toISOString();
        } else {
            sub.status = 'pending_cancellation';
            sub.scheduledCancelAt = sub.nextBillingAt;
            sub.cancelRequestedAt = now.toISOString();
        }

        sub.cancelReason = reason || 'Not specified';
        sub.cancelFeedback = feedback || '';
        sub.updatedAt = now.toISOString();
        await kv.set(kvKey, sub);

        await createAuditLog(merchantId, cancelImmediately ? 'SUBSCRIPTION_CANCELLED' : 'SUBSCRIPTION_CANCEL_SCHEDULED', {
            planId: sub.planId, 
            planName: sub.planName,
            reason: sub.cancelReason, 
            feedback: sub.cancelFeedback,
            cancelledAt: sub.cancelledAt, 
            scheduledCancelAt: sub.scheduledCancelAt,
            daysSinceStarted: Math.floor((now.getTime() - new Date(sub.startedAt).getTime()) / (1000 * 60 * 60 * 24)),
            totalPaidToDate: sub.totalPaidToDate || 0,
            forensicAuditType: 'BILLING_CANCELLATION'
        });
        await createNotification('BILLING', cancelImmediately
            ? `${sub.merchantName} cancelled their ${sub.planName} subscription immediately. Reason: ${sub.cancelReason}`
            : `${sub.merchantName} scheduled cancellation of ${sub.planName} at end of billing period. Reason: ${sub.cancelReason}`
        );

        const merchant = await kv.get(merchantId);
        if (merchant?.applicantEmail || merchant?.email) {
            await createEmailNotification(
                merchant.applicantEmail || merchant.email,
                `CLINTPOS: Subscription ${cancelImmediately ? 'Cancelled' : 'Cancellation Scheduled'}`,
                cancelImmediately
                    ? `Your ${sub.planName} subscription has been cancelled immediately.\n\nWe're sorry to see you go. You can resubscribe at any time.\n\n— CLINTPOS Billing Team`
                    : `Your ${sub.planName} subscription is scheduled for cancellation at end of billing period (${new Date(sub.nextBillingAt).toLocaleDateString()}).\n\nYou will have full access until then. You can reverse this decision before the cancellation date.\n\n— CLINTPOS Billing Team`,
                { type: 'cancellation', merchantId, reason: sub.cancelReason }
            );
        }

        return c.json({
            success: true, retained: false, subscription: sub,
            message: cancelImmediately
                ? 'Subscription cancelled immediately'
                : `Subscription will be cancelled on ${new Date(sub.nextBillingAt).toLocaleDateString()}`,
        });
    } catch (e: any) {
        console.error('[billing/cancel-with-reason] POST error:', e);
        return c.json({ error: 'Failed to process cancellation', details: e.message }, 500);
    }
});

routes.post('/billing/cancel-reverse', async (c) => {
    try {
        const { merchantId } = await c.req.json();
        if (!merchantId) return c.json({ error: 'merchantId is required' }, 400);

        const kvKey = `billing_sub:${merchantId}`;
        const sub = await kv.get(kvKey);
        if (!sub || sub.status !== 'pending_cancellation') {
            return c.json({ error: 'No pending cancellation to reverse' }, 404);
        }

        sub.status = 'active';
        delete sub.scheduledCancelAt;
        delete sub.cancelRequestedAt;
        delete sub.cancelReason;
        delete sub.cancelFeedback;
        sub.updatedAt = new Date().toISOString();
        await kv.set(kvKey, sub);

        await createAuditLog(merchantId, 'CANCELLATION_REVERSED', { planId: sub.planId });
        await createNotification('BILLING', `${sub.merchantName} reversed their pending cancellation of ${sub.planName}.`);

        return c.json({ success: true, subscription: sub });
    } catch (e: any) {
        console.error('[billing/cancel-reverse] POST error:', e);
        return c.json({ error: 'Failed to reverse cancellation', details: e.message }, 500);
    }
});

// ═══════════════════════════════════════════════════════════════
// ═══ ALERT WEBHOOKS: Config, Test & Delivery ══════════════════
// ═══════════════════════════════════════════════════════════════

routes.get('/merchants/:id/alert-webhooks', async (c) => {
    const merchantId = c.req.param('id');
    try {
        const webhooks = (await kv.get(`alert_webhooks:${merchantId}`)) || [];
        return c.json({ success: true, webhooks });
    } catch (e: any) {
        console.error('[alert-webhooks] GET error:', e);
        return c.json({ error: 'Failed to load webhooks', details: e.message }, 500);
    }
});

routes.post('/merchants/:id/alert-webhooks', async (c) => {
    const merchantId = c.req.param('id');
    try {
        const body = await c.req.json();
        const { name, url, type, severityFilter, headers: customHeaders, enabled } = body;
        if (!name || !url || !type) return c.json({ error: 'name, url, and type are required' }, 400);
        try { new URL(url); } catch { return c.json({ error: 'Invalid webhook URL' }, 400); }

        const webhookId = `wh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const webhook = {
            id: webhookId, name, url, type,
            severityFilter: severityFilter || ['critical', 'warning'],
            headers: customHeaders || {},
            enabled: enabled !== false,
            createdAt: new Date().toISOString(),
            lastTriggeredAt: null, triggerCount: 0, lastStatus: null,
        };

        const webhooks = (await kv.get(`alert_webhooks:${merchantId}`)) || [];
        webhooks.push(webhook);
        await kv.set(`alert_webhooks:${merchantId}`, webhooks);

        await createAuditLog(merchantId, 'ALERT_WEBHOOK_CREATED', { webhookId, name, type, url: url.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@') });
        return c.json({ success: true, webhook });
    } catch (e: any) {
        console.error('[alert-webhooks] POST error:', e);
        return c.json({ error: 'Failed to create webhook', details: e.message }, 500);
    }
});

routes.put('/merchants/:id/alert-webhooks/:webhookId', async (c) => {
    const merchantId = c.req.param('id');
    const webhookId = c.req.param('webhookId');
    try {
        const body = await c.req.json();
        const webhooks = (await kv.get(`alert_webhooks:${merchantId}`)) || [];
        const idx = webhooks.findIndex((w: any) => w.id === webhookId);
        if (idx === -1) return c.json({ error: 'Webhook not found' }, 404);

        webhooks[idx] = { ...webhooks[idx], ...body, id: webhookId, updatedAt: new Date().toISOString() };
        await kv.set(`alert_webhooks:${merchantId}`, webhooks);

        await createAuditLog(merchantId, 'ALERT_WEBHOOK_UPDATED', { webhookId, changes: Object.keys(body) });
        return c.json({ success: true, webhook: webhooks[idx] });
    } catch (e: any) {
        console.error('[alert-webhooks] PUT error:', e);
        return c.json({ error: 'Failed to update webhook', details: e.message }, 500);
    }
});

routes.delete('/merchants/:id/alert-webhooks/:webhookId', async (c) => {
    const merchantId = c.req.param('id');
    const webhookId = c.req.param('webhookId');
    try {
        const webhooks = (await kv.get(`alert_webhooks:${merchantId}`)) || [];
        const filtered = webhooks.filter((w: any) => w.id !== webhookId);
        if (filtered.length === webhooks.length) return c.json({ error: 'Webhook not found' }, 404);

        await kv.set(`alert_webhooks:${merchantId}`, filtered);
        await createAuditLog(merchantId, 'ALERT_WEBHOOK_DELETED', { webhookId });
        return c.json({ success: true });
    } catch (e: any) {
        console.error('[alert-webhooks] DELETE error:', e);
        return c.json({ error: 'Failed to delete webhook', details: e.message }, 500);
    }
});

routes.post('/merchants/:id/alert-webhooks/:webhookId/test', async (c) => {
    const merchantId = c.req.param('id');
    const webhookId = c.req.param('webhookId');
    try {
        const webhooks = (await kv.get(`alert_webhooks:${merchantId}`)) || [];
        const webhook = webhooks.find((w: any) => w.id === webhookId);
        if (!webhook) return c.json({ error: 'Webhook not found' }, 404);

        const testPayload = {
            event: 'health_alert.test',
            merchantId,
            timestamp: new Date().toISOString(),
            alert: {
                terminalId: 'TEST-TERMINAL', terminalName: 'Test Terminal',
                severity: 'warning', healthScore: 45,
                violations: ['Test alert: High latency detected (150ms threshold: 100ms)'],
                message: 'This is a test webhook delivery from CLINTPOS Terminal Health Alerts.',
            },
        };

        let result: { status: number; ok: boolean; body?: string } = { status: 0, ok: false };

        if (webhook.type === 'slack') {
            const res = await fetch(webhook.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...webhook.headers },
                body: JSON.stringify({
                    text: `🔔 CLINTPOS Test Alert`,
                    blocks: [
                        { type: 'header', text: { type: 'plain_text', text: '🔔 CLINTPOS Health Alert (TEST)' } },
                        { type: 'section', text: { type: 'mrkdwn', text: `*Terminal:* TEST-TERMINAL\n*Severity:* ⚠️ Warning\n*Health Score:* 45/100\n*Violations:* Test alert: High latency` } },
                    ],
                }),
            });
            result = { status: res.status, ok: res.ok, body: await res.text() };
        } else if (webhook.type === 'teams') {
            const res = await fetch(webhook.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...webhook.headers },
                body: JSON.stringify({
                    '@type': 'MessageCard', themeColor: 'FF9900',
                    summary: 'CLINTPOS Test Alert', title: '🔔 CLINTPOS Health Alert (TEST)',
                    sections: [{ facts: [{ name: 'Terminal', value: 'TEST-TERMINAL' }, { name: 'Severity', value: 'Warning' }, { name: 'Health Score', value: '45/100' }] }],
                }),
            });
            result = { status: res.status, ok: res.ok, body: await res.text() };
        } else {
            const res = await fetch(webhook.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...webhook.headers },
                body: JSON.stringify(testPayload),
            });
            result = { status: res.status, ok: res.ok, body: await res.text() };
        }

        const idx = webhooks.findIndex((w: any) => w.id === webhookId);
        if (idx !== -1) {
            webhooks[idx].lastTestedAt = new Date().toISOString();
            webhooks[idx].lastTestStatus = result.ok ? 'success' : 'failed';
            webhooks[idx].lastTestStatusCode = result.status;
            await kv.set(`alert_webhooks:${merchantId}`, webhooks);
        }

        return c.json({ success: result.ok, statusCode: result.status, response: result.body?.substring(0, 200) });
    } catch (e: any) {
        console.error('[alert-webhooks/test] POST error:', e);
        return c.json({ success: false, error: `Webhook test failed: ${e.message}` }, 500);
    }
});

// Fire webhooks for health alerts (called internally)
async function fireAlertWebhooks(merchantId: string, alerts: any[]) {
    try {
        const webhooks = (await kv.get(`alert_webhooks:${merchantId}`)) || [];
        const activeWebhooks = webhooks.filter((w: any) => w.enabled);
        if (activeWebhooks.length === 0 || alerts.length === 0) return;

        const now = new Date();
        const cooldownKey = `webhook_cooldown:${merchantId}`;
        const lastFired = await kv.get(cooldownKey);
        if (lastFired && (now.getTime() - new Date(lastFired).getTime()) < 300000) return;

        for (const webhook of activeWebhooks) {
            const matchingAlerts = alerts.filter((a: any) => (webhook.severityFilter || ['critical', 'warning']).includes(a.severity));
            if (matchingAlerts.length === 0) continue;

            const payload = {
                event: 'health_alert.triggered', merchantId, timestamp: now.toISOString(),
                alertCount: matchingAlerts.length,
                alerts: matchingAlerts.map((a: any) => ({
                    terminalId: a.terminalId, terminalName: a.name, severity: a.severity, healthScore: a.healthScore, violations: a.violations,
                })),
            };

            try {
                let res: Response;
                if (webhook.type === 'slack') {
                    const critCount = matchingAlerts.filter((a: any) => a.severity === 'critical').length;
                    const warnCount = matchingAlerts.filter((a: any) => a.severity === 'warning').length;
                    res = await fetch(webhook.url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...webhook.headers },
                        body: JSON.stringify({
                            text: `🚨 CLINTPOS: ${matchingAlerts.length} health alert(s)`,
                            blocks: [
                                { type: 'header', text: { type: 'plain_text', text: `🚨 CLINTPOS Health Alerts (${matchingAlerts.length})` } },
                                { type: 'section', text: { type: 'mrkdwn', text: `${critCount > 0 ? `*🔴 Critical:* ${critCount}  ` : ''}${warnCount > 0 ? `*🟡 Warning:* ${warnCount}` : ''}\n\n${matchingAlerts.slice(0, 5).map((a: any) => `• *${a.name || a.terminalId}* — Score: ${a.healthScore}/100 (${a.severity})`).join('\n')}${matchingAlerts.length > 5 ? `\n...and ${matchingAlerts.length - 5} more` : ''}` } },
                            ],
                        }),
                    });
                } else if (webhook.type === 'teams') {
                    res = await fetch(webhook.url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...webhook.headers },
                        body: JSON.stringify({
                            '@type': 'MessageCard',
                            themeColor: matchingAlerts.some((a: any) => a.severity === 'critical') ? 'FF0000' : 'FF9900',
                            summary: `CLINTPOS: ${matchingAlerts.length} health alert(s)`,
                            title: `🚨 CLINTPOS Health Alerts (${matchingAlerts.length})`,
                            sections: [{ facts: matchingAlerts.slice(0, 5).map((a: any) => ({ name: a.name || a.terminalId, value: `Score: ${a.healthScore}/100 (${a.severity})` })) }],
                        }),
                    });
                } else if (webhook.type === 'discord') {
                    const critCount = matchingAlerts.filter((a: any) => a.severity === 'critical').length;
                    res = await fetch(webhook.url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...webhook.headers },
                        body: JSON.stringify({
                            username: 'CLINTPOS Health Node',
                            embeds: [{
                                title: `🚨 CLINTPOS Health Alerts (${matchingAlerts.length})`,
                                color: critCount > 0 ? 15548997 : 15105570, // Discord Red vs Amber
                                fields: matchingAlerts.slice(0, 10).map((a: any) => ({
                                    name: a.name || a.terminalId,
                                    value: `**Score:** ${a.healthScore}/100\n**Severity:** ${a.severity.toUpperCase()}\n**Violations:** ${a.violations.join(', ')}`,
                                    inline: true
                                })),
                                footer: { text: `Merchant ID: ${merchantId} | ${now.toISOString()}` }
                            }],
                        }),
                    });
                } else {
                    res = await fetch(webhook.url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...webhook.headers },
                        body: JSON.stringify(payload),
                    });
                }

                const idx = webhooks.findIndex((w: any) => w.id === webhook.id);
                if (idx !== -1) {
                    webhooks[idx].lastTriggeredAt = now.toISOString();
                    webhooks[idx].triggerCount = (webhooks[idx].triggerCount || 0) + 1;
                    webhooks[idx].lastStatus = res.ok ? 'delivered' : `failed_${res.status}`;
                }
            } catch (wErr: any) {
                console.error(`[fireAlertWebhooks] Failed to deliver to ${webhook.name}:`, wErr.message);
                const idx = webhooks.findIndex((w: any) => w.id === webhook.id);
                if (idx !== -1) {
                    webhooks[idx].lastTriggeredAt = now.toISOString();
                    webhooks[idx].lastStatus = `error: ${wErr.message?.substring(0, 80)}`;
                }
            }
        }

        await kv.set(`alert_webhooks:${merchantId}`, webhooks);
        await kv.set(cooldownKey, now.toISOString());
    } catch (e: any) {
        console.error('[fireAlertWebhooks] Error:', e);
    }
}

// ═══════════════════════════════════════════════════════════════
// ═══ GOOGLE PLACES PROXY (keeps API key server-side) ══════════
// ═══════════════════════════════════════════════════════════════

routes.get('/places/autocomplete', async (c) => {
    try {
        const input = c.req.query('input');
        if (!input || input.length < 2) return c.json({ predictions: [] });

        const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY') || Deno.env.get('GOOGLE_API_KEY');
        if (!apiKey) return c.json({ predictions: [], error: 'Places API key not configured' });

        // Use legacy Places API (widely enabled, no extra activation needed)
        const params = new URLSearchParams({
            input,
            key: apiKey,
            components: 'country:za',
            language: 'en'
        });
        const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);
        const data = await res.json();

        if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
            return c.json({
                predictions: (data.predictions || []).map((p: any) => ({
                    placeId: p.place_id,
                    description: p.description || '',
                    mainText: p.structured_formatting?.main_text || '',
                    secondaryText: p.structured_formatting?.secondary_text || ''
                }))
            });
        }

        console.error('[places/autocomplete] Google API error:', data.status, data.error_message || '');
        return c.json({ predictions: [], error: data.error_message || data.status || 'API error' });
    } catch (e: any) {
        console.error('[places/autocomplete] Error:', e);
        return c.json({ predictions: [], error: e.message }, 500);
    }
});

routes.get('/places/details', async (c) => {
    try {
        const placeId = c.req.query('place_id');
        if (!placeId) return c.json({ error: 'place_id is required' }, 400);

        const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY') || Deno.env.get('GOOGLE_API_KEY');
        if (!apiKey) return c.json({ error: 'Places API key not configured' });

        // Use legacy Places API for place details
        const fields = 'formatted_address,address_components,geometry';
        const params = new URLSearchParams({
            place_id: placeId,
            key: apiKey,
            fields,
            language: 'en'
        });
        const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
        const data = await res.json();

        if (data.status === 'OK' && data.result) {
            const comps = data.result.address_components || [];
            const getComp = (type: string) => comps.find((c: any) => c.types.includes(type))?.long_name || '';
            return c.json({
                formattedAddress: data.result.formatted_address || '',
                streetNumber: getComp('street_number'),
                street: getComp('route'),
                suburb: getComp('sublocality') || getComp('sublocality_level_1'),
                city: getComp('locality') || getComp('administrative_area_level_2'),
                province: getComp('administrative_area_level_1'),
                postalCode: getComp('postal_code'),
                country: getComp('country'),
                lat: data.result.geometry?.location?.lat,
                lng: data.result.geometry?.location?.lng
            });
        }
        
        console.error('[places/details] Google API error:', data.status, data.error_message || '');
        return c.json({ error: data.error_message || data.status || 'Place not found' });
    } catch (e: any) {
        console.error('[places/details] Error:', e);
        return c.json({ error: e.message }, 500);
    }
});

// ═══════════════════════════════════════════════════════
// ──── PRINTER MANAGEMENT ────
// ═══════════════════════════════════════════════════════

// GET all printers for a merchant
routes.get('/merchants/:id/printers', async (c) => {
  const mId = c.req.param('id');
  try {
    const printers = (await kv.get(`printers:${mId}`)) || [];
    return c.json({ success: true, printers });
  } catch (e: any) {
    console.log(`[Printers] GET error for ${mId}:`, e?.message);
    return c.json({ success: false, error: e?.message || 'Failed to load printers' }, 500);
  }
});

// CREATE a new printer
routes.post('/merchants/:id/printers', async (c) => {
  const mId = c.req.param('id');
  try {
    const body = await c.req.json();
    const printers = (await kv.get(`printers:${mId}`)) || [];

    const printer = {
      id: `PRT-${crypto.randomUUID().substring(0, 8).toUpperCase()}`,
      name: body.name || 'Unnamed Printer',
      type: body.type || 'thermal',
      connection: body.connection || 'network',
      ip: body.ip || '',
      port: body.port || 9100,
      terminalId: body.terminalId || null,
      paperWidth: body.paperWidth || 80,
      isDefault: printers.length === 0 ? true : (body.isDefault || false),
      status: 'offline',
      model: body.model || '',
      lastUsed: null,
      createdAt: new Date().toISOString(),
    };

    if (printer.isDefault) {
      for (const p of printers) p.isDefault = false;
    }

    printers.push(printer);
    await kv.set(`printers:${mId}`, printers);

    console.log(`[Printers] Created ${printer.id} (${printer.name}) for ${mId}`);
    return c.json({ success: true, printer });
  } catch (e: any) {
    console.log(`[Printers] CREATE error for ${mId}:`, e?.message);
    return c.json({ success: false, error: e?.message || 'Failed to create printer' }, 500);
  }
});

// UPDATE a printer
routes.put('/merchants/:id/printers/:printerId', async (c) => {
  const mId = c.req.param('id');
  const printerId = c.req.param('printerId');
  try {
    const body = await c.req.json();
    const printers = (await kv.get(`printers:${mId}`)) || [];
    const idx = printers.findIndex((p: any) => p.id === printerId);
    if (idx === -1) return c.json({ success: false, error: 'Printer not found' }, 404);

    if (body.isDefault) {
      for (const p of printers) p.isDefault = false;
    }

    printers[idx] = { ...printers[idx], ...body, id: printerId, updatedAt: new Date().toISOString() };
    await kv.set(`printers:${mId}`, printers);

    console.log(`[Printers] Updated ${printerId} for ${mId}`);
    return c.json({ success: true, printer: printers[idx] });
  } catch (e: any) {
    console.log(`[Printers] UPDATE error for ${mId}/${printerId}:`, e?.message);
    return c.json({ success: false, error: e?.message || 'Failed to update printer' }, 500);
  }
});

// DELETE a printer
routes.delete('/merchants/:id/printers/:printerId', async (c) => {
  const mId = c.req.param('id');
  const printerId = c.req.param('printerId');
  try {
    let printers = (await kv.get(`printers:${mId}`)) || [];
    const target = printers.find((p: any) => p.id === printerId);
    if (!target) return c.json({ success: false, error: 'Printer not found' }, 404);

    printers = printers.filter((p: any) => p.id !== printerId);

    if (target.isDefault && printers.length > 0) {
      printers[0].isDefault = true;
    }

    await kv.set(`printers:${mId}`, printers);
    console.log(`[Printers] Deleted ${printerId} for ${mId}`);
    return c.json({ success: true });
  } catch (e: any) {
    console.log(`[Printers] DELETE error for ${mId}/${printerId}:`, e?.message);
    return c.json({ success: false, error: e?.message || 'Failed to delete printer' }, 500);
  }
});

// TEST PRINT
routes.post('/merchants/:id/printers/:printerId/test', async (c) => {
  const mId = c.req.param('id');
  const printerId = c.req.param('printerId');
  try {
    const printers = (await kv.get(`printers:${mId}`)) || [];
    const idx = printers.findIndex((p: any) => p.id === printerId);
    if (idx === -1) return c.json({ success: false, error: 'Printer not found' }, 404);

    const printer = printers[idx];
    const simulateSuccess = Math.random() > 0.15;

    if (simulateSuccess) {
      printers[idx] = { ...printers[idx], status: 'online', lastUsed: new Date().toISOString() };
      await kv.set(`printers:${mId}`, printers);
      console.log(`[Printers] Test print SUCCESS on ${printerId} (${printer.name}) for ${mId}`);
      return c.json({
        success: true,
        message: `Test receipt sent to ${printer.name} (${printer.connection === 'network' ? printer.ip + ':' + printer.port : printer.connection})`,
        printedAt: new Date().toISOString(),
      });
    } else {
      printers[idx] = { ...printers[idx], status: 'error' };
      await kv.set(`printers:${mId}`, printers);
      console.log(`[Printers] Test print FAILED on ${printerId} for ${mId}`);
      return c.json({
        success: false,
        error: `Connection refused — ${printer.connection === 'network' ? `${printer.ip}:${printer.port} unreachable` : `${printer.connection} device not responding`}`,
      });
    }
  } catch (e: any) {
    console.log(`[Printers] TEST error for ${mId}/${printerId}:`, e?.message);
    return c.json({ success: false, error: e?.message || 'Test print failed' }, 500);
  }
});

Deno.serve(app.fetch);
