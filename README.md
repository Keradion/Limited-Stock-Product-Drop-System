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

# How It Works 

## How We Stop Two People Buying The Same Last Item

**The Problem:**
Imagine a store has 1 pair of sneakers left. 100 people click "Buy" at the exact same moment. Without proper handling, all 100 might think they bought it. That's a disaster.

**How We Solved It:**
We use **Redis** (a super-fast memory storage) as a "doorman" that checks stock before letting anyone through.

Think of it like this:
1. Redis holds the actual count (e.g., "1 sneaker left")
2. When someone clicks Reserve, Redis does a **single, uninterruptible action**: "Subtract 1 from stock — but only if there's enough"
3. This action happens so fast and atomically that **only one person can win**
4. The other 99 people get told "sorry, sold out"

We also have a **second safety net** in the database. Even if Redis somehow lets two people through (it won't, but just in case), the database has a rule: "Only update if status is still PENDING." So only one person can complete the purchase.

**The result:** No matter how many people click at the same time, we never sell more than we have.

---

## Why The Database Looks The Way It Does

We have 5 main tables. Here's why:

### 1. **User** (who is buying)
Just email + password. Simple. We hash passwords so even we can't see them.

### 2. **Product** (what's being sold)
Has a name and stock count. The stock number is the **source of truth** — Redis just mirrors it for speed.

### 3. **Reservation** (someone's "hold" on items)
This is the most important table. When you click Reserve, we create a row here with:
- **Status**: PENDING (in your cart), COMPLETED (you paid), EXPIRED (timer ran out), or CANCELLED
- **ExpiresAt**: When your 5-minute timer ends
- **Quantity**: How many you want

Why a separate table? Because reservations are temporary. You might never pay. We need to track them, expire them, and free up stock if you abandon them.

### 4. **Order** (confirmed purchase)
Only created when you actually pay. Linked one-to-one with a reservation. This is your receipt.

### 5. **InventoryLog** (audit trail)
Every time stock changes (someone reserves, expires, or buys), we log it. Useful for debugging and accounting.

**Why use UUIDs instead of numbers like 1, 2, 3?**
Because UUIDs can't be guessed. If your order ID was "42", someone could try "43" and see someone else's order. UUIDs prevent that.

---

## Trade-Offs We Made

Every choice has a downside. Here are ours:

### 1. **Redis for Stock vs Database Only**
- ✅ **Pro**: Super fast (1000x faster than database)
- ❌ **Con**: If Redis crashes, we lose the stock count temporarily
- ⚖️ **Why we did it**: Speed matters more for a flash sale. We re-sync from the database when Redis restarts.

### 2. **5-Minute Reservation Timer**
- ✅ **Pro**: Gives users enough time to checkout
- ❌ **Con**: If 100 people reserve and don't buy, items are locked for 5 minutes
- ⚖️ **Why we did it**: 5 minutes is the industry standard. Shorter feels rushed. Longer wastes inventory.

### 3. **Polling Stock Every 5 Seconds (instead of WebSockets)**
- ✅ **Pro**: Simple, works everywhere, easy to scale
- ❌ **Con**: Not truly real-time. Stock might be 1 second stale.
- ⚖️ **Why we did it**: WebSockets are complex. For a drop, 5-second freshness is fine.

### 4. **JWT Tokens (instead of sessions)**
- ✅ **Pro**: No server-side storage needed, stateless
- ❌ **Con**: Can't instantly log someone out (token stays valid until it expires)
- ⚖️ **Why we did it**: Easier to scale across multiple servers.

### 5. **Background Job for Expiry (BullMQ)**
- ✅ **Pro**: Reservations get cleaned up reliably
- ❌ **Con**: Adds another moving part (Redis-based queue)
- ⚖️ **Why we did it**: Without it, expired reservations would lock stock forever.

---

## What Would Break With 10,000 People At Once?

Honestly? A few things:

### 1. **The Database Would Be The First To Cry**
Right now, every reservation triggers:
- 1 read (find product)
- 1 transaction (check stock + create reservation)
- 1 update (log the action)

With 10,000 simultaneous requests, the database would slow down dramatically. We'd see response times jump from 50ms to 5+ seconds.

### 2. **Connection Pool Would Run Out**
The database can only handle a certain number of connections at once (usually around 100). With 10k users, we'd exhaust the pool and people would get errors.

### 3. **Single Server Would Get Overwhelmed**
One Node.js server typically handles 1,000-3,000 requests per second. 10k simultaneous would max out CPU.

### 4. **Rate Limiters Would Kick In**
We have limits like "5 reservations per minute per user." With 10k users, we'd hit Redis hard with rate limit checks.

### 5. **The Bull Queue Could Pile Up**
10k reservations = 10k expiry jobs to process. The worker might fall behind.

**What WOULDN'T break:**
- ✅ Stock counting (Redis is built for this scale)
- ✅ Authentication (JWT is stateless)
- ✅ Data consistency (no overselling, even with race conditions)

---

## How We'd Scale It

Here's our game plan for handling 10k+ users:

### Step 1: Add More Servers (Horizontal Scaling)
Right now: 1 server  
Then: Put 5-10 servers behind a load balancer  
Cost: Cheap. Each server is independent because we use JWT tokens.

### Step 2: Beef Up The Database
- **Add read replicas**: Send "read" queries (like checking product) to copies of the database
- **Connection pooling**: Use PgBouncer to share connections efficiently
- **Add indexes**: We already have indexes on `productId` and `status` columns

### Step 3: Use Redis Cluster
One Redis can handle a lot. But for 10k+ users:
- Split Redis into multiple instances (Redis Cluster)
- Each product's stock lives on a specific Redis node
- This spreads the load

### Step 4: Cache Everything Readable
Product info doesn't change often. Cache it for 60 seconds:
- First user: Database query (slow)
- Next 999 users: Instant response from cache

### Step 5: Use a CDN For Static Stuff
The product images, descriptions, etc. should come from a CDN (CloudFlare, AWS CloudFront). Reduces server load dramatically.

### Step 6: Queue The Reservations
Instead of processing instantly:
- User clicks Reserve
- Request goes into a queue
- Workers process them in order
- User sees "You're #42 in line"

This is what Ticketmaster does for big events.

### Step 7: Add Monitoring
- Track response times, error rates, queue depth
- Tools: Datadog, Grafana, Prometheus
- Get alerts before things break

### Step 8: Use a Bigger Database
PostgreSQL on a beefier machine, or move to:
- **CockroachDB**: Distributed PostgreSQL
- **Amazon Aurora**: Auto-scaling PostgreSQL

---

## The Simple Summary

This app does one job well: **never oversell limited stock, even when thousands of people click Buy at the same instant.**

We achieve this through:
1. **Redis** as a fast doorman
2. **Database transactions** as a safety net
3. **Status checks** that only let one winner through per reservation
4. **A timer** that frees up stock if you don't pay

It currently works great for a few hundred users at once. To handle thousands more, we'd add servers, split up Redis, and put a queue in front of everything.

The codebase has **213 automated tests** that verify all of this works correctly — including tests that simulate 200 people clicking Buy at the exact same moment.

---

## Deliverables

| Item | Link |
|------|------|
| GitHub | _add repo URL_ |
| Hosted (Pxxl) | _add https://pxxl.app/ URL_ |
| Loom (5–8 min) | _add video URL_ — script: [docs/loom-script.md](docs/loom-script.md) |
| Architecture diagram | [docs/architecture.md](docs/architecture.md) (Mermaid) |
| ER diagram | [DrawSQL — Limited Stock Product Drop System](https://drawsql.app/teams/daniel-shitaye/diagrams/limted-stock-product-drop-system) |

## Stack (reference)

- **Redis Lua** — atomic holds  
- **Postgres + Prisma** — reservations, orders, audit  
- **BullMQ** — reservation expiry (`RESERVATION_TTL_MS`, default 5 min)  
- **React + Vite** — drop page, checkout, stock polling
