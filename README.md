# High Concurrency System (Backend)

Backend-only microservice demo built to showcase **high-concurrency stock reservation**, **asynchronous processing**, and **failure-safe workflows** under contention.

## Core idea

The system models a simplified “flash sale” flow:

- **Inventory is the source of truth for *available* stock** (kept in Redis for speed).
- **Orders are created asynchronously** after stock is reserved (Kafka decouples hot path from persistence).
- **Failures are handled explicitly** via retries and a compensating action (stock revert).

This combination highlights how to keep a critical section small (atomic stock reservation), while still processing downstream work reliably at scale.

## Modules and responsibilities

- `api-gateway/` — Routes requests to backend services (configured routes to inventory and order domains).
- `inventory-service/` — Stock reservation + Kafka producer (order events) and Kafka consumer (stock revert).
- `order-service/` — Kafka consumer that persists orders to Postgres with retry/DLT handling.
- `common/` — Shared DTOs (`OrderEventDTO`, `StockSetDTO`, `TestEventDTO`, `BuyRequestDTO`).
- `load-test/` — Persisted load-test orchestration + metrics computation (note: it is **not** part of the root Maven reactor).

## Event-driven workflow (data flow)

Topics:

- `sale-orders`: emitted when inventory successfully reserves stock
- `stock-revert`: emitted when order processing fails irrecoverably

Flow:

1. Inventory receives a purchase attempt.
2. Inventory performs an **atomic reservation** against Redis stock.
3. On success, inventory publishes `OrderEventDTO` to `sale-orders`.
4. Order service consumes `sale-orders` and persists an `Order` row.
5. If order processing ultimately fails, order service publishes to `stock-revert`.
6. Inventory consumes `stock-revert` and increments stock back.

This is an **eventually consistent** workflow: the hot-path reservation is immediate; the durable order write happens asynchronously.

## Concurrency, correctness, and rationale

### 1) Atomic stock reservation (Redis + Lua)

**Problem:** under high contention, naive read-modify-write can oversell.

**Approach:** inventory uses a Lua script that:

- reads `stock:{productId}`
- if value > 0, performs `DECR`
- else returns `-1`

**Why it works:** Redis executes Lua scripts atomically, so the check-and-decrement is a single atomic operation. This keeps the critical section small and scalable across multiple application instances.

### 2) Decouple reservation from fulfillment (Kafka)

**Problem:** if the purchase endpoint also synchronously writes to a relational DB, latency spikes and DB contention can become the bottleneck.

**Approach:** after reserving stock, inventory emits an event to Kafka.

**Why Kafka:**

- buffers bursts (absorbs traffic spikes)
- enables downstream scaling via consumer groups
- allows explicit retry and dead-letter strategies

### 3) Parallel consumption (Kafka listener concurrency)

Order processing is designed to scale by consuming in parallel. The order service config uses Kafka listener concurrency (configured as `5`) so multiple consumer threads can process messages concurrently.

**Why:** throughput scales with partitions and consumer concurrency; it also reflects realistic production tuning where consumption needs to keep up with event ingress.

### 4) Failure policy: retries + dead-letter + compensation

Order consumer uses a retry policy:

- `@RetryableTopic` with exponential backoff (`attempts=3`, `delay=1000ms`, `multiplier=2.0`)
- on terminal failure, a **DLT handler** publishes a compensating `stock-revert` message

**Rationale:**

- retries cover transient issues (DB hiccups, temporary resource limits)
- dead-letter isolates poison messages and prevents consumer stall
- compensation restores reserved stock so the system converges to a consistent state

### 5) Idempotency / duplicate handling

Kafka delivery is typically **at-least-once**, so duplicates are possible.

Order service defends against this by checking if an `orderId` already exists (`existsByOrderId`) and skipping duplicates.

**Why:** it prevents duplicate inserts when messages are re-delivered due to retries, consumer restarts, or rebalancing.

## Load-test module (concurrency showcase)

The load-test service is intentionally backend-focused and demonstrates concurrency primitives used for generating and measuring load:

- test execution is triggered asynchronously via Spring `@Async` (dedicated executor bean)
- the runner uses `Executors.newVirtualThreadPerTaskExecutor()` to create many lightweight tasks
- metrics are computed and persisted: total requests, success/failure counts, average latency, p95 latency
- the test model includes an **oversell detection** flag to validate the correctness of stock reservation under contention

This module is designed to stress the **inventory reservation** and **Kafka-based order pipeline**, and to persist results for later inspection.

## Persistence model (what is stored)

- Orders (`order-service` / Postgres): `Order(id, orderId, productId, status)` with `orderId` unique (supports idempotency).
- Load tests (`load-test` / Postgres): `Test(testId, users, spawnRate, durationMs, quantity, metrics..., oversellDetected, status)`.
