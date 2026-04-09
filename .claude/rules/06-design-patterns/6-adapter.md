---
paths:
  - "src/infrastructure/adapters/**/*.ts"
---

# Adapter

- Class with `*Adapter` suffix
- Implements one port interface
- No business logic — I/O translation only
- All dependencies injected via constructor, typed as port interfaces
- Owns all technical constants for its integration domain: runtime names, OS-level strings, protocol details, system file paths
- Throw typed domain exceptions, never `new Error("user-facing string")`
- Infrastructure errors must not cross port boundary, translate before throwing
