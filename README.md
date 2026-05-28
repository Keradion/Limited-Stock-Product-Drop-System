# Limited Stock Product Drop System

TypeScript API for a limited-inventory product drop platform. Handles user accounts, product stock, reservations, orders, and inventory audit logs.

## Getting Started

```bash
npm install
npm run dev
```

The API runs on `http://localhost:3001` by default. Health check: `GET /health`.

## Database Design

Schema diagram ([DrawSQL](https://drawsql.app/teams/daniel-shitaye/diagrams/limted-stock-product-drop-system/embed)):

<iframe width="100%" height="500px" style="box-shadow: 0 2px 8px 0 rgba(63,69,81,0.16); border-radius:15px;" allowtransparency="true" allowfullscreen="true" scrolling="no" title="Embedded DrawSQL IFrame" frameborder="0" src="https://drawsql.app/teams/daniel-shitaye/diagrams/limted-stock-product-drop-system/embed"></iframe>

The database is designed for **MySQL** and models a drop flow where users reserve limited stock, then convert reservations into orders while tracking every stock change.

### Tables

| Table | Purpose | Key columns |
| --- | --- | --- |
| **User** | Stores customer accounts | `user_id` (PK), `email`, `password`, `created_at`, `updated_at` |
| **Product** | Stores drop items and available stock | `product_id` (PK), `product_name`, `product_stock`, `created_at`, `updated_at` |
| **Reservation** | Holds a temporary stock hold before checkout | `reservation_id` (PK), `user_id`, `product_id`, `reservation_status`, `created_at`, `updated_at` |
| **Order** | Confirms a completed purchase | `order_id` (PK), `user_id`, `product_id`, `reservation_id` (unique), `order_status`, `created_at`, `updated_at` |
| **InventoryLog** | Audit trail for stock changes | `inventory_log_id` (PK), `product_id`, `inventroy_reason`, `created_at`, `updated_at` |

### Associations

- **User → Reservation** (one-to-many): A user can create many reservations via `Reservation.user_id`.
- **User → Order** (one-to-many): A user can place many orders via `Order.user_id`.
- **Product → Reservation** (one-to-many): A product can have many reservations via `Reservation.product_id`.
- **Product → Order** (one-to-many): A product can appear in many orders via `Order.product_id`.
- **Product → InventoryLog** (one-to-many): Each stock change is logged against a product via `InventoryLog.product_id`.
- **Reservation → Order** (one-to-one): Each order links to exactly one reservation through `Order.reservation_id` (unique), turning a hold into a confirmed purchase.

### Flow (short)

1. A **User** reserves a **Product** → row in **Reservation**.
2. Stock is adjusted and recorded in **InventoryLog**.
3. When checkout completes, an **Order** is created from the reservation (`reservation_id`).
4. **Product.product_stock** stays the source of truth for remaining inventory.
