#!/usr/bin/env node
/**
 * ClintoPOS queue worker — background import/export runner.
 *
 * Consumes jobs from RabbitMQ (via the Management HTTP API, zero dependencies)
 * and drives them through the edge-function HTTP API:
 *   - loyaltyhub-import: loops POST /product-cloud/import-loyaltyhub-catalog
 *     until the catalogue is drained, patching job progress as it goes.
 *   - report-export: POST /admin/export-report once, stores the artifact on
 *     the job record for the client to download.
 *
 * Run exactly ONE replica of this worker. It uses peek-then-consume over the
 * management API, which is race-free with a single consumer. For multi-worker
 * setups, replace the transport in `drainMessage` with a real AMQP consumer
 * (e.g. amqplib) — the job protocol (PATCH /jobs/:id) stays the same.
 *
 * Required env (or a `.env.worker` file in the repo root, see
 * `.env.worker.example`):
 *   WORKER_API_BASE   edge function base, e.g.
 *                     https://<project>.supabase.co/functions/v1/make-server-69ad2d15
 *   WORKER_SECRET     shared secret (must match the server's WORKER_SECRET;
 *                     doubles as the admin bearer for import/export calls)
 *   RABBITMQ_URL      management base, e.g. http://localhost:15672
 * Optional env (with defaults):
 *   RABBITMQ_USER/ RABBITMQ_PASSWORD / RABBITMQ_VHOST / RABBITMQ_QUEUE
 *   WORKER_POLL_MS (5000), WORKER_MAX_BATCHES (40)
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// Zero-dependency env loader (repo root): `.env` first, then `.env.worker` on
// top. Real environment variables always win over both files.
try {
  const root = repoRoot;
  for (const name of ['.env', '.env.worker']) {
    const file = join(root, name);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && !(key in process.env)) process.env[key] = value;
    }
  }
} catch { /* env loading is best-effort */ }

const API_BASE = (process.env.WORKER_API_BASE || '').replace(/\/$/, '');
const SECRET = process.env.WORKER_SECRET || '';
const RABBIT_BASE = (process.env.RABBITMQ_URL || '').replace(/\/$/, '');
const RABBIT_USER = process.env.RABBITMQ_USER || 'guest';
const RABBIT_PASS = process.env.RABBITMQ_PASSWORD || 'guest';
const RABBIT_VHOST = process.env.RABBITMQ_VHOST || '/';
const RABBIT_QUEUE = process.env.RABBITMQ_QUEUE || 'cpos.jobs';
const POLL_MS = Math.max(1000, Number(process.env.WORKER_POLL_MS) || 5000);
const DEFAULT_MAX_BATCHES = Math.min(Math.max(Number(process.env.WORKER_MAX_BATCHES) || 40, 1), 100);
const ARTIFACT_MAX_BYTES = 400 * 1024;

if (!API_BASE || !SECRET || !RABBIT_BASE) {
  console.error('Missing env: set WORKER_API_BASE, WORKER_SECRET and RABBITMQ_URL.');
  console.error('Copy .env.worker.example to .env.worker and fill it in, then run pnpm queue:worker again.');
  process.exit(1);
}

const VHOST = encodeURIComponent(RABBIT_VHOST);
const QUEUE = encodeURIComponent(RABBIT_QUEUE);
const rabbitAuth = `Basic ${Buffer.from(`${RABBIT_USER}:${RABBIT_PASS}`).toString('base64')}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let stopped = false;
process.on('SIGINT', () => { stopped = true; });
process.on('SIGTERM', () => { stopped = true; });

async function edge(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET}` },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(120000), // imports can legitimately run long
    });
  } catch (e) {
    const cause = e?.cause?.code || e?.cause?.message || e?.message || 'unknown';
    throw new Error(`Cannot reach the edge API at ${API_BASE}${path} (${cause}). Check WORKER_API_BASE and your network.`);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || json.details || `Edge API HTTP ${res.status} on ${path}`);
  if (json.error) throw new Error(json.error);
  return json;
}

/**
 * Wraps fetch so a dead broker produces an actionable message instead of the
 * bare "fetch failed" Node prints for a rejected connection.
 */
async function rabbit(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${RABBIT_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: rabbitAuth },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    const cause = e?.cause?.code || e?.cause?.message || e?.message || 'unknown';
    throw new Error(
      `Cannot reach RabbitMQ management API at ${RABBIT_BASE} (${cause}).\n` +
      `  - Broker not running? Start it: RABBITMQ_MGMT_PORT=15673 docker compose up -d\n` +
      `  - RABBITMQ_URL must be the MANAGEMENT port (15672), not the AMQP port (5672).\n` +
      `  - If you moved the port, set RABBITMQ_URL to match RABBITMQ_MGMT_PORT.`,
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `RabbitMQ rejected credentials for user '${RABBIT_USER}' (HTTP ${res.status}).\n` +
        `  - Set RABBITMQ_USER/RABBITMQ_PASSWORD to match RABBITMQ_DEFAULT_USER/_PASS.`,
      );
    }
    throw new Error(`RabbitMQ HTTP ${res.status} on ${path}: ${text.slice(0, 160)}`);
  }
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

/** Peek without removing (single consumer: no race). Returns parsed payload or null. */
async function peekMessage() {
  const msgs = await rabbit(`/api/queues/${VHOST}/${QUEUE}/get`, {
    method: 'POST',
    body: { count: 1, ackmode: 'ack_requeue_true', encoding: 'auto' },
  });
  if (!Array.isArray(msgs) || msgs.length === 0) return null;
  try {
    return JSON.parse(msgs[0].payload);
  } catch {
    return null;
  }
}

/** Remove the head message; returns its payload. Caller verifies it handled the same job. */
async function drainMessage() {
  const msgs = await rabbit(`/api/queues/${VHOST}/${QUEUE}/get`, {
    method: 'POST',
    body: { count: 1, ackmode: 'ack_requeue_false', encoding: 'auto' },
  });
  if (!Array.isArray(msgs) || msgs.length === 0) return null;
  try {
    return JSON.parse(msgs[0].payload);
  } catch {
    return null;
  }
}

async function patchJob(jobId, patch) {
  return edge(`/jobs/${encodeURIComponent(jobId)}`, { method: 'PATCH', body: patch });
}

async function runImport(job) {
  const params = job.params || {};
  const maxBatches = Math.min(Math.max(Number(params.maxBatches) || DEFAULT_MAX_BATCHES, 1), 100);
  const limit = Math.min(Math.max(Number(params.limit) || 500, 1), 500);
  let cursor = typeof params.cursor === 'string' ? params.cursor : '';

  const status = await edge('/product-cloud/import-status').catch(() => null);
  if (!cursor && status?.status === 'running' && typeof status?.nextCursor === 'string') {
    cursor = status.nextCursor;
  }

  let pushed = 0;
  let processed = Number(status?.processedRows || 0);
  for (let i = 0; i < maxBatches; i += 1) {
    if (stopped) throw new Error('Worker shutting down');
    const r = await edge('/product-cloud/import-loyaltyhub-catalog', {
      method: 'POST',
      body: { cursor, limit },
    });
    if (!r.success) throw new Error(r.error || 'Import batch failed');
    pushed += Number(r.imported || 0);
    processed = Number(r.processedRows ?? processed);
    await patchJob(job.id, {
      progress: {
        processed,
        total: Number(r.totalRows || status?.sourceRows || 0) || null,
        message: `Batch ${i + 1}: ${pushed.toLocaleString()} products pushed`,
      },
    });
    if (!r.hasMore || !r.nextCursor) break;
    cursor = String(r.nextCursor);
  }
  return { pushed, processedRows: processed };
}

async function runExport(job) {
  const params = job.params || {};
  const format = String(params.format || 'csv');
  if (format !== 'csv' && format !== 'pdf') throw new Error(`Unsupported format: ${format}`);
  await patchJob(job.id, { progress: { processed: 0, total: null, message: 'Building report…' } });
  const r = await edge('/admin/export-report', {
    method: 'POST',
    body: {
      format,
      dateFrom: params.dateFrom || undefined,
      dateTo: params.dateTo || undefined,
      tenantFilter: params.tenantFilter || 'all',
    },
  });
  if (!r.success) throw new Error(r.error || 'Export failed');
  const artifact = format === 'csv' ? r.csv : r.reportData;
  if (JSON.stringify(artifact ?? null).length > ARTIFACT_MAX_BYTES) {
    throw new Error('Report artifact exceeds 400KB — narrow the date range or filter to one tenant.');
  }
  return { format, artifact, generatedAt: r.reportData?.generatedAt || new Date().toISOString() };
}

/** Connectivity-style errors are worth retrying; data errors are not. */
function isTransient(message) {
  return /Cannot reach|fetch failed|HTTP 5\d\d|timed out|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|socket hang up/i.test(message);
}

async function handlePayload(payload, depth = 0) {
  if (!payload || typeof payload.jobId !== 'string') return;
  if (depth > 3) {
    console.error(`[worker] refusing deep redelivery chain for ${payload.jobId}`);
    return;
  }
  const { job } = await edge(`/jobs/${encodeURIComponent(payload.jobId)}`).catch(() => ({}));
  if (!job) {
    console.error(`[worker] job ${payload.jobId} not found; draining`);
    await drainMessage().catch(() => null);
    return;
  }
  if (job.status === 'complete' || job.status === 'failed') {
    await drainMessage().catch(() => null);
    return;
  }
  console.log(`[worker] processing ${job.id} (${job.type})`);
  await patchJob(job.id, { status: 'running', progress: { processed: 0, total: null, message: 'Worker picked up job' } }).catch(() => null);
  try {
    const result = job.type === 'loyaltyhub-import'
      ? await runImport(job)
      : job.type === 'report-export'
        ? await runExport(job)
        : (() => { throw new Error(`Unknown job type: ${job.type}`); })();
    const doneProgress = job.type === 'loyaltyhub-import' && result && typeof result.processedRows === 'number'
      ? { processed: result.processedRows, total: null, message: `Complete: ${Number(result.pushed || 0).toLocaleString()} products pushed` }
      : { processed: 1, total: 1, message: 'Complete: artifact ready to download' };
    await patchJob(job.id, { status: 'complete', result, progress: doneProgress });
    console.log(`[worker] completed ${job.id}`);
  } catch (e) {
    const message = e?.message || 'Worker failed';
    if (isTransient(message)) {
      // Connectivity blip, not a job bug: leave the message on the queue and
      // let the broker redeliver instead of recording a false failure.
      console.error(`[worker] transient error on ${job.id}, leaving message queued: ${message}`);
      await sleep(5000);
      return;
    }
    // Real failure: record it and drain. Handlers are idempotent, so a
    // redelivery would only repeat the same error.
    await patchJob(job.id, { status: 'failed', error: message }).catch(() => null);
    console.error(`[worker] failed ${job.id}:`, message);
  }
  const drained = await drainMessage().catch(() => null);
  if (drained && drained.jobId && drained.jobId !== payload.jobId) {
    await handlePayload(drained, depth + 1); // single-worker race guard
  }
}

function isLocalBroker() {
  try {
    const host = new URL(RABBIT_BASE).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

function brokerPort() {
  try {
    const u = new URL(RABBIT_BASE);
    if (u.port) return u.port;
    return u.protocol === 'https:' ? '443' : '80';
  } catch {
    return '15672';
  }
}

/**
 * Local convenience: bring the compose broker up on the ports this worker
 * expects, so `pnpm queue:worker` works without memorising port overrides.
 * Only runs for localhost brokers and only when AUTO_START_BROKER != 0.
 */
function startLocalBroker() {
  if (process.env.AUTO_START_BROKER === '0' || !isLocalBroker()) return false;
  if (!existsSync(join(repoRoot, 'docker-compose.yml'))) return false;

  const mgmtPort = brokerPort();
  const amqpPort = process.env.RABBITMQ_AMQP_PORT || (mgmtPort === '15672' ? '5672' : '5673');
  console.log(`[worker] broker unreachable — starting it with docker compose (mgmt ${mgmtPort}, amqp ${amqpPort})…`);
  const res = spawnSync('docker', ['compose', 'up', '-d', 'rabbitmq'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      RABBITMQ_MGMT_PORT: mgmtPort,
      RABBITMQ_AMQP_PORT: amqpPort,
      RABBITMQ_USER: RABBIT_USER,
      RABBITMQ_PASSWORD: RABBIT_PASS,
    },
  });
  if (res.status !== 0) {
    console.error('[worker] could not start the broker (is docker running?). Run `pnpm queue:dev` instead.');
    return false;
  }
  return true;
}

/** Declare the durable queue. Returns false (with a reason) when unavailable. */
async function ensureQueue() {
  try {
    await rabbit(`/api/queues/${VHOST}/${QUEUE}`, {
      method: 'PUT',
      body: { durable: true, auto_delete: false },
    });
    return true;
  } catch (e) {
    console.error(`[worker] ${e?.message || e}`);
    return false;
  }
}

async function main() {
  // Missing broker is not fatal: the edge function falls back to running jobs
  // inline, so the worker keeps retrying instead of crashing the process.
  let ready = await ensureQueue();
  if (!ready) {
    const started = startLocalBroker();
    if (started) {
      // Broker containers take ~10-20s to accept connections; poll until ready.
      const deadline = Date.now() + 90000;
      while (!stopped && Date.now() < deadline && !ready) {
        await sleep(3000);
        ready = await ensureQueue();
      }
    }
    while (!stopped && !ready) {
      console.error('[worker] retrying in 15s — jobs still run inline meanwhile.');
      await sleep(15000);
      ready = await ensureQueue();
    }
  }
  if (!ready) return;

  console.log(`[worker] consuming '${RABBIT_QUEUE}' -> ${API_BASE}`);
  let connected = true;
  let backoff = POLL_MS;
  while (!stopped) {
    try {
      const payload = await peekMessage();
      if (payload) {
        connected = true;
        backoff = POLL_MS;
        await handlePayload(payload);
      } else {
        await sleep(POLL_MS);
      }
    } catch (e) {
      console.error('[worker] loop error:', e?.message || e);
      // Broker went away (restart, network blip): re-declare with backoff.
      // A job-level error never reaches here — handlePayload catches its own.
      connected = false;
      await sleep(backoff);
      backoff = Math.min(backoff * 2, 60000);
      connected = await ensureQueue();
      if (connected) backoff = POLL_MS;
    }
  }
  console.log('[worker] stopped');
}

main().catch((e) => {
  console.error('[worker] fatal:', e?.message || e);
  process.exit(1);
});
