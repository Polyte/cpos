#!/usr/bin/env node
/**
 * One-command local background stack: RabbitMQ broker + edge function + worker.
 *
 * Starts the broker via docker compose (auto-picking free host ports if 5672 /
 * 15672 are taken), runs the edge function with `deno run`, then runs the queue
 * worker against it. Ctrl-C tears everything down.
 *
 * Requires: docker, deno, node 20+. Configure through `.env.worker` (see
 * `.env.worker.example`) — this script derives broker credentials from the
 * compose file so they cannot drift.
 */

import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'node:net';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env };

// Load .env (app/database config) first, then .env.worker on top so
// worker-specific values win. Both files are needed: the edge function needs
// TURSO_*/JWT_SECRET, the worker needs the queue config.
try {
  for (const name of ['.env', '.env.worker']) {
    const file = join(root, name);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (k) env[k] = v;
    }
  }
} catch { /* best effort */ }

if (!env.WORKER_SECRET) {
  env.WORKER_SECRET = 'local-dev-secret';
  console.log('[dev] WORKER_SECRET not set — using local-dev-secret for this stack.');
}

const children = [];
function run(label, cmd, cmdArgs, extraEnv = {}, onLine) {
  const child = spawn(cmd, cmdArgs, { cwd: root, env: { ...env, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] });
  const prefix = (buf) => String(buf).split('\n').filter(Boolean).map((l) => `[${label}] ${l}`).join('\n');
  child.stdout.on('data', (b) => { const out = prefix(b); console.log(out); onLine?.(out); });
  child.stderr.on('data', (b) => console.log(prefix(b)));
  child.on('exit', (code) => console.log(`[dev] ${label} exited (${code ?? 'signal'})`));
  children.push(child);
  return child;
}

function portFree(port) {
  return new Promise((resolve) => {
    const srv = createConnection({ port, host: '127.0.0.1' })
      .on('connect', () => { srv.destroy(); resolve(false); })
      .on('error', () => resolve(true));
  });
}

const composeUser = process.env.RABBITMQ_USER || env.RABBITMQ_USER || 'cpos';
const composePass = process.env.RABBITMQ_PASSWORD || env.RABBITMQ_PASSWORD || 'cpos-dev-secret';

async function main() {
  // 1. Broker on free ports (5672/15672 are commonly already taken).
  const amqpPort = process.env.RABBITMQ_AMQP_PORT || (await portFree(5672) ? '5672' : '5673');
  let mgmtPort = process.env.RABBITMQ_MGMT_PORT || (await portFree(15672) ? '15672' : '15673');
  const composeEnv = { ...process.env, RABBITMQ_USER: composeUser, RABBITMQ_PASSWORD: composePass, RABBITMQ_AMQP_PORT: amqpPort, RABBITMQ_MGMT_PORT: mgmtPort };
  console.log(`[dev] starting RabbitMQ (amqp ${amqpPort}, mgmt ${mgmtPort})`);
  const up = spawnSync('docker', ['compose', 'up', '-d', 'rabbitmq'], { cwd: root, env: composeEnv, stdio: 'inherit' });
  if (up.status !== 0) {
    console.error('[dev] docker compose failed. Is docker running?');
    process.exit(1);
  }

  const rabbitUrl = `http://localhost:${mgmtPort}`;
  const base = env.WORKER_API_BASE || 'http://localhost:8000/make-server-69ad2d15';

  // 2. Edge function with matching broker + secret.
  console.log('[dev] starting edge function on :8000');
  run('edge', 'deno', ['run', '--allow-all', 'supabase/functions/make-server-69ad2d15/index.ts'], {
    WORKER_SECRET: env.WORKER_SECRET,
    RABBITMQ_URL: rabbitUrl,
    RABBITMQ_USER: composeUser,
    RABBITMQ_PASSWORD: composePass,
  });

  // 3. Wait for the edge function, then hand over to the worker.
  const deadline = Date.now() + 60000;
  let up_ok = false;
  while (Date.now() < deadline && !up_ok) {
    try {
      const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
      up_ok = res.ok;
    } catch { await new Promise((r) => setTimeout(r, 1500)); }
  }
  if (!up_ok) console.log('[dev] edge function did not answer /health in 60s — starting worker anyway.');

  console.log(`[dev] starting worker (broker ${rabbitUrl})`);
  run('worker', 'node', ['scripts/queue-worker.mjs'], {
    WORKER_API_BASE: base,
    RABBITMQ_URL: rabbitUrl,
    RABBITMQ_USER: composeUser,
    RABBITMQ_PASSWORD: composePass,
  });
  console.log('[dev] stack up. Ctrl-C to stop.');
}

function shutdown() {
  for (const c of children) { try { c.kill('SIGTERM'); } catch { /* ignore */ } }
  spawnSync('docker', ['compose', 'stop', 'rabbitmq'], { cwd: root, stdio: 'ignore' });
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((e) => { console.error('[dev]', e?.message || e); shutdown(); });