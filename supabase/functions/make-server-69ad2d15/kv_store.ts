// Turso libSQL KV Store — replaces Supabase PostgREST
// Table: kv_store (key TEXT PRIMARY KEY, value TEXT)

import { createClient } from 'npm:@libsql/client/http';

const getClient = () => createClient({
  url: Deno.env.get('TURSO_DATABASE_URL') || '',
  authToken: Deno.env.get('TURSO_AUTH_TOKEN'),
});

function serialize(value: any): string {
  return JSON.stringify(value);
}

function deserialize(raw: string): any {
  try { return JSON.parse(raw); } catch { return raw; }
}

export const set = async (key: string, value: any): Promise<void> => {
  const client = getClient();
  await client.execute({
    sql: 'INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)',
    args: [key, serialize(value)],
  });
};

export const get = async (key: string): Promise<any> => {
  const client = getClient();
  const result = await client.execute({
    sql: 'SELECT value FROM kv_store WHERE key = ?',
    args: [key],
  });
  if (result.rows.length === 0) return null;
  return deserialize(result.rows[0].value as string);
};

export const del = async (key: string): Promise<void> => {
  const client = getClient();
  await client.execute({
    sql: 'DELETE FROM kv_store WHERE key = ?',
    args: [key],
  });
};

export const mset = async (keys: string[], values: any[]): Promise<void> => {
  const client = getClient();
  await client.batch(
    keys.map((k, i) => ({
      sql: 'INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)',
      args: [k, serialize(values[i])],
    })),
    'write'
  );
};

export const mget = async (keys: string[]): Promise<any[]> => {
  if (keys.length === 0) return [];
  const client = getClient();
  const placeholders = keys.map(() => '?').join(',');
  const result = await client.execute({
    sql: `SELECT key, value FROM kv_store WHERE key IN (${placeholders})`,
    args: keys,
  });
  const map = new Map(result.rows.map(r => [r.key as string, r.value as string]));
  return keys.map(k => {
    const v = map.get(k);
    return v !== undefined ? deserialize(v) : null;
  });
};

export const mdel = async (keys: string[]): Promise<void> => {
  if (keys.length === 0) return;
  const client = getClient();
  const placeholders = keys.map(() => '?').join(',');
  await client.execute({
    sql: `DELETE FROM kv_store WHERE key IN (${placeholders})`,
    args: keys,
  });
};

export const getByPrefix = async (prefix: string): Promise<any[]> => {
  const client = getClient();
  const result = await client.execute({
    sql: 'SELECT value FROM kv_store WHERE key LIKE ?',
    args: [prefix + '%'],
  });
  return result.rows.map(r => deserialize(r.value as string));
};
