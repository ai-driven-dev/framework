---
paths:
  - "src/**/*.ts"
---

# Error Handling

- Use-cases and adapters throw — no try/catch inside them
- Commands catch at action level only — via `output.exit(error)`
- No silent errors — every failure surfaces to the user
