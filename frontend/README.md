# Frontend

React + TypeScript drop page (Vite).

## Structure

```
src/
  app/              # App shell + entry wiring
  api/              # HTTP clients (no fetch in components)
  config/           # Vite env config
  features/
    auth/           # Login / register
    drop/           # Reserve, checkout, stock polling
  lib/              # Shared utilities
  styles/           # Global CSS
  types/            # API types
  test/             # Vitest setup
```

## Commands

```bash
npm run dev      # http://localhost:5173
npm test
npm run build
```

Copy `.env.example` to `.env` for local overrides.
