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
