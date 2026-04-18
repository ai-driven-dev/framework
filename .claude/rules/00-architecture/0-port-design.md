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
