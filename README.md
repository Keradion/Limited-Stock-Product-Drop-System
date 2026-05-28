### User
* user_id (uuid)
* email (varchar)
* password (varchar)
* created_at (datetime)
* updated_at (datetime)

### Product
* product_id (uuid)
* product_name (varchar)
* product_stock (int)
* created_at (datetime)
* updated_at (datetime)

### Reservation
* reservation_id (uuid)
* reservation_status (enum)
* user_id (uuid)
* product_id (uuid)
* quantity (int)
* expires_at (datetime)
* created_at (datetime)
* updated_at (datetime)

### Order
* order_id (uuid)
* order_status (enum)
* user_id (uuid)
* product_id (uuid)
* reservation_id (uuid)
* created_at (datetime)
* updated_at (bigint)

### InventoryLog
* inventory_log_id (uuid)
* product_id (uuid)
* inventroy_reason (varchar)
* created_at (datetime)
* updated_at (datetime)

---

### Relationships

* **User**: Can make multiple `Reservations` and place multiple `Orders`.
* **Product**: Can have multiple `Reservations`, be purchased in multiple `Orders`, and generates multiple `InventoryLogs` for stock changes.
* **Reservation**: Belongs to one `User` and one `Product`. It can optionally link to one finalized `Order` to fulfill the secured stock.
* **Order**: Belongs to one `User` and one `Product`, referencing the `Reservation` that secured the stock.
* **InventoryLog**: Belongs to one `Product` to audit a specific stock adjustment event.

---

## Race Condition Handling

Concurrent reserve requests are handled in three layers:

1. **Redis Lua script (atomic hold)** — Stock checks and deductions run in a single Redis operation, so two simultaneous requests cannot both pass an availability check on the last unit.
2. **Database transaction** — The reservation record is created inside a Prisma transaction so the hold is persisted consistently after Redis succeeds.
3. **Compensating rollback** — If the DB write or Bull job scheduling fails after Redis holds stock, the hold is released and the reservation is cancelled.
4. **Status-guarded expiry** — The expiry worker uses `updateMany` with `status = PENDING`, so only one process can expire a reservation (safe when expiry and checkout race later).

Redis holds temporary availability; Postgres stores the reservation; BullMQ releases expired holds back to Redis.

### Reservation Expiry (BullMQ)

On successful `POST /api/reserve`, a delayed job is scheduled for `RESERVATION_TTL_MS` (default 5 minutes). When it runs:

1. Marks the reservation `EXPIRED` only if still `PENDING`
2. Releases held quantity back to Redis

Configured via `.env`:
```
RESERVATION_TTL_MS=300000
RESERVATION_EXPIRY_QUEUE_NAME=reservation-expiry
```

---

## Frontend (React + TypeScript)

The `client/` app implements the **Limited Drop Page** from the FullStack test requirements.

### UI behaviour

| Requirement | Implementation |
|-------------|----------------|
| Product info | `GET /api/products/:productId` |
| Remaining stock (5s refresh) | `GET /api/products/:productId/availability` via `useStockPolling` |
| Reserve button + loading | `useDropPage` → `POST /api/reserve` |
| 5-minute countdown | `useCountdown` from `expiresAt` |
| Sold out / duplicate reserve disabled | Button disabled when `soldOut` or active pending reservation |
| Expiration message | Shown when countdown reaches zero |

### Architecture

- **API layer**: `client/src/api/*` (no fetch calls inside components)
- **Custom hooks**: `useAuth`, `useStockPolling`, `useCountdown`, `useDropPage`
- **Strict TypeScript**: `strict` + `noUncheckedIndexedAccess` in `client/tsconfig.json`

### Run locally

```bash
# Terminal 1 — API (port 3001)
npm run dev

# Terminal 2 — UI (port 5173, proxies /api to backend)
npm run dev:client
```

Add to root `.env`:

```
CORS_ORIGIN=http://localhost:5173
```

Optional `client/.env`:

```
VITE_STOCK_POLL_MS=5000
VITE_API_TIMEOUT_MS=10000
VITE_DEFAULT_PRODUCT_ID=<uuid>   # or use ?productId= in the URL
```

Sign in with seeded user `alice@example.com` / `password123`.

### Tests

```bash
npm test              # backend (reservation, expiry, concurrency)
npm run test:client   # frontend (timer + API error parsing)
```
