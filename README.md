# Inventory Reservation Service

A production-quality backend service for an e-commerce platform that handles concurrent inventory reservations during flash sales, ensures data consistency, supports payment confirmation/failure flows, and automatically expires stale reservations.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Design Decisions](#design-decisions)
- [Architecture](#architecture)
- [Concurrency Handling](#concurrency-handling)
- [Reservation Lifecycle](#reservation-lifecycle)
- [Assumptions](#assumptions)

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js 18+ | Server-side JavaScript runtime |
| Framework | Express.js | RESTful API framework |
| Database | MySQL 8.0+ | Relational database with ACID transactions |
| DB Driver | mysql2 | Raw SQL queries with promise support |
| Authentication | jsonwebtoken + bcryptjs | JWT-based auth with password hashing |
| Validation | Joi | Request payload validation |
| Background Jobs | node-cron | Scheduled reservation expiry |
| HTTP Logging | Morgan | Request/response logging |
| Config | dotenv | Environment variable management |

---

## Prerequisites

- **Node.js** 18 or higher
- **MySQL** 8.0 or higher
- **npm** (comes with Node.js)

---

## Setup Instructions

### 1. Clone the repository

```bash
git clone <repository-url>
cd inventory-reservation-service
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and update the following:

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | MySQL host | `localhost` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_USER` | MySQL username | `root` |
| `DB_PASSWORD` | MySQL password | *(set yours)* |
| `DB_NAME` | Database name | `inventory_reservation` |
| `JWT_SECRET` | Secret key for JWT signing | *(change for production)* |
| `JWT_EXPIRES_IN` | Token expiry duration | `1h` |
| `RESERVATION_TTL_MINUTES` | Reservation timeout | `10` |
| `EXPIRY_CRON_INTERVAL` | Cron schedule for expiry worker | `*/30 * * * * *` (every 30s) |

### 4. Set up the database

**Option A — PowerShell:**
```powershell
Get-Content db/setup.sql | mysql -u root -pYOUR_PASSWORD
```

**Option B — MySQL Shell:**
```sql
source C:/path/to/project/db/setup.sql;
```

**Option C — MySQL Workbench:**  
Open `db/setup.sql` and execute it.

---

## Running the Application

### Development (with auto-reload)
```bash
npm run dev
```

### Production
```bash
npm start
```

The server starts at **http://localhost:3000**

A web-based testing UI is available at the root URL: **http://localhost:3000**

---

## API Documentation

### Postman Collection

Import the file `Inventory_Reservation_Service.postman_collection.json` into Postman to get all endpoints pre-configured with:
- Auto-saving tokens into variables after login
- Auto-saving product/reservation IDs for chained requests
- Pre-filled request bodies for quick testing

### Endpoints

#### Authentication (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register a new user (admin or customer) |
| `POST` | `/api/auth/login` | Login and receive a JWT token |

**Register body:**
```json
{
  "username": "admin1",
  "email": "admin@test.com",
  "password": "admin123",
  "role": "admin"
}
```
> `role` accepts `"admin"` or `"customer"` (default: `"customer"`)

**Login body:**
```json
{
  "email": "admin@test.com",
  "password": "admin123"
}
```

---

#### Products
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/products` | Public | List all products (paginated via `?page=1&limit=10`) |
| `GET` | `/api/products/:id` | Public | Get product details with stock info |
| `POST` | `/api/products` | Admin | Create a new product |
| `PATCH` | `/api/products/:id/stock` | Admin | Adjust stock (positive to add, negative to reduce) |

**Create product body:**
```json
{
  "name": "iPhone 15",
  "description": "Latest Apple iPhone",
  "price": 999.99,
  "total_stock": 10
}
```

**Adjust stock body:**
```json
{
  "adjustment": 5,
  "reason": "Restocked from warehouse"
}
```

---

#### Reservations (Customer only)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/reservations` | Customer | Reserve inventory units |
| `GET` | `/api/reservations` | Customer | List your reservations (filter: `?status=pending`) |
| `GET` | `/api/reservations/:id` | Customer | Get reservation detail |
| `DELETE` | `/api/reservations/:id` | Customer | Cancel a pending reservation |

**Create reservation body:**
```json
{
  "product_id": "<uuid>",
  "quantity": 2
}
```
> Optional header: `Idempotency-Key: unique-key-123` — prevents duplicate reservations on retries.

---

#### Payments (Customer only)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/payments/confirm` | Customer | Confirm payment → creates order, permanently consumes stock |
| `POST` | `/api/payments/fail` | Customer | Report payment failure → releases reserved stock |

**Confirm payment body:**
```json
{
  "reservation_id": "<uuid>",
  "payment_id": "PAY-001"
}
```
> `payment_id` must be unique. Sending the same `payment_id` twice returns the existing order (idempotent).

**Fail payment body:**
```json
{
  "reservation_id": "<uuid>",
  "reason": "Payment declined by bank"
}
```

---

#### Audit Trail (Admin only)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/audit/products/:id` | Admin | Complete inventory change history for a product |

**Response includes:** action, quantity changed, stock before/after, reason, who performed it, and timestamp.

---

#### Health Check
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/health` | Public | Service health status |

### Authentication Header

All protected routes require:
```
Authorization: Bearer <jwt_token>
```

### Standard Response Format

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Only 3 units available, but 5 were requested"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request payload |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT token |
| `FORBIDDEN` | 403 | Insufficient role permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `INSUFFICIENT_STOCK` | 409 | Not enough inventory available |
| `INVALID_STATUS` | 409 | Operation not allowed for current status |
| `DUPLICATE_ENTRY` | 409 | Duplicate resource detected |
| `RESERVATION_EXPIRED` | 410 | Reservation TTL exceeded |

---

## Database Schema

The database consists of 5 tables. The full schema is in [`db/setup.sql`](db/setup.sql).

### Entity Relationship

```
users ──┬── reservations ──┬── orders
        │                  │
products ──────────────────┼── inventory_audit_log
```

### Tables

#### `users`
Stores registered users with role-based access control.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(36) PK | UUID |
| username | VARCHAR(50) UNIQUE | Login username |
| email | VARCHAR(100) UNIQUE | Email address |
| password | VARCHAR(255) | bcrypt hash (12 rounds) |
| role | ENUM('admin','customer') | Access control role |

#### `products`
Stores products with three-field stock tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(36) PK | UUID |
| name | VARCHAR(255) | Product name |
| price | DECIMAL(10,2) | Unit price |
| total_stock | INT | Total inventory count |
| available_stock | INT | Currently available for reservation |
| reserved_stock | INT | Currently held by pending reservations |

**Constraints:**
- `CHECK (available_stock >= 0)` — stock can never go negative
- `CHECK (reserved_stock >= 0)` — reserved count can never go negative
- `CHECK (available_stock + reserved_stock <= total_stock)` — integrity invariant

#### `reservations`
Tracks each reservation through its lifecycle.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(36) PK | UUID |
| user_id | FK → users | Customer who reserved |
| product_id | FK → products | Product being reserved |
| quantity | INT | Units reserved |
| status | ENUM | pending / confirmed / expired / cancelled |
| idempotency_key | VARCHAR(255) UNIQUE | Prevents duplicate reservations |
| expires_at | TIMESTAMP | When the reservation expires |

#### `orders`
Created when payment is successfully confirmed.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(36) PK | UUID |
| reservation_id | FK → reservations (UNIQUE) | One order per reservation |
| payment_id | VARCHAR(255) UNIQUE | Prevents duplicate payment processing |
| total_amount | DECIMAL(10,2) | quantity × product price |

#### `inventory_audit_log`
Records every inventory change for full auditability.

| Column | Type | Description |
|--------|------|-------------|
| action | ENUM | reserved / released / confirmed / stock_added / stock_adjusted |
| quantity_changed | INT | How many units changed |
| stock_before | INT | Stock value before the operation |
| stock_after | INT | Stock value after the operation |
| reason | VARCHAR(255) | Human-readable explanation |
| performed_by | FK → users | Who triggered the change |

---

## Design Decisions

### 1. Pessimistic Locking over Optimistic Locking

**Decision:** Use MySQL `SELECT ... FOR UPDATE` within transactions for concurrency control.

**Rationale:** In a flash sale scenario with high contention on a single product row, optimistic locking (version-based) would cause excessive retries and failures. Pessimistic locking serializes access to the product row, ensuring each request gets an accurate stock count. The trade-off is slightly higher latency per request, but correctness is guaranteed.

### 2. Three-Field Stock Tracking

**Decision:** Track `total_stock`, `available_stock`, and `reserved_stock` as separate fields on the product table.

**Rationale:** This provides O(1) stock availability checks without needing to aggregate reservation records. The invariant `available_stock + reserved_stock ≤ total_stock` is enforced via a CHECK constraint at the database level, providing a last line of defense against bugs in application code.

### 3. Database-Level Constraints

**Decision:** Use MySQL CHECK constraints to enforce `available_stock >= 0` and `reserved_stock >= 0`.

**Rationale:** Even if application-level validation has a bug, the database will reject any operation that would result in negative stock or overselling. This is defense-in-depth.

### 4. Idempotency via Unique Constraints

**Decision:** Use `idempotency_key` on reservations and `payment_id` on orders with UNIQUE constraints.

**Rationale:** Network retries, double-clicks, and webhook re-deliveries are common in distributed systems. Instead of complex deduplication logic, a unique constraint at the DB level combined with a "check-before-insert" pattern ensures duplicate requests are handled safely and deterministically.

### 5. Cron-Based Expiry over Event-Driven Timers

**Decision:** Use a periodic cron job (every 30s) to expire reservations, rather than per-reservation `setTimeout` timers.

**Rationale:** In-process timers are lost on server restart and don't scale across multiple instances. A cron sweep is simple, reliable, and survives restarts. The 30-second interval means reservations may live up to 30 seconds beyond their TTL, which is acceptable for this use case.

### 6. Raw SQL over ORM

**Decision:** Use `mysql2` with raw SQL queries instead of an ORM like Prisma or Sequelize.

**Rationale:** Raw SQL gives full control over transaction management, locking strategies (`FOR UPDATE`), and query optimization. ORMs can obscure critical database behavior, especially around locking and transaction isolation. For a service where data integrity is paramount, explicit SQL is preferred.

### 7. Controllers Directly Access Database

**Decision:** No separate service/repository layer — controllers contain business logic and database queries.

**Rationale:** For the scope of this project, an additional abstraction layer would add complexity without proportional benefit. The controller handles request parsing, validation, business logic, and response formatting. If the codebase grows, extracting a service layer would be a natural refactoring step.

### 8. JWT with Role-Based Access Control

**Decision:** Stateless JWT tokens with `admin` and `customer` roles.

**Rationale:** JWTs are self-contained, don't require session storage, and scale well. Two roles provide sufficient access control for the requirements. The middleware checks both token validity and user existence in the database on every request, handling scenarios where a user is deleted after token issuance.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Express.js Application                    │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│  Auth    │ Product  │ Reserve  │ Payment  │  Audit          │
│  Routes  │ Routes   │ Routes   │ Routes   │  Routes         │
├──────────┴──────────┴──────────┴──────────┴─────────────────┤
│              Middleware Layer                                 │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐             │
│  │ JWT Auth │  │ Joi Valid. │  │ Error Handler│             │
│  └──────────┘  └───────────┘  └──────────────┘             │
├─────────────────────────────────────────────────────────────┤
│              Controllers (Business Logic)                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Transactions with SELECT ... FOR UPDATE (Row Locks)  │  │
│  └───────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│              MySQL Database (mysql2 connection pool)         │
│  ┌────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌───────┐  │
│  │ users  │ │ products │ │reserv. │ │ orders │ │ audit │  │
│  └────────┘ └──────────┘ └────────┘ └────────┘ └───────┘  │
├─────────────────────────────────────────────────────────────┤
│         Background: node-cron (Reservation Expiry)          │
└─────────────────────────────────────────────────────────────┘
```

### Project Structure

```
inventory-reservation-service/
├── db/
│   └── setup.sql                    # Database schema (CREATE TABLE statements)
├── public/
│   └── index.html                   # Web-based testing UI
├── src/
│   ├── server.js                    # Entry point — starts Express + cron
│   ├── app.js                       # Express app with middleware and routes
│   ├── db.js                        # MySQL connection pool
│   ├── config.js                    # Centralized configuration
│   ├── middleware/
│   │   ├── auth.js                  # JWT authentication + role authorization
│   │   ├── errorHandler.js          # Global error handler
│   │   └── validate.js              # Joi validation middleware
│   ├── routes/
│   │   ├── auth.routes.js           # /api/auth/*
│   │   ├── product.routes.js        # /api/products/*
│   │   ├── reservation.routes.js    # /api/reservations/*
│   │   ├── payment.routes.js        # /api/payments/*
│   │   └── audit.routes.js          # /api/audit/*
│   ├── controllers/
│   │   ├── auth.controller.js       # Register, login
│   │   ├── product.controller.js    # CRUD, stock adjustment
│   │   ├── reservation.controller.js# Reserve, cancel (core concurrency logic)
│   │   ├── payment.controller.js    # Confirm, fail payment
│   │   └── audit.controller.js      # Audit trail queries
│   ├── validators/
│   │   ├── auth.validator.js        # Joi schemas for auth
│   │   ├── product.validator.js     # Joi schemas for products
│   │   ├── reservation.validator.js # Joi schemas for reservations
│   │   └── payment.validator.js     # Joi schemas for payments
│   └── jobs/
│       └── expiryWorker.js          # Cron job for reservation expiry
├── .env.example                     # Environment variable template
├── .gitignore
├── package.json
├── Inventory_Reservation_Service.postman_collection.json
└── README.md
```

---

## Concurrency Handling

The core concurrency challenge: **100 customers trying to buy 10 units simultaneously**.

### How it works:

```sql
BEGIN TRANSACTION;

-- Step 1: Lock the product row (other transactions wait here)
SELECT * FROM products WHERE id = ? FOR UPDATE;

-- Step 2: Check stock
-- If available_stock < requested_quantity → ROLLBACK, return error

-- Step 3: Atomically update stock
UPDATE products SET available_stock = available_stock - ?,
                    reserved_stock = reserved_stock + ?
WHERE id = ?;

-- Step 4: Create reservation record
INSERT INTO reservations (...) VALUES (...);

-- Step 5: Log to audit trail
INSERT INTO inventory_audit_log (...) VALUES (...);

COMMIT;
```

Other concurrent requests for the same product **block at Step 1** until the lock is released at `COMMIT`. This ensures sequential consistency — only one transaction modifies stock at a time.

---

## Reservation Lifecycle

```
                      ┌──────────────┐
                      │   PENDING    │
                      └──────┬───────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌──────────┐   ┌──────────┐   ┌──────────┐
       │CONFIRMED │   │CANCELLED │   │ EXPIRED  │
       └──────────┘   └──────────┘   └──────────┘
       (payment OK)   (customer     (TTL exceeded,
                       cancels or    auto-released
                       payment       by cron job)
                       fails)
```

---

## Assumptions

1. **Single-instance deployment** — The service runs as a single Node.js process. MySQL row-level locks handle concurrency at the database level. For multi-instance deployment, a distributed lock mechanism (e.g., Redis-based) would be needed.

2. **Simulated payments** — No real payment gateway (Stripe, Razorpay) is integrated. The `/api/payments/confirm` and `/api/payments/fail` endpoints simulate payment webhook callbacks. In production, these would be called by the payment gateway.

3. **Single product per reservation** — Each reservation is for one product. Reserving multiple products requires multiple API calls. This simplifies row-level locking (only one product row locked per transaction).

4. **Reservation TTL is configurable** — Default is 10 minutes, changeable via `RESERVATION_TTL_MINUTES` environment variable. The cron job checks for expired reservations every 30 seconds.

5. **Admin registration is open** — Any user can register with the `admin` role. In production, admin creation should be restricted to existing admins or a seed script.

6. **No rate limiting** — The service does not implement request rate limiting. In production, `express-rate-limit` should be added to prevent abuse.

7. **No HTTPS** — The service runs over HTTP. In production, TLS should be terminated at a reverse proxy (e.g., Nginx) or load balancer.

8. **Expiry delay up to 30 seconds** — Since the cron job runs every 30 seconds, a reservation may live up to 30 seconds past its TTL. This is acceptable for the use case and avoids the complexity of per-reservation timers.

9. **UUID primary keys** — All tables use UUID v4 as primary keys for uniqueness across distributed systems, avoiding auto-increment conflicts.

---

## Database Integrity Verification

Run these queries to verify data consistency at any time:

```sql
-- Verify: available + reserved never exceeds total
SELECT * FROM products WHERE available_stock + reserved_stock > total_stock;
-- Expected: 0 rows

-- Verify: no negative stock values
SELECT * FROM products WHERE available_stock < 0 OR reserved_stock < 0;
-- Expected: 0 rows

-- Verify: no pending reservations past expiry (after cron runs)
SELECT * FROM reservations WHERE status = 'pending' AND expires_at < NOW();
-- Expected: 0 rows (within 30s of expiry)
```

---

## License

ISC
