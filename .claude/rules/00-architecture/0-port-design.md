---
paths:
  - "src/domain/ports/**/*.ts"
  - "src/infrastructure/adapters/**/*.ts"
---

# Port Design

## Interface contract

- Interface only — no classes, no implementations
- Single responsibility — ≤5 methods per port
- All I/O methods are `async` and return `Promise`
- No `null` in return types — adapters resolve null internally
- No `I` prefix — file location signals the role

## Intent over mechanism

- Method names describe what the caller wants, not how it's done
- Use domain vocabulary: `install`, `register`, `sync` — not `resolve`, `parse`, `build`, `compute`

## Hide adapter internals

- Implementation details (hook names, runtime strings, system paths) stay in the adapter
- Port signature must not leak the adapter's internal structure

## Exceptions

- `FileWriter` (6 methods) — pragmatic exception; write-class ports may have up to 6 methods. `FileReader` (5 methods) and `FileMerger` (3 methods) are within the ≤5 budget. `FileSystem` aggregate split landed in Part 9. All other ports must still respect ≤5 methods.
