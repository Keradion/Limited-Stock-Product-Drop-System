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

## Architecture (backend)

- **Redis Lua** — atomic stock holds under concurrency  
- **Postgres + Prisma** — reservations, orders, inventory audit  
- **BullMQ** — reservation expiry after `RESERVATION_TTL_MS` (default 5 min)
