# Pxxl deployment checklist (backend + frontend)

## Backend project

| Setting | Value |
|---------|--------|
| Base directory | `backend` |
| Port | `3001` |
| Install | `npm ci --legacy-peer-deps` |
| Build | `npm run build` |
| Start | `npm run start:prod` |
| Health check path | `/health` or `/` |

`start:prod` runs `prisma migrate deploy` then starts the API.

### Environment variables (copy names from `backend/.env.example`)

Required in Pxxl (paste your real values):

- `DATABASE_URL` — Pxxl Postgres; for `db.pxxl.pro` append `&sslmode=require` after `schema=public`
- `REDIS_URL` — use **`rediss://`** for Redis Cloud (not `redis://`)
- `PORT=3001`
- `NODE_ENV=production`
- All other keys from `.env.example` (JWT, rate limits, etc.)

**Do not** paste explanations into Install/Build/Start fields — only the command.

### After deploy

```text
GET https://<your-backend-host>/health
```

Expect JSON: `"status":"ok"` or `"degraded"`. HTML = wrong URL or app not running.

### If `pxxl launch transfer failed`

1. Open **runtime** logs (not build logs).
2. Fix `REDIS_URL` → `rediss://`.
3. Fix `DATABASE_URL` → add `&sslmode=require` for Pxxl DB.
4. Redeploy.

---

## Frontend project (separate)

| Setting | Value |
|---------|--------|
| Base directory | `frontend` |
| Install | `npm ci` |
| Build | `npm run build` |
| Start | `npm start` |

Build env: `VITE_API_BASE_URL=https://<backend-host>` (no trailing slash).

Then add frontend URL to backend `CORS_ORIGIN`.
