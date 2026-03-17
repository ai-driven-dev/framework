---
paths:
  - "src/infrastructure/adapters/**/*.ts"
---

# Adapter

- Class with `*Adapter` suffix
- Implements one port interface
- No business logic — I/O translation only
- All dependencies injected via constructor, typed as port interfaces
