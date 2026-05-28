# Backend

Express API for limited stock drops (PostgreSQL, Redis, BullMQ).

## Structure

```
src/
  app.ts              # Express app factory
  index.ts            # Server entry + workers
  config/             # Environment config
  routes/             # HTTP routes
  services/           # Business logic
  middleware/         # Auth, validation, rate limits
  lib/                # Inventory, JWT, errors, logging
  queues/             # BullMQ
  workers/            # Expiry worker
prisma/               # Schema, migrations, seed
tests/                # Mocha unit tests
```

## Commands

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev          # http://localhost:3001
npm test
npm run build
npm start
```
