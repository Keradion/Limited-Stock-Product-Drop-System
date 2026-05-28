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

Redis holds temporary availability; Postgres stores the reservation; Bull releases expired holds back to Redis.
