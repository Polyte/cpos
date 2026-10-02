// Turso libSQL KV Store — replaces Supabase PostgREST
// Table: kv_store (key TEXT PRIMARY KEY, value TEXT)
//
// Every call is wrapped in a timeout: the libSQL HTTP client has no request
// timeout of its own, so a stalled socket used to hang the request handler
// forever (the edge function would stop answering any route). Timeouts free
// the caller; the underlying socket is dropped by the runtime on error.

import { createClient } from 'npm:@libsql/client/http';

// A fresh client per call: the HTTP transport pools connections internally,
// and a pooled socket that goes stale makes subsequent queries hang. Creating
// one per call is cheap over HTTP (stateless) and avoids that failure mode.
const getClient = () => createClient({
  url: Deno.env.get('TURSO_DATABASE_URL') || '',
  authToken: Deno.env.get('TURSO_AUTH_TOKEN'),
});

const POINT_TIMEOUT_MS = 6000;
const BATCH_TIMEOUT_MS = 12000;
const SCAN_TIMEOUT_MS = 25000;

/**
 * First key segment including the colon, e.g. `tx:merchant:M1:x` -> `tx:`.
 * This is what the indexed `prefix` column stores. Keys with no colon get NULL
 * (nothing reads those by prefix, since a `X:%` LIKE requires a colon).
 */
function prefixOf(key: string): string | null {
  const i = key.indexOf(':');
  return i === -1 ? null : key.slice(0, i + 1);
}

// Set to false when the database predates the `prefix` column/index migration
// so reads fall back to a plain LIKE scan instead of failing.
let prefixColumnAvailable = true;

class KvTimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms (Turso unreachable or overloaded)`);
    this.name = 'KvTimeoutError';
  }
}

async function withTimeout<T>(label: string, ms: number, run: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new KvTimeoutError(label, ms)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** One extra attempt for transient network/timeout failures on point reads. */
async function withRetry<T>(label: string, ms: number, run: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await withTimeout(label, ms, run);
    } catch (e) {
      lastError = e;
      const transient = e instanceof KvTimeoutError || /fetch failed|ECONNRESET|ETIMEDOUT|network/i.test(String((e as Error)?.message || e));
      if (!transient || attempt === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
    }
  }
  throw lastError;
}

function serialize(value: any): string {
  return JSON.stringify(value);
}

function deserialize(raw: string): any {
  try { return JSON.parse(raw); } catch { return raw; }
}

export const set = async (key: string, value: any): Promise<void> => {
  await withRetry('kv.set', POINT_TIMEOUT_MS, () =>
    getClient().execute({
      sql: 'INSERT OR REPLACE INTO kv_store (key, value, prefix) VALUES (?, ?, ?)',
      args: [key, serialize(value), prefixOf(key)],
    }));
};

export const get = async (key: string): Promise<any> => {
  const result = await withRetry('kv.get', POINT_TIMEOUT_MS, () =>
    getClient().execute({
      sql: 'SELECT value FROM kv_store WHERE key = ?',
      args: [key],
    }));
  if (result.rows.length === 0) return null;
  return deserialize(result.rows[0].value as string);
};

export const del = async (key: string): Promise<void> => {
  await withRetry('kv.del', POINT_TIMEOUT_MS, () =>
    getClient().execute({
      sql: 'DELETE FROM kv_store WHERE key = ?',
      args: [key],
    }));
};

export const mset = async (keys: string[], values: any[]): Promise<void> => {
  if (keys.length === 0) return;
  await withTimeout('kv.mset', BATCH_TIMEOUT_MS, () =>
    getClient().batch(
      keys.map((k, i) => ({
        sql: 'INSERT OR REPLACE INTO kv_store (key, value, prefix) VALUES (?, ?, ?)',
        args: [k, serialize(values[i]), prefixOf(k)],
      })),
      'write'
    ));
};

export const mget = async (keys: string[]): Promise<any[]> => {
  if (keys.length === 0) return [];
  const placeholders = keys.map(() => '?').join(',');
  const result = await withTimeout('kv.mget', BATCH_TIMEOUT_MS, () =>
    getClient().execute({
      sql: `SELECT key, value FROM kv_store WHERE key IN (${placeholders})`,
      args: keys,
    }));
  const map = new Map(result.rows.map(r => [r.key as string, r.value as string]));
  return keys.map(k => {
    const v = map.get(k);
    return v !== undefined ? deserialize(v) : null;
  });
};

export const mdel = async (keys: string[]): Promise<void> => {
  if (keys.length === 0) return;
  const placeholders = keys.map(() => '?').join(',');
  await withTimeout('kv.mdel', BATCH_TIMEOUT_MS, () =>
    getClient().execute({
      sql: `DELETE FROM kv_store WHERE key IN (${placeholders})`,
      args: keys,
    }));
};

export const getByPrefix = async (prefix: string): Promise<any[]> => {
  const like = prefix + '%';

  if (prefixColumnAvailable) {
    // Indexed path: `prefix` is the first key segment (tx:, stock:, ...), so
    // the index narrows the scan before the LIKE runs. This turned a 2.5s
    // full-table scan into ~2ms.
    try {
      const segment = prefixOf(prefix) ?? prefix;
      const result = await withRetry(`kv.getByPrefix(${prefix})`, SCAN_TIMEOUT_MS, () =>
        getClient().execute({
          sql: 'SELECT value FROM kv_store WHERE prefix = ? AND key LIKE ?',
          args: [segment, like],
        }), 2);
      return result.rows.map(r => deserialize(r.value as string));
    } catch (e) {
      const message = String((e as Error)?.message || e);
      // Older database without the column/index migration: degrade gracefully.
      if (/no such column/i.test(message)) {
        console.log('[kv] prefix column missing, falling back to LIKE scan');
        prefixColumnAvailable = false;
      } else {
        throw e;
      }
    }
  }

  const result = await withRetry(`kv.getByPrefix(${prefix})`, SCAN_TIMEOUT_MS, () =>
    getClient().execute({
      sql: 'SELECT value FROM kv_store WHERE key LIKE ?',
      args: [like],
    }), 2);
  return result.rows.map(r => deserialize(r.value as string));
};