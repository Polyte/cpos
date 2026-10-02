/**
 * Background job queue for ClintoPOS data import/export.
 *
 * Transport (best effort, with safe fallback):
 *  - If RabbitMQ management env is configured (RABBITMQ_URL + credentials),
 *    the job is published to a durable queue via the RabbitMQ Management HTTP
 *    API (no raw TCP needed, works from serverless edge runtimes) and picked
 *    up by `scripts/queue-worker.mjs`.
 *  - Otherwise (or when the broker is unreachable) the job runs inline in
 *    the edge function via `EdgeRuntime.waitUntil`, so imports/exports keep
 *    working with zero extra infrastructure.
 *
 * Clients always use the same flow: POST /jobs -> poll GET /jobs/:id.
 * Job records live in the two-tier cache (Redis when configured, else KV).
 */

import { cacheGet, cacheSet } from './cache.ts';

export type JobType = 'loyaltyhub-import' | 'report-export';
export type JobStatus = 'queued' | 'running' | 'complete' | 'failed';

export interface JobProgress {
  processed: number;
  total: number | null;
  message: string;
}

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  params: Record<string, unknown>;
  progress: JobProgress;
  result?: unknown;
  error?: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  backend: 'rabbitmq' | 'inline' | 'pending';
}

export type JobUpdate = (patch: Partial<Job>) => Promise<Job>;
export type JobHandler = (job: Job, update: JobUpdate) => Promise<unknown>;

const handlers = new Map<JobType, JobHandler>();

export function registerJobHandler(type: JobType, fn: JobHandler): void {
  handlers.set(type, fn);
}

const JOB_TTL_SECONDS = 24 * 3600;
const RECENT_KEY = 'jobs:recent';
const RECENT_LIMIT = 50;

function jobKey(id: string): string {
  return `jobs:${id}`;
}

async function saveJob(job: Job): Promise<Job> {
  const next = { ...job, updatedAt: new Date().toISOString() };
  await cacheSet(jobKey(job.id), next, JOB_TTL_SECONDS);
  return next;
}

export async function getJob(id: string): Promise<Job | null> {
  if (!id || typeof id !== 'string' || id.length > 64) return null;
  return await cacheGet<Job>(jobKey(id));
}

export async function listJobs(limit = 20): Promise<Job[]> {
  const ids = (await cacheGet<string[]>(RECENT_KEY)) || [];
  const out: Job[] = [];
  for (const id of ids.slice(0, Math.min(limit, RECENT_LIMIT))) {
    const job = await getJob(id);
    if (job) out.push(job);
  }
  return out;
}

async function pushRecent(id: string): Promise<void> {
  try {
    const ids = (await cacheGet<string[]>(RECENT_KEY)) || [];
    const next = [id, ...ids.filter((x) => x !== id)].slice(0, RECENT_LIMIT);
    await cacheSet(RECENT_KEY, next, JOB_TTL_SECONDS);
  } catch {
    /* non-fatal */
  }
}

/** Fields a worker/client may patch. `type`, `params` and history are immutable. */
const PATCHABLE = new Set(['status', 'progress', 'result', 'error']);

export async function patchJob(id: string, patch: Record<string, unknown>): Promise<Job | null> {
  const job = await getJob(id);
  if (!job) return null;
  const next: Job = { ...job };
  for (const [k, v] of Object.entries(patch || {})) {
    if (!PATCHABLE.has(k)) continue;
    (next as unknown as Record<string, unknown>)[k] = v;
  }
  if (patch.status === 'complete' || patch.status === 'failed') {
    next.status = patch.status as JobStatus;
  }
  return await saveJob(next);
}

// ── RabbitMQ transport (Management HTTP API) ────────────────────────────────

interface RabbitConfig {
  base: string;
  user: string;
  pass: string;
  vhost: string;
  queue: string;
}

function rabbitConfig(): RabbitConfig | null {
  let base = '';
  let user = 'guest';
  let pass = 'guest';
  let vhost = '/';
  let queue = 'cpos.jobs';
  try {
    base = Deno.env.get('RABBITMQ_URL') || '';
    user = Deno.env.get('RABBITMQ_USER') || user;
    pass = Deno.env.get('RABBITMQ_PASSWORD') || pass;
    vhost = Deno.env.get('RABBITMQ_VHOST') || vhost;
    queue = Deno.env.get('RABBITMQ_QUEUE') || queue;
  } catch {
    return null;
  }
  if (!base) return null;
  return { base: base.replace(/\/$/, ''), user, pass, vhost, queue };
}

export function rabbitConfigured(): boolean {
  return rabbitConfig() !== null;
}

async function rabbitFetch(cfg: RabbitConfig, path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(`${cfg.base}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Basic ${btoa(`${cfg.user}:${cfg.pass}`)}`,
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function publishToRabbit(job: Job): Promise<void> {
  const cfg = rabbitConfig();
  if (!cfg) throw new Error('RabbitMQ not configured');
  const vhost = encodeURIComponent(cfg.vhost);
  const queue = encodeURIComponent(cfg.queue);

  // Idempotent queue declaration (durable, survives broker restarts).
  const declareRes = await rabbitFetch(cfg, `/api/queues/${vhost}/${queue}`, {
    method: 'PUT',
    body: JSON.stringify({ durable: true, auto_delete: false }),
  });
  if (!declareRes.ok && declareRes.status !== 201 && declareRes.status !== 204) {
    throw new Error(`RabbitMQ queue declare failed (HTTP ${declareRes.status})`);
  }

  const pubRes = await rabbitFetch(cfg, `/api/exchanges/${vhost}/amq.default/publish`, {
    method: 'POST',
    body: JSON.stringify({
      routing_key: cfg.queue,
      payload: JSON.stringify({ jobId: job.id, type: job.type }),
      payload_encoding: 'string',
      properties: { delivery_mode: 2, content_type: 'application/json' },
    }),
  });
  if (!pubRes.ok) {
    const text = await pubRes.text().catch(() => '');
    throw new Error(`RabbitMQ publish failed (HTTP ${pubRes.status}) ${text.slice(0, 120)}`);
  }
  const body = await pubRes.json().catch(() => null);
  if (body && body.routed === false) {
    throw new Error('RabbitMQ accepted the message but routed it nowhere');
  }
}

// ── Dispatch ────────────────────────────────────────────────────────────────

async function runInline(job: Job): Promise<Job> {
  const handler = handlers.get(job.type);
  if (!handler) {
    return await saveJob({ ...job, status: 'failed', backend: 'inline', error: `No handler registered for ${job.type}` });
  }

  const update: JobUpdate = async (patch) => {
    const live = (await getJob(job.id)) || job;
    return await saveJob({ ...live, ...patch });
  };

  const run = async (): Promise<void> => {
    const live = await getJob(job.id);
    if (!live || live.status !== 'queued') return;
    await saveJob({ ...live, status: 'running', backend: 'inline' });
    try {
      const result = await handler(live, update);
      const done = (await getJob(job.id)) || live;
      await saveJob({
        ...done,
        status: 'complete',
        result,
        progress: { processed: done.progress?.processed ?? 0, total: done.progress?.total ?? null, message: 'Complete' },
      });
    } catch (e) {
      const failed = (await getJob(job.id)) || live;
      await saveJob({ ...failed, status: 'failed', error: (e as Error)?.message || 'Job failed' });
    }
  };

  const edgeRuntime = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (edgeRuntime && typeof edgeRuntime.waitUntil === 'function') {
    edgeRuntime.waitUntil(run().catch((e) => console.error('[Queue] inline job error:', e)));
    return await saveJob({ ...job, backend: 'inline' });
  }
  // No background primitive (local dev / tests): run awaited so the client
  // still observes terminal state on poll.
  await run();
  return (await getJob(job.id)) || job;
}

export async function dispatchJob(job: Job): Promise<Job> {
  if (rabbitConfigured()) {
    try {
      await publishToRabbit(job);
      console.log(`[Queue] Job ${job.id} (${job.type}) published to RabbitMQ`);
      return await saveJob({ ...job, backend: 'rabbitmq' });
    } catch (e) {
      console.log(`[Queue] RabbitMQ unavailable, falling back to inline:`, (e as Error)?.message || e);
    }
  }
  return await runInline(job);
}

export async function createJob(type: JobType, params: Record<string, unknown>, createdBy: string | null): Promise<Job> {
  if (!handlers.has(type)) throw new Error(`Unknown job type: ${type}`);
  const now = new Date().toISOString();
  const job: Job = {
    id: crypto.randomUUID(),
    type,
    status: 'queued',
    params: params && typeof params === 'object' ? params : {},
    progress: { processed: 0, total: null, message: 'Queued' },
    error: null,
    createdBy,
    createdAt: now,
    updatedAt: now,
    backend: 'pending',
  };
  await saveJob(job);
  await pushRecent(job.id);
  return await dispatchJob(job);
}
