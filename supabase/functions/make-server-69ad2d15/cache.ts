/**
 * Two-tier cache for the ClintoPOS edge function.
 *
 * Tier 1: Redis via Upstash-style REST (REDIS_REST_URL + REDIS_REST_TOKEN).
 *         HTTP-only, so it works from serverless edge runtimes.
 * Tier 2: The existing KV store (Turso-backed), always available.
 *
 * Envelope format { data, expiresAt } intentionally matches the legacy
 * `cache:` entries, so pre-existing KV rows stay readable. A ttl of 0 (or
 * negative) means "persist, never expire".
 */

import * as kv from './kv_store.ts';

interface Envelope {
  data: unknown;
  expiresAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  redisHits: number;
  kvHits: number;
}

const stats: CacheStats = { hits: 0, misses: 0, redisHits: 0, kvHits: 0 };

const KEY_PREFIX = 'cache:';
const REDIS_TIMEOUT_MS = 3000;

function redisConfig(): { url: string; token: string } | null {
  let url = '';
  let token = '';
  try {
    url = Deno.env.get('REDIS_REST_URL') || '';
    token = Deno.env.get('REDIS_REST_TOKEN') || '';
  } catch {
    return null;
  }
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

export function redisConfigured(): boolean {
  return redisConfig() !== null;
}

export function cacheBackend(): 'redis+kv' | 'kv' {
  return redisConfigured() ? 'redis+kv' : 'kv';
}

async function redisFetch(path: string, init?: RequestInit): Promise<Response> {
  const cfg = redisConfig();
  if (!cfg) throw new Error('Redis not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REDIS_TIMEOUT_MS);
  try {
    return await fetch(`${cfg.url}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function namespaced(key: string): string {
  return `${KEY_PREFIX}${key}`;
}

function envelopeValid(env: Envelope | null | undefined): boolean {
  if (!env || typeof env !== 'object') return false;
  if (typeof env.expiresAt !== 'number') return false;
  if (env.expiresAt > 0 && env.expiresAt <= Date.now()) return false;
  return true;
}

export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  const nkey = namespaced(key);

  // Tier 1: Redis
  if (redisConfigured()) {
    try {
      const res = await redisFetch(`/get/${encodeURIComponent(nkey)}`);
      if (res.ok) {
        const body = await res.json().catch(() => null);
        const raw = body?.result;
        if (typeof raw === 'string' && raw.length > 0) {
          const env = JSON.parse(raw) as Envelope;
          if (envelopeValid(env)) {
            stats.hits += 1;
            stats.redisHits += 1;
            return env.data as T;
          }
        }
      }
    } catch (e) {
      console.log(`[Cache] Redis GET failed for ${key}, falling back to KV:`, (e as Error)?.message || e);
    }
  }

  // Tier 2: KV
  try {
    const env = (await kv.get(nkey)) as Envelope | null;
    if (envelopeValid(env)) {
      stats.hits += 1;
      stats.kvHits += 1;
      return (env as Envelope).data as T;
    }
  } catch {
    /* ignore */
  }
  stats.misses += 1;
  return null;
}

export async function cacheSet(key: string, data: unknown, ttlSeconds = 30): Promise<void> {
  const nkey = namespaced(key);
  const ttl = Math.max(0, Math.floor(Number(ttlSeconds) || 0));
  const env: Envelope = { data, expiresAt: ttl > 0 ? Date.now() + ttl * 1000 : 0 };
  const raw = JSON.stringify(env);

  // Dual-write: Redis first (best effort), KV always (durable fallback).
  if (redisConfigured()) {
    try {
      const args: (string | number)[] = ttl > 0 ? ['SET', nkey, raw, 'EX', ttl] : ['SET', nkey, raw];
      await redisFetch('/', { method: 'POST', body: JSON.stringify(args) });
    } catch (e) {
      console.log(`[Cache] Redis SET failed for ${key}:`, (e as Error)?.message || e);
    }
  }
  try {
    await kv.set(nkey, env);
  } catch (e) {
    console.error(`[Cache] KV SET ERROR for ${key}:`, e);
  }
}

export async function cacheDel(key: string): Promise<void> {
  const nkey = namespaced(key);
  if (redisConfigured()) {
    try {
      await redisFetch('/', { method: 'POST', body: JSON.stringify(['DEL', nkey]) });
    } catch {
      /* ignore */
    }
  }
  try {
    await kv.del(nkey);
  } catch {
    /* ignore */
  }
}

export function getCacheStats(): CacheStats & { backend: string; redisConfigured: boolean } {
  return { ...stats, backend: cacheBackend(), redisConfigured: redisConfigured() };
}
