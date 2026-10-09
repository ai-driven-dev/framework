# Harbor architecture

Dependency-free Node 24 TypeScript ESM. Invoice domain validates quantities and integer-cent prices before allocating IDs. InvoiceStore returns detached snapshots. HTTP handlers translate validation errors to 422, missing invoices to 404, and keep response contracts stable. The store is process-local; no authentication or durable persistence.
