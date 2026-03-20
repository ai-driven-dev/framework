---
paths:
  - "src/domain/ports/**/*.ts"
---

# Port Design

- Interface only — no classes, no implementations
- Single responsibility — ≤5 methods per port
- All I/O methods are `async` and return `Promise`
- No `null` in return types — adapters resolve null internally
- No `I` prefix — file location signals the role
