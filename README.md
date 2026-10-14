# Express · Knex · Redis API

A production-quality REST API built with **Node.js 20**, **Express.js**, **Knex.js**, **PostgreSQL**, and **Redis**, fully Dockerised and tested with **Jest + Supertest**.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Setup – Local Development](#setup--local-development)
3. [Running with Docker](#running-with-docker)
4. [Running Tests](#running-tests)
5. [API Reference & curl Examples](#api-reference--curl-examples)
6. [Caching Design](#caching-design)
7. [Design Decisions & Trade-offs](#design-decisions--trade-offs)
8. [Future Improvements](#future-improvements)

---

## Project Structure

```
.
├── Dockerfile                # base → ci (lint) → production (runtime deps only)
├── docker-compose.yml
├── knexfile.js               # DB config for app + Knex CLI (dev / test / production)
├── jest.config.js
├── eslint.config.js          # ESLint 9 flat config
├── .env.example
├── .dockerignore
├── .prettierrc
├── src/
│   ├── app.js                # Express app (exported for tests)
│   ├── server.js             # HTTP server + graceful shutdown
│   ├── config/
│   │   ├── env.js            # App-level env vars (port, Redis, cache)
│   │   ├── database.js       # Knex singleton
│   │   └── redis.js          # ioredis client (fail-fast, swappable in tests)
│   ├── db/
│   │   ├── migrations/       # products, tickets
│   │   └── seeds/            # 12 sample products (idempotent)
│   ├── routes/               # index, productRoutes, ticketRoutes, healthRoutes
│   ├── controllers/          # product, ticket, health
│   ├── services/             # productService (cache + single-flight), ticketService, healthService
│   ├── middlewares/          # validate (Joi), errorHandler, notFound
│   └── validators/
│       └── ticketValidator.js
└── tests/
    ├── globalSetup.js        # migrate test DB once
    ├── globalTeardown.js     # roll back test DB once
    ├── setup.js              # mock Redis + close connections per file
    ├── helpers/              # dbHelper, redisHelper
    ├── products.test.js
    ├── tickets.test.js
    └── health.test.js
```

---

## Setup – Local Development

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 |
| PostgreSQL | ≥ 14 |
| Redis | ≥ 6 (optional – the API works without it, uncached) |

### Steps

```bash
npm install
cp .env.example .env          # adjust credentials

createdb appdb
createdb appdb_test           # used by the test suite

npm run db:setup              # migrate + seed (seed is idempotent)
npm run dev                   # http://localhost:3000
```

---

## Running with Docker

```bash
docker-compose up --build
```

`.env` is optional for Docker: every variable the app needs has a default in `docker-compose.yml`.

On startup:
1. PostgreSQL and Redis start and pass their health checks.
2. The app runs `knex migrate:latest` then `knex seed:run` (safe to repeat on every start).
3. Express listens on port **3000**. The image's `HEALTHCHECK` polls `GET /health`.

PostgreSQL and Redis are **not published to the host**. Only the app can reach them, over the internal network. To inspect them:

```bash
docker compose exec postgres psql -U postgres -d appdb
docker compose exec redis redis-cli
```

If you need host access temporarily, add a `docker-compose.override.yml` (don't commit it):

```yaml
services:
  postgres:
    ports: ['5432:5432']
```

Lint inside Docker (CI-style): `docker build --target ci .`

```bash
docker-compose down       # stop, keep volumes
docker-compose down -v    # stop and delete volumes
```

---

## Running Tests

Tests run against a real PostgreSQL **test database** (`appdb_test`, configured through `TEST_DB_*` in `.env`). Redis is replaced by an in-memory mock, so it doesn't need to be running.

```bash
npm test                  # all suites
npm run test:coverage     # with coverage (./coverage)
npm run lint
```

Jest exits on its own: each test file closes its Knex pool and Redis client in `afterAll`, so `--forceExit` isn't needed.

---

## API Reference & curl Examples

### `GET /health`: DB + Redis status

```bash
curl http://localhost:3000/health
```

```json
{ "status": "ok", "checks": { "database": "up", "redis": "up" }, "timestamp": "..." }
```

| `status` | HTTP | Meaning |
|----------|------|---------|
| `ok` | 200 | DB and Redis up |
| `degraded` | 200 | DB up, Redis down (API fully works, uncached) |
| `down` | 503 | DB unreachable |

---

### `GET /api/products`: list all products

```bash
curl -i http://localhost:3000/api/products   # X-Cache: MISS
curl -i http://localhost:3000/api/products   # X-Cache: HIT (within 120 s)
```

```json
[
  { "product_code": "PROD-001", "product_title": "Wireless Bluetooth Headphones", "product_price": 79.99 }
]
```

`product_price` is a JSON **number**.

---

### `POST /api/tickets`: submit a ticket

| Field | Type | Rules |
|-------|------|-------|
| `ticket_number` | integer (JSON number) | required, 1 – 2147483647, unique |
| `subject` | string | required, trimmed, not blank, ≤ 255 chars |
| `description` | string | required, trimmed, not blank |

Unknown fields are ignored. Bodies over **10 kb** are rejected with `413`.

```bash
# 201 Created
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"ticket_number": 1001, "subject": "Cannot login", "description": "Getting 500 error on the login page."}'

# 400 Bad Request (missing description)
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"ticket_number": 1002, "subject": "No description"}'

# 409 Conflict (duplicate ticket_number)
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"ticket_number": 1001, "subject": "Duplicate", "description": "This number already exists."}'
```

**201**
```json
{
  "id": 1,
  "ticket_number": 1001,
  "subject": "Cannot login",
  "description": "Getting 500 error on the login page.",
  "created_at": "2026-01-01T12:00:00.000Z",
  "updated_at": "2026-01-01T12:00:00.000Z"
}
```

**400**
```json
{
  "error": {
    "message": "Validation failed",
    "details": [{ "field": "description", "message": "\"description\" is required" }]
  }
}
```

**409**
```json
{
  "error": {
    "message": "Ticket number 1001 already exists",
    "details": [{ "field": "ticket_number", "message": "Ticket number 1001 already exists" }]
  }
}
```

All errors use the same `{ "error": { "message", "details" } }` shape. 5xx responses always say `"Internal Server Error"`; the real error goes to the server log.

---

## Caching Design

```
GET /api/products
   │
   ├─ Redis GET products:list ──► hit ──► 200 (X-Cache: HIT)
   │        (miss / error / >500 ms timeout)
   ▼
 single-flight: is a DB load already running in this process?
   ├─ yes ──► await the same promise
   └─ no  ──► SELECT … FROM products ──► Redis SET products:list EX 120
   ▼
 200 (X-Cache: MISS)
```

| Property | Detail |
|----------|--------|
| Key / TTL | `products:list`, 120 s (`CACHE_TTL_SECONDS`) |
| Strategy | Look-aside (cache-aside), time-based expiry |
| Fail-fast | `enableOfflineQueue: false` + `commandTimeout` (500 ms, `REDIS_COMMAND_TIMEOUT_MS`): requests never hang on a dead Redis |
| Fallback | Any Redis error is logged and the request is served from PostgreSQL |
| Recovery | ioredis keeps reconnecting with capped back-off; caching resumes automatically |
| Stampede | Single-flight: N concurrent misses → 1 DB query (per process) |

---

## Design Decisions & Trade-offs

- **Layers:** routes → controllers (HTTP) → services (business logic, no HTTP knowledge).
- **Uniqueness lives in the DB.** `ticketService` doesn't pre-SELECT. A check-then-insert costs an extra round-trip and still loses the race between two concurrent requests. The UNIQUE constraint is atomic, and Postgres error `23505` maps to `409`. A test fires two concurrent duplicate POSTs and asserts one `201` and one `409`.
- **Strict validation:** `ticket_number` must be a real JSON integer in Postgres `INTEGER` range, so `"123"` is rejected and an out-of-range value can't surface as a DB error/500. Strings are trimmed and whitespace-only values are rejected. Unknown fields are stripped, and the service inserts an explicit column list, which guards against mass assignment.
- **`product_price` as Number:** pg returns `DECIMAL` as a string to avoid precision loss. `decimal(10,2)` fits safely in a JS double, so the service converts it. Cached values are normalised on read too, so older cache entries are safe.
- **Single-flight is per process.** Running N app replicas means at most N queries per expiry. A Redis lock (`SET NX PX`) would make it global, but it adds latency and failure modes that this endpoint doesn't need.
- **Idempotent seed:** `onConflict('product_code').ignore()` makes the seed safe to run on every container start. The trade-off is that changes to existing seed rows aren't applied. Use `.merge()` if you want that.
- **Docker:** the final stage runs `npm ci --omit=dev` and copies only `src/` + `knexfile.js`. It runs as the unprivileged `node` user, with `dumb-init` as PID 1. The DB and Redis aren't exposed to the host.
- **Tests:** a real Postgres is used, because unique-violation and decimal behaviour can't be mocked faithfully. Redis is mocked in memory. Connections are closed properly, so Jest exits cleanly.

---

## Future Improvements

- **Pagination & filtering:** `GET /api/products?limit=&cursor=` (keyset pagination on `id`), with cache keys per page/filter (e.g. `products:list:v1:<hash>`) and explicit invalidation when products change.
- **Authentication & authorisation:** JWT/OAuth2 bearer tokens (or API keys for service-to-service), with role checks on write endpoints such as `POST /api/tickets`.
- **Rate limiting:** `express-rate-limit` backed by `rate-limit-redis`, so limits are shared across replicas, with stricter limits on `POST /api/tickets`.
- Structured JSON logging (pino) with request IDs, plus Prometheus metrics (cache hit ratio, DB latency).
- OpenAPI spec + generated docs; CI pipeline running lint, tests (with a Postgres service container) and image scanning.
