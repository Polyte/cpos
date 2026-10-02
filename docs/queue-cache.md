# Background jobs (RabbitMQ) + cache (Redis)

Long imports and big exports no longer block the UI. The flow is always the
same: **POST /jobs → poll GET /jobs/:id → download / toast on completion**.

## How it works

```
Client --POST /jobs--> Edge function --creates job record (Redis/KV)-->
        |                                  |
        |                          RabbitMQ configured?
        |                           /            \
                       publish to            EdgeRuntime.waitUntil
                       cpos.jobs             (inline background run)
                          |
                   queue-worker.mjs
                   (drives the existing import/export
                    HTTP endpoints, PATCHes progress)
```

- **RabbitMQ** is transport only: one durable queue (`cpos.jobs`), published
  via the Management HTTP API so the serverless edge function needs no TCP.
- If the broker is missing or unreachable, jobs transparently run **inline**
  in the edge function. Nothing breaks; you just lose cross-process durability.
- Job handlers are idempotent (import batches resume from `processedRows`),
  so a crashed/retried job never double-inserts.
- Run **exactly one** worker replica: it uses peek-then-consume over the
  management API, which is race-free for a single consumer. For horizontal
  workers, swap the transport for a real AMQP consumer (e.g. amqplib) — the
  job protocol (`PATCH /jobs/:id`) is unchanged.

## Job types

| type | params | result |
|---|---|---|
| `loyaltyhub-import` | `limit` (≤500), `maxBatches` (≤40), `cursor?` | `{ pushed, processedRows, sourceRows }` |
| `report-export` | `format` csv\|pdf, `dateFrom?`, `dateTo?`, `tenantFilter?` | `{ format, artifact, generatedAt }` (≤400KB) |

## Configuration (Supabase secrets / env)

| var | purpose | required |
|---|---|---|
| `REDIS_REST_URL`, `REDIS_REST_TOKEN` | Upstash-style Redis for the two-tier cache (dashboard, import status, jobs) | no — falls back to KV |
| `RABBITMQ_URL` | Management base, e.g. `http://localhost:15672` | no — falls back to inline |
| `RABBITMQ_USER`, `RABBITMQ_PASSWORD` | broker credentials (defaults `guest`) | with URL |
| `RABBITMQ_VHOST` (`/`), `RABBITMQ_QUEUE` (`cpos.jobs`) | routing | no |
| `WORKER_SECRET` | shared secret: worker auth + admin bypass for job-driven calls | for the worker |

```bash
supabase secrets set REDIS_REST_URL=https://… REDIS_REST_TOKEN=… \
  RABBITMQ_URL=https://mq.example.com:15671 RABBITMQ_USER=cpos \
  RABBITMQ_PASSWORD='…' WORKER_SECRET='long-random-value'
supabase functions deploy make-server-69ad2d15
```

## Local development

Two ways, both driven by `.env.worker`:

```bash
# 1. Everything at once: broker + edge function + worker
pnpm queue:dev

# 2. Or run the pieces yourself
pnpm queue:worker        # auto-starts the broker on first connect if it is down
```

`pnpm queue:worker` is self-healing for localhost brokers: if the management
API refuses the connection it runs `docker compose up -d rabbitmq` with the
management/AMQP ports derived from `RABBITMQ_URL` (so `http://localhost:15673`
starts the broker on `15673`), waits for readiness, then consumes. Set
`AUTO_START_BROKER=0` to disable, and remember `RABBITMQ_URL` is the
**management** port (15672), never the AMQP port (5672). If another broker
already owns 5672/15672 (common on a dev machine), use the alternates:

```bash
# .env.worker
RABBITMQ_URL=http://localhost:15673
RABBITMQ_USER=cpos
RABBITMQ_PASSWORD=cpos-dev-secret
```

> Run exactly one worker. Two workers on the same queue break the single-consumer
> peek/ack assumption.

Health: `GET /cache/stats` reports `{ cache: { hits, misses, redisHits, kvHits,
backend }, queue: { rabbitmq } }`.

## Notes

- The compose Redis is for self-hosted/TCP consumers. The edge function
  itself only speaks Redis-over-HTTP (Upstash REST), which is what works
  from serverless runtimes.
- Artifacts over 400KB fail fast with a hint to narrow the range — KV rows
  are not a blob store.
