# Harbor invoice API

POST /invoices accepts customerId, EUR/USD currency and 1–100 lines. Quantities and prices are safe integers; prices and totals use cents. Returns 201 with Location. GET /invoices/:id returns stored snapshots or 404. Invalid data returns 422.

The in-memory store is process-local. No persistence, authentication or idempotency key support is claimed.
