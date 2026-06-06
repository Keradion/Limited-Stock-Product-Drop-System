# Backend API

Express API for limited stock drops (PostgreSQL, Redis, BullMQ).

## Quick Start

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev          # http://localhost:3001
npm test
```

---

## API Endpoints

Base URL: `http://localhost:3001`

### 🔐 Authentication

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepass123"
}
```

**Success Response (201):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Response (409):**
```json
{
  "error": "Email already registered",
  "statusCode": 409
}
```

---

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepass123"
}
```

**Success Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Response (401):**
```json
{
  "error": "Invalid email or password",
  "statusCode": 401
}
```

---

### 📦 Products

#### List Products
```http
GET /api/products?page=1&limit=10
```

**Success Response (200):**
```json
{
  "data": [
    {
      "productId": "22222222-2222-2222-2222-222222222222",
      "productName": "Limited Edition Sneakers",
      "productStock": 100,
      "dropStartsAt": "2026-05-31T12:00:00.000Z",
      "createdAt": "2026-05-30T10:00:00.000Z",
      "updatedAt": "2026-05-30T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

#### Get Product by ID
```http
GET /api/products/:productId
```

**Example:**
```http
GET /api/products/22222222-2222-2222-2222-222222222222
```

**Success Response (200):**
```json
{
  "productId": "22222222-2222-2222-2222-222222222222",
  "productName": "Limited Edition Sneakers",
  "productStock": 100,
  "dropStartsAt": "2026-05-31T12:00:00.000Z",
  "createdAt": "2026-05-30T10:00:00.000Z",
  "updatedAt": "2026-05-30T10:00:00.000Z"
}
```

**Error Response (404):**
```json
{
  "error": "Product not found",
  "statusCode": 404
}
```

---

#### Get Product Availability
```http
GET /api/products/:productId/availability
```

**Example:**
```http
GET /api/products/22222222-2222-2222-2222-222222222222/availability
```

**Success Response (200):**
```json
{
  "productId": "22222222-2222-2222-2222-222222222222",
  "totalStock": 100,
  "availableStock": 75,
  "soldOut": false,
  "dropStartsAt": "2026-05-31T12:00:00.000Z"
}
```

---

### 🎫 Reservations (Requires Authentication)

#### Create Reservation
```http
POST /api/reserve
Authorization: Bearer <token>
Content-Type: application/json

{
  "productId": "22222222-2222-2222-2222-222222222222",
  "quantity": 2
}
```

**Success Response (201):**
```json
{
  "reservationId": "33333333-3333-3333-3333-333333333333",
  "expiresAt": "2026-05-31T12:05:00.000Z"
}
```

**Error Responses:**

*Insufficient Stock (409):*
```json
{
  "error": "Insufficient stock",
  "statusCode": 409
}
```

*Product Not Found (404):*
```json
{
  "error": "Product not found",
  "statusCode": 404
}
```

*Service Unavailable (503):*
```json
{
  "error": "Inventory not available",
  "statusCode": 503
}
```

---

#### List Reservations
```http
GET /api/reservations?status=PENDING&productId=<uuid>&page=1&limit=10
Authorization: Bearer <token>
```

**Query Parameters:**
- `status` (optional): `PENDING`, `COMPLETED`, `EXPIRED`, `CANCELLED`
- `productId` (optional): Filter by product UUID
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Success Response (200):**
```json
{
  "data": [
    {
      "reservationId": "33333333-3333-3333-3333-333333333333",
      "userId": "11111111-1111-1111-1111-111111111111",
      "productId": "22222222-2222-2222-2222-222222222222",
      "quantity": 2,
      "reservationStatus": "PENDING",
      "expiresAt": "2026-05-31T12:05:00.000Z",
      "createdAt": "2026-05-31T12:00:00.000Z",
      "updatedAt": "2026-05-31T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 💳 Checkout (Requires Authentication)

#### Complete Checkout
```http
POST /api/checkout
Authorization: Bearer <token>
Content-Type: application/json

{
  "reservationId": "33333333-3333-3333-3333-333333333333"
}
```

**Success Response (201):**
```json
{
  "orderId": "44444444-4444-4444-4444-444444444444",
  "reservationId": "33333333-3333-3333-3333-333333333333",
  "orderStatus": "PAID"
}
```

**Error Responses:**

*Reservation Not Found (404):*
```json
{
  "error": "Reservation not found",
  "statusCode": 404
}
```

*Reservation Expired (410):*
```json
{
  "error": "Reservation expired",
  "statusCode": 410
}
```

*Already Completed (409):*
```json
{
  "error": "Reservation already completed",
  "statusCode": 409
}
```

*Insufficient Stock (409):*
```json
{
  "error": "Insufficient stock",
  "statusCode": 409
}
```

---

### 📋 Orders (Requires Authentication)

#### List Orders
```http
GET /api/orders?page=1&limit=10
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Success Response (200):**
```json
{
  "data": [
    {
      "orderId": "44444444-4444-4444-4444-444444444444",
      "userId": "11111111-1111-1111-1111-111111111111",
      "productId": "22222222-2222-2222-2222-222222222222",
      "reservationId": "33333333-3333-3333-3333-333333333333",
      "orderStatus": "PAID",
      "createdAt": "2026-05-31T12:03:00.000Z",
      "updatedAt": "2026-05-31T12:03:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 🏥 Health & Monitoring

#### Health Check
```http
GET /health
```

**Success Response (200):**
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected",
  "timestamp": "2026-05-31T12:00:00.000Z",
  "uptime": 3600.5
}
```

**Degraded Response (503):**
```json
{
  "status": "degraded",
  "database": "disconnected",
  "redis": "connected",
  "timestamp": "2026-05-31T12:00:00.000Z",
  "uptime": 3600.5
}
```

---

#### Metrics
```http
GET /metrics
```

**Success Response (200):**
```json
{
  "timestamp": "2026-05-31T12:00:00.000Z",
  "uptimeSeconds": 3600.5,
  "memory": {
    "rssBytes": 52428800,
    "heapUsedBytes": 20971520,
    "heapTotalBytes": 31457280
  }
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid credentials) |
| 404 | Not Found |
| 409 | Conflict (insufficient stock, already exists) |
| 410 | Gone (reservation expired) |
| 429 | Too Many Requests (rate limit) |
| 500 | Internal Server Error |
| 503 | Service Unavailable (Redis down) |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/api/auth/register` | 5 requests per 15 minutes |
| `/api/auth/login` | 10 requests per 15 minutes |
| `/api/reserve` | 5 requests per minute |
| `/api/checkout` | 3 requests per minute |

---

## Authentication

Most endpoints require a JWT token. Include it in the `Authorization` header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Get a token by calling `/api/auth/login` or `/api/auth/register`.

---

## Example Usage Flow

### 1. Register/Login
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

### 2. Get Product Availability
```bash
curl http://localhost:3001/api/products/22222222-2222-2222-2222-222222222222/availability
```

### 3. Create Reservation
```bash
curl -X POST http://localhost:3001/api/reserve \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"productId":"22222222-2222-2222-2222-222222222222","quantity":2}'
```

### 4. Complete Checkout
```bash
curl -X POST http://localhost:3001/api/checkout \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reservationId":"33333333-3333-3333-3333-333333333333"}'
```

---

## Project Folder Structure

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
tests/                # Mocha unit tests (60 tests)
```

---

## Testing

```bash
npm test              # Run all 60 tests
npm run lint          # Run ESLint
npm run type-check    # TypeScript validation
```

---

## Environment Variables

See `.env.example` for all available configuration options.

---

For a plain-English explanation of how the system works (race conditions, schema decisions, trade-offs, scaling), see the [main repo README](../README.md).
