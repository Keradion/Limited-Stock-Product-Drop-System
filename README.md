# Limited Stock Product Drop System

Monorepo for a limited-product drop: **Express API** + **React UI**.

## Project layout

```
├── backend/          # Express API, Prisma, Redis, BullMQ
│   ├── src/
│   ├── prisma/
│   └── tests/
├── frontend/         # React + Vite drop page
├── package.json      # Root scripts (delegates to backend / frontend)
└── README.md
```

## Quick start

### 1. Backend (port 3001)

```bash
cd backend
npm install
cp .env.example .env          # DATABASE_URL, REDIS_URL, JWT_SECRET, CORS_ORIGIN, etc.
npm run db:migrate
npm run db:seed
npm run dev
```

Or from the repo root:

```bash
npm run dev:backend
```

### 2. Frontend (port 5173)

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Or from the repo root:

```bash
npm run dev:frontend
```

Set `CORS_ORIGIN=http://localhost:5173` in `backend/.env`.

Sign in with `alice@example.com` / `password123`.

## Root scripts

| Script | Action |
|--------|--------|
| `npm run dev:backend` | API with hot reload |
| `npm run dev:frontend` | Vite dev server |
| `npm test` / `npm run test:frontend` | Backend / frontend tests |
| `npm run db:migrate` | Prisma migrate (backend) |
| `npm run db:seed` | Seed database |

See [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md) for details.

---

## Documentation

### Race conditions

- **Reserve:** Redis Lua `DECRBY` only if `available >= quantity` — single-threaded per key, safe under burst traffic.
- **Reserve (DB):** After Redis hold, a Prisma transaction re-checks `productStock` vs pending quantity; on failure, Redis hold is released (compensating action).
- **Checkout:** One transaction with status-guarded `updateMany` (`PENDING` + not expired) → decrement `productStock` with `gte: quantity` → create order. Only one checkout wins per reservation.
- **Expiry vs checkout:** Expiry uses the same pattern (`updateMany` on `PENDING` + expired); completed checkouts skip expiry. Redis stock restored only when expiry actually applies.

### Schema decisions

- **`Reservation.quantity`** — supports multi-unit holds; Redis and DB checks use the same value.
- **`Reservation.expiresAt`** — TTL for holds; indexed filter for active pending rows and expiry worker.
- **`ReservationStatus` enum** — explicit lifecycle (`PENDING` → `COMPLETED` / `EXPIRED`); guards prevent double checkout or expiry after sale.
- **`Order.reservationId` @unique** — one order per reservation; ties checkout to a single successful path.
- **`InventoryLog`** — audit trail for checkout and expiry (no stock math in the log table itself).
- **`Product.productStock`** — source of truth at checkout; Redis is a fast gate for reservations, synced on init from DB minus active pending.

### Trade-offs

| Choice | Benefit | Cost |
|--------|---------|------|
| Redis holds before DB write | Fast, atomic oversell prevention at drop time | Two layers (Redis + Postgres) to keep aligned |
| BullMQ delayed expiry | Reliable TTL without polling DB | Extra infra; Redis eviction policy must be safe for queues |
| `updateMany` guards vs row locks | Simple, works well for single-reservation races | Less ideal for complex multi-row inventory rules |
| Multiple reservations per user (API) | Flexible retries after expiry | UI limits one active hold per product on the drop page |

### At ~10k concurrent users

- **API / Node** — single process becomes CPU and connection bound; rate limiter and JWT middleware add per-request work.
- **Postgres** — connection pool exhaustion; hot rows on `product` and `reservation` for one SKU.
- **Redis** — single key per product (`available:{id}`) serializes all holds for that SKU (correct but throughput ceiling).
- **BullMQ** — job enqueue/backlog spikes if many reservations expire together.
- **Redis ↔ DB drift** — rare failures between Redis hold and DB commit rely on compensating `releaseStock`; crashes mid-flight need ops/reconciliation.

### Scaling (next steps)

- Horizontally scale **stateless API** behind a load balancer; sticky sessions not required (JWT).
- **Postgres:** read replicas for product/availability reads; PgBouncer; partition or shard by `productId` at very high scale.
- **Redis:** Redis Cluster or per-drop dedicated instance; consider pre-warming counters before drop.
- **Inventory:** shard counter keys (e.g. by bucket) only if business allows split pools; otherwise queue reserve requests per SKU.
- **Expiry:** dedicated BullMQ workers; separate Redis for cache vs queues (`noeviction` on queue Redis).
- **CDN + static frontend** on Pxxl; WebSocket or SSE for live stock if polling at 5s is too stale at scale.

### Deliverables

| Item | Link |
|------|------|
| GitHub | _add repo URL_ |
| Hosted (Pxxl) | _add https://pxxl.app/ URL_ |
| Loom (5–8 min) | _add video URL_ |
| Architecture diagram | _add image or link (see `docs/` if checked in)_ |

### Stack (reference)

- **Redis Lua** — atomic holds  
- **Postgres + Prisma** — reservations, orders, audit  
- **BullMQ** — reservation expiry (`RESERVATION_TTL_MS`, default 5 min)  
- **React + Vite** — drop page, checkout, stock polling
